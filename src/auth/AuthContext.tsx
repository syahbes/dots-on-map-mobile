import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { login as apiLogin, me as apiMe, signup as apiSignup, type User } from "@/api/auth";
import { onAuthFailure } from "@/api/client";
import { clearToken, setToken } from "./tokenStorage";

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

  // Bootstrap: if a token exists, resolve the user via /auth/me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
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
