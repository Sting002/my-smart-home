// src/contexts/AuthProvider.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/api/client";
import { AuthContext, type AuthContextType, type User } from "./auth-context";

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // hydrate session on first load
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // NOTE: client.ts prefixes with /api, so this becomes /api/auth/me
        const res = await apiGet<{ user: User | null }>("/auth/me");
        if (!alive) return;
        setUser(res.user);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const u = await apiPost<User>("/auth/login", { username, password });
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    await apiPost<{ ok: true }>("/auth/logout", {});
    setUser(null);
  }, []);

  const value: AuthContextType = useMemo(
    () => ({ user, ready, login, logout }),
    [user, ready, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
