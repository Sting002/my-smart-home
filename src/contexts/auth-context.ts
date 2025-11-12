// src/contexts/auth-context.ts
import { createContext } from "react";

export type User = {
  id: string;
  username: string;
  role: "admin" | "user";
  mustChangePassword: boolean;
};

export type AuthContextType = {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<User | null>;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
