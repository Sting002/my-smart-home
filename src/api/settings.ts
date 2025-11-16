import { apiGet, apiPost } from "./client";

export type SettingMap = Record<string, string | null | undefined>;

type SettingResponse = { value: string | null };

function serializeValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export async function fetchSettings(): Promise<SettingMap> {
  return apiGet<SettingMap>("/settings");
}

export async function fetchSetting(key: string): Promise<string | null> {
  const res = await apiGet<SettingResponse>(`/settings/${encodeURIComponent(key)}`);
  return res?.value ?? null;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  await apiPost("/settings", { key, value: serializeValue(value) });
}

export async function saveSettings(values: Record<string, unknown>): Promise<void> {
  await Promise.all(Object.entries(values).map(([key, value]) => saveSetting(key, value)));
}
