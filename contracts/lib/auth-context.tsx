"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(getClientAuth(), email, password);
  };

  const logout = async () => {
    await signOut(getClientAuth());
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** True once auth state is known, the user is signed in, and an ID token is available. */
export function useAuthReady(): boolean {
  const { user, loading } = useAuth();
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      setTokenReady(false);
      return;
    }

    let cancelled = false;
    user
      .getIdToken()
      .then(() => {
        if (!cancelled) setTokenReady(true);
      })
      .catch(() => {
        if (!cancelled) setTokenReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return !loading && user !== null && tokenReady;
}
