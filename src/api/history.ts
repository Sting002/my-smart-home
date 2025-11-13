// src/api/history.ts
import { apiClient } from './client';

export interface PowerReading {
  timestamp: number;
  watts: number;
  voltage?: number;
  current?: number;
}

export interface EnergyReading {
  timestamp: number;
  wh_total: number;
}

export interface Alert {
  id: string;
  home_id: string;
  device_id?: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'danger';
  message: string;
  type?: string;
  acknowledged: boolean;
}

export interface DailyStat {
  id: number;
  device_id: string;
  home_id: string;
  date: string;
  total_kwh: number;
  avg_watts: number;
  max_watts: number;
  min_watts: number;
  cost?: number;
  on_duration_minutes?: number;
}

export interface PowerStats {
  count: number;
  avg_watts: number;
  max_watts: number;
  min_watts: number;
  on_readings: number;
}

export async function getPowerHistory(
  deviceId: string,
  options?: { start?: number; end?: number; limit?: number }
): Promise<PowerReading[]> {
  const params = new URLSearchParams();
  if (options?.start) params.append('start', options.start.toString());
  if (options?.end) params.append('end', options.end.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiClient(`/api/history/power/${deviceId}${query}`);
}

export async function getEnergyHistory(
  deviceId: string,
  options?: { start?: number; end?: number; limit?: number }
): Promise<EnergyReading[]> {
  const params = new URLSearchParams();
  if (options?.start) params.append('start', options.start.toString());
  if (options?.end) params.append('end', options.end.toString());
  if (options?.limit) params.append('limit', options.limit.toString());

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiClient(`/api/history/energy/${deviceId}${query}`);
}

export async function getDailyStats(options?: {
  deviceId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<DailyStat[]> {
  const params = new URLSearchParams();
  if (options?.deviceId) params.append('deviceId', options.deviceId);
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiClient(`/api/history/daily-stats${query}`);
}

export async function getAlerts(options?: {
  limit?: number;
  deviceId?: string;
  severity?: string;
}): Promise<Alert[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', options.limit.toString());
  if (options?.deviceId) params.append('deviceId', options.deviceId);
  if (options?.severity) params.append('severity', options.severity);

  const query = params.toString() ? `?${params.toString()}` : '';
  return apiClient(`/api/history/alerts${query}`);
}

export async function acknowledgeAlert(alertId: string): Promise<{ ok: boolean }> {
  return apiClient(`/api/history/alerts/${alertId}/acknowledge`, {
    method: 'PATCH',
  });
}

export async function getPowerStats(
  deviceId: string,
  options?: { start?: number; end?: number }
): Promise<PowerStats> {
  const params = new URLSearchParams({ deviceId });
  if (options?.start) params.append('start', options.start.toString());
  if (options?.end) params.append('end', options.end.toString());

  return apiClient(`/api/history/stats/power?${params.toString()}`);
}
