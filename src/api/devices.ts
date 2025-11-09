// src/api/devices.ts
import { apiGet, apiPost, apiDelete } from "./client";
import type { Device } from "@/utils/energyContextTypes";

export async function fetchDevices(): Promise<Device[]> {
  return apiGet<Device[]>("/devices");
}

export async function upsertDevice(device: Device): Promise<{ ok: boolean } | unknown> {
  return apiPost("/devices", device);
}

export async function removeDevice(id: string): Promise<{ ok: boolean; deleted?: number } | unknown> {
  return apiDelete(`/devices/${encodeURIComponent(id)}`);
}
