import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { login as apiLogin, me as apiMe, signup as apiSignup, type User } from "@/api/auth";
import { onAuthFailure } from "@/api/client";
import { clearAll as clearPendingQueue } from "@/db/locationDb";
import { stopTracking } from "@/location/tracking";
import { notifyQueueChanged } from "@/network/flush";
import { clearToken, getToken, setToken } from "./tokenStorage";

/**
 * Fully tear down tracking + any locally-buffered points. Called on sign-out
 * and on any 401 from the API so that:
 *   1. The phone stops hitting the server with a dead token.
 *   2. Pending SQLite points (which belong to the previous user) don't leak
 *      to whoever signs in next.
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  // Bootstrap: if a token exists, resolve the user via /auth/me. If there is
  // no token, skip the network call entirely — otherwise a 401 from that
  // unauthenticated /auth/me can race against a successful sign-in and wipe
  // the freshly-stored token (visible on real iOS devices where the request
  // takes long enough to still be in flight when the user signs in).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getToken();
      if (!token) {
        if (cancelled) return;
        setUser(null);
        setStatus("signed-out");
        return;
      }
      try {
        const { user } = await apiMe();
        if (cancelled) return;
        setUser(user);
        setStatus("signed-in");
      } catch {
        if (cancelled) return;
        setUser(null);
        setStatus("signed-out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // On any 401 from the API client, drop to signed-out.
  useEffect(() => {
    return onAuthFailure(() => {
      setUser(null);
      setStatus("signed-out");
      void teardownTrackingAndQueue();
    });
  }, []);

  const signUp = useCallback(
    async (input: { email: string; fullName: string; password: string }) => {
      const res = await apiSignup(input);
      await setToken(res.accessToken);
      setUser(res.user);
      setStatus("signed-in");
    },
    [],
  );

  const signIn = useCallback(async (input: { email: string; password: string }) => {
    const res = await apiLogin(input);
    await setToken(res.accessToken);
    setUser(res.user);
    setStatus("signed-in");
  }, []);

  const signOut = useCallback(async () => {
    await teardownTrackingAndQueue();
    await clearToken();
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
