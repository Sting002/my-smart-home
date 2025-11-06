/* eslint-disable react-refresh/only-export-components */
// src/contexts/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiGet, apiPost } from "@/api/client";

type User = { id: string; username: string } | null;

type AuthContextValue = {
  user: User;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const me = await apiGet<{ user: { id: string; username: string } | null }>("/auth/me");
        setUser(me.user ?? null);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    const me = await apiGet<{ user: { id: string; username: string } | null }>("/auth/me");
    setUser(me.user ?? null);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      await apiPost("/auth/login", { username, password });
      await refresh();
    },
    [refresh]
  );

  const register = useCallback(
    async (username: string, password: string) => {
      await apiPost("/auth/register", { username, password });
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(async () => {
    await apiPost("/auth/logout", {});
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
