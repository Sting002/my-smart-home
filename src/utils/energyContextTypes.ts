// src/utils/energyContextTypes.ts
import type { Dispatch, SetStateAction } from "react";

export interface Alert {
  id: string;
  type?: "info" | "warning" | "critical" | "success";
  message: string;
  timestamp: number;
  deviceId?: string;
  payload?: Record<string, unknown>;
}

export interface Device {
  id: string;
  name: string;
  room: string;
  type: string;
  isOn: boolean;
  watts: number;
  kwhToday: number;
  thresholdW: number;
  autoOffMins: number;
  lastSeen: number;
  /** Marks device as essential for scenes/peak-shaving; not auto-turned-off */
  essential?: boolean;
}

/** History of power readings per device for charts */
export type PowerHistoryMap = Record<
  string,
  Array<{ ts: number; watts: number }>
>;

export interface EnergyContextType {
  devices: Device[];
  alerts: Alert[];
  powerHistory: PowerHistoryMap;

  blockedDeviceIds: string[];
  homeId: string;
  currency: string;
  tariff: number;
  monthlyBudget: number;
  touEnabled: boolean;
  touPeakPrice: number;
  touOffpeakPrice: number;
  touOffpeakStart: string;
  touOffpeakEnd: string;
  alertTtlMinutes: number;

  setHomeId: (id: string) => void;
  setTariff: (tariff: number) => void;
  setCurrency: (currency: string) => void;
  setMonthlyBudget: (value: number) => void;
  setTouEnabled: (value: boolean) => void;
  setTouPeakPrice: (value: number) => void;
  setTouOffpeakPrice: (value: number) => void;
  setTouOffpeakStart: (value: string) => void;
  setTouOffpeakEnd: (value: string) => void;
  setAlertTtlMinutes: (value: number) => void;
  setBlockedDeviceIds: Dispatch<SetStateAction<string[]>>;

  toggleDevice: (deviceId: string) => void;
  updateDevice: (deviceId: string, updates: Partial<Device>) => void;
  addDevice: (device: Device) => void;
  removeDevice: (deviceId: string) => void;
  refreshBrokerConfig: () => void;
}
