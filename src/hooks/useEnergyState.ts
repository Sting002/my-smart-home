import { useEffect, useState } from "react";
import type { Device, Alert, PowerHistoryMap } from "@/utils/energyContextTypes";

type EnergyStateHook = {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  powerHistory: PowerHistoryMap;
  setPowerHistory: React.Dispatch<React.SetStateAction<PowerHistoryMap>>;
  blockedDeviceIds: string[];
  setBlockedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  homeId: string;
  setHomeId: (value: string) => void;
  currency: string;
  setCurrency: (value: string) => void;
  tariff: number;
  setTariff: (value: number) => void;
};

export function useEnergyState(): EnergyStateHook {
  const [devices, setDevices] = useState<Device[]>(() => {
    const stored = localStorage.getItem("devices");
    return stored ? (JSON.parse(stored) as Device[]) : [];
  });

  const [alerts, setAlerts] = useState<Alert[]>(() => {
    const stored = localStorage.getItem("alerts");
    return stored ? (JSON.parse(stored) as Alert[]) : [];
  });

  const [powerHistory, setPowerHistory] = useState<PowerHistoryMap>({});

  const [blockedDeviceIds, setBlockedDeviceIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("blockedDevices") || "[]");
    } catch {
      return [];
    }
  });

  const [homeId, setHomeId] = useState<string>(() => {
    return localStorage.getItem("homeId") || "home1";
  });
  const [currency, setCurrency] = useState<string>(() => {
    return localStorage.getItem("currency") || "USD";
  });
  const [tariff, setTariff] = useState<number>(() => {
    const stored = localStorage.getItem("tariff");
    return stored ? parseFloat(stored) : 0.12;
  });

  useEffect(() => {
    localStorage.setItem("devices", JSON.stringify(devices));
  }, [devices]);

  useEffect(() => {
    localStorage.setItem("alerts", JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem("blockedDevices", JSON.stringify(blockedDeviceIds));
  }, [blockedDeviceIds]);

  useEffect(() => {
    localStorage.setItem("homeId", homeId);
    localStorage.setItem("currency", currency);
    localStorage.setItem("tariff", tariff.toString());
  }, [homeId, currency, tariff]);

  return {
    devices,
    setDevices,
    alerts,
    setAlerts,
    powerHistory,
    setPowerHistory,
    blockedDeviceIds,
    setBlockedDeviceIds,
    homeId,
    setHomeId,
    currency,
    setCurrency,
    tariff,
    setTariff,
  };
}
