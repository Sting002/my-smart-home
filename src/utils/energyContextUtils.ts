import type { Device } from "./energyContextTypes";

export function createDevice(
  partial: Partial<Device> & { id: string; name: string; room: string; type: string }
): Device {
  return {
    id: partial.id,
    name: partial.name,
    room: partial.room,
    type: partial.type,
    isOn: partial.isOn ?? false,
    watts: partial.watts ?? 0,
    kwhToday: partial.kwhToday ?? 0,
    thresholdW: partial.thresholdW ?? 1000,
    autoOffMins: partial.autoOffMins ?? 0,
    lastSeen: partial.lastSeen ?? Date.now(),
  };
}
