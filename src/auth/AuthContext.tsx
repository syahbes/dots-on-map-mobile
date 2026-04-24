import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
} from "aws-amplify/auth";

import { clearAll as clearPendingQueue } from "@/db/locationDb";
import { stopTracking } from "@/location/tracking";
import { notifyQueueChanged } from "@/network/flush";
import { clearEntityId, getEntityId, setEntityId } from "./entityStorage";

/**
 * Cognito-backed auth.
 *
 * Users log in with email + password against the PaperRound Cognito User Pool
 * using native SRP (see the integration guide from Mike). On success we pull
 * the `sub` (stable UUID) out of the ID token and persist it as our local
 * `entityId` so background tasks and API payloads keep working exactly as
 * before.
 *
 * First-time users come back from `signIn` with a `NEW_PASSWORD_REQUIRED`
 * challenge — the sign-in screen handles that by routing to the new-password
 * screen which calls `confirmNewPassword`.
 */
export type User = {
  /** Cognito `sub` — a stable UUID. Used as the entityId everywhere. */
  id: string;
  /** Email the user signed in with. */
  email: string;
  /** `name` attribute from the ID token, or "" if unset. */
  fullName: string;
};

async function teardownTrackingAndQueue() {
  try {
    await stopTracking();
  } catch (err) {
    console.warn("[auth] stopTracking failed", err);
  }
  try {
    await clearPendingQueue();
    notifyQueueChanged();
  } catch (err) {
    console.warn("[auth] clear queue failed", err);
  }
}

type AuthStatus = "loading" | "signed-in" | "signed-out";

/** An auth challenge Cognito returned that the UI still has to resolve. */
export type PendingChallenge = { kind: "new-password-required"; email: string };

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /**
   * Any non-terminal step Cognito returned from the last `signIn` call that
   * the UI still needs to resolve (e.g. first-login password change).
   */
  pending: PendingChallenge | null;
  signUp: (input: { email: string; fullName: string; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<{ requiresNewPassword: boolean }>;
  /** Resolve a `NEW_PASSWORD_REQUIRED` challenge. */
  confirmNewPassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Pulls the signed-in user out of the current Cognito session. Assumes the
 * session is valid (i.e. called after `signIn` resolves with `isSignedIn` or
 * after `getCurrentUser` succeeds on launch).
 */
async function loadUserFromSession(): Promise<User> {
  const session = await fetchAuthSession();
  const payload = session.tokens?.idToken?.payload ?? {};
  const sub = typeof payload.sub === "string" ? payload.sub : undefined;
  const email = typeof payload.email === "string" ? payload.email : "";
  const name = typeof payload.name === "string" ? payload.name : "";

  console.log("[cognito] fetchAuthSession →", {
    hasIdToken: Boolean(session.tokens?.idToken),
    hasAccessToken: Boolean(session.tokens?.accessToken),
    sub,
    email,
    name,
  });

  if (!sub) {
    throw new Error("Cognito session has no `sub` claim — cannot establish user identity.");
  }

  return { id: sub, email, fullName: name };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [pending, setPending] = useState<PendingChallenge | null>(null);

  // Bootstrap on launch: Amplify auto-refreshes tokens, so if a session
  // exists `getCurrentUser` will resolve; otherwise we're signed out.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await getCurrentUser();
        console.log("[cognito] getCurrentUser →", current);
        const u = await loadUserFromSession();
        if (cancelled) return;
        await setEntityId(u.id);
        setUser(u);
        setStatus("signed-in");
      } catch (err) {
        console.log("[cognito] getCurrentUser → no active session", err);
        if (cancelled) return;
        // Clean up any stale entityId from previous mock-auth builds.
        const stale = await getEntityId();
        if (stale) await clearEntityId();
        setUser(null);
        setStatus("signed-out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signUp = useCallback(async () => {
    // PaperRound Cognito pool is invite-only; self-service sign-up is
    // disabled by design. Admins create users in the backoffice.
    throw new Error("Sign-up is invite-only — ask an admin to create your account.");
  }, []);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      const username = input.email.trim();

      const loggableRequest = {
        username,
        password: "***redacted***",
        options: { authFlowType: "USER_SRP_AUTH" as const },
      };
      console.log("[cognito] signIn →", loggableRequest);

      let response;
      try {
        response = await cognitoSignIn({
          username,
          password: input.password,
          options: { authFlowType: "USER_SRP_AUTH" },
        });
      } catch (err) {
        console.warn("[cognito] signIn ✕", err);
        throw err;
      }

      console.log("[cognito] signIn ←", response);

      const step = response.nextStep?.signInStep;

      if (response.isSignedIn || step === "DONE") {
        const u = await loadUserFromSession();
        await setEntityId(u.id);
        setUser(u);
        setPending(null);
        setStatus("signed-in");
        return { requiresNewPassword: false };
      }

      if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setPending({ kind: "new-password-required", email: username });
        return { requiresNewPassword: true };
      }

      // MFA etc. — not enabled today; fail loudly so we notice if it turns on.
      throw new Error(`Unhandled Cognito next step: ${step}`);
    },
    [],
  );

  const confirmNewPassword = useCallback(async (newPassword: string) => {
    console.log("[cognito] confirmSignIn → { challengeResponse: '***redacted***' }");
    const response = await confirmSignIn({ challengeResponse: newPassword });
    console.log("[cognito] confirmSignIn ←", response);

    if (response.isSignedIn || response.nextStep?.signInStep === "DONE") {
      const u = await loadUserFromSession();
      await setEntityId(u.id);
      setUser(u);
      setPending(null);
      setStatus("signed-in");
      return;
    }

    throw new Error(
      `Unexpected next step after setting new password: ${response.nextStep?.signInStep}`,
    );
  }, []);

  const signOut = useCallback(async () => {
    await teardownTrackingAndQueue();
    try {
      await cognitoSignOut();
      console.log("[cognito] signOut → ok");
    } catch (err) {
      console.warn("[cognito] signOut failed", err);
    }
    await clearEntityId();
    setUser(null);
    setPending(null);
    setStatus("signed-out");
  }, []);

  return (
    <AuthContext.Provider
      value={{ status, user, pending, signUp, signIn, confirmNewPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
