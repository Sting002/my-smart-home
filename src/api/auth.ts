import { apiDelete, apiGet, apiPost } from "./client";
import type { User } from "@/contexts/auth-context";

export type ManagedUser = User & {
  created_at?: number;
};

export type AdminCreateUserResponse = {
  id: string;
  username: string;
  role: "admin" | "user";
  temporaryPassword?: string;
};

export function fetchManagedUsers(): Promise<{ users: ManagedUser[] }> {
  return apiGet<{ users: ManagedUser[] }>("/auth/users");
}

export function adminCreateUser(payload: { username: string; role?: "admin" | "user" }) {
  return apiPost<AdminCreateUserResponse, typeof payload>("/auth/register", payload);
}

export function deleteManagedUser(id: string) {
  return apiDelete<{ ok: boolean; deleted?: number }>(`/auth/users/${encodeURIComponent(id)}`);
}

export function changePassword(body: { currentPassword: string; newPassword: string }) {
  return apiPost<{ ok: true }, typeof body>("/auth/change-password", body);
}
