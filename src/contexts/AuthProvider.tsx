// src/contexts/AuthProvider.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/api/client";
import { AuthContext, type AuthContextType, type User } from "./auth-context";

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const fetchCurrentUser = useCallback(async () => {
    const res = await apiGet<{ user: User | null }>("/auth/me");
    return res.user ?? null;
  }, []);

  // hydrate session on first load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const current = await fetchCurrentUser();
        if (!alive) return;
        setUser(current);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchCurrentUser]);

  const refresh = useCallback(async () => {
    try {
      const current = await fetchCurrentUser();
      setUser(current);
      return current;
    } catch (err) {
      setUser(null);
      throw err;
    }
  }, [fetchCurrentUser]);

  const login = useCallback(async (username: string, password: string) => {
    const u = await apiPost<User>("/auth/login", { username, password });
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await apiPost<{ ok: true }>("/auth/logout", {});
    setUser(null);
  }, []);

  const value: AuthContextType = useMemo(
    () => ({ user, ready, login, logout, refresh }),
    [user, ready, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
