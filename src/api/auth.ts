import { apiGet, apiPost } from "./client";
import type { User } from "@/contexts/auth-context";

export type ManagedUser = User & { created_at?: number };

export function fetchManagedUsers(): Promise<{ users: ManagedUser[] }> {
  return apiGet<{ users: ManagedUser[] }>("/auth/users");
}

export function adminCreateUser(payload: {
  username: string;
  password: string;
  role?: "admin" | "user";
}): Promise<ManagedUser> {
  return apiPost<ManagedUser, typeof payload>("/auth/register", payload);
}
