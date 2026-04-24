import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearAll as clearPendingQueue } from "@/db/locationDb";
import { stopTracking } from "@/location/tracking";
import { notifyQueueChanged } from "@/network/flush";
import { clearEntityId, getEntityId, setEntityId } from "./entityStorage";

/**
 * Local-only auth.
 *
 * There is no real backend auth yet. On sign-in / sign-up the user types their
 * entityId (e.g. `1876`) into the email field and anything into the password
 * field; we persist the entityId in SecureStore and use it as the payload
 * owner for every geo-tracking API call. Real auth will replace this module
 * when the backend is ready.
 */
export type User = {
  /** The entityId the user typed on sign-in. */
  id: string;
  /** Mirror of `id` — kept so existing UI that reads `user.email` still works. */
  email: string;
  /** Empty until real signup exists. */
  fullName: string;
};

/**
 * Fully tear down tracking + any locally-buffered points on sign-out so
 * pending SQLite points (which belong to the previous user) don't leak to
 * whoever signs in next.
 */
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

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  signUp: (input: { email: string; fullName: string; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromEntityId(entityId: string, fullName = ""): User {
  return { id: entityId, email: entityId, fullName };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  // Bootstrap from SecureStore — if an entityId was persisted on a previous
  // launch, restore the signed-in state synchronously (no network).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entityId = await getEntityId();
      if (cancelled) return;
      if (entityId) {
        setUser(userFromEntityId(entityId));
        setStatus("signed-in");
      } else {
        setUser(null);
        setStatus("signed-out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signUp = useCallback(
    async (input: { email: string; fullName: string; password: string }) => {
      // No real signup yet — treat whatever the user entered in the "email"
      // field as their entityId and persist it.
      const entityId = input.email.trim();
      await setEntityId(entityId);
      setUser(userFromEntityId(entityId, input.fullName.trim()));
      setStatus("signed-in");
    },
    [],
  );

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    // No real signin yet — same story as signUp.
    const entityId = input.email.trim();
    await setEntityId(entityId);
    setUser(userFromEntityId(entityId));
    setStatus("signed-in");
  }, []);

  const signOut = useCallback(async () => {
    await teardownTrackingAndQueue();
    await clearEntityId();
    setUser(null);
    setStatus("signed-out");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
