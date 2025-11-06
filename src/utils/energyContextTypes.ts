// src/utils/energyContextTypes.ts

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

  homeId: string;
  currency: string;
  tariff: number;

  setHomeId: (id: string) => void;
  setTariff: (tariff: number) => void;
  setCurrency: (currency: string) => void;

  toggleDevice: (deviceId: string) => void;
  updateDevice: (deviceId: string, updates: Partial<Device>) => void;
  addDevice: (device: Device) => void;
}
