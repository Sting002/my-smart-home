import { useCallback, useEffect, useMemo, useState } from "react";
import type { Device, Alert, PowerHistoryMap } from "@/utils/energyContextTypes";
import { fetchSettings, saveSetting } from "@/api/settings";

type SceneDefinition = {
  id: string;
  targets: Array<{ deviceId: string; turnOn: boolean }>;
};

type EnergyPreferences = {
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
  scenes: SceneDefinition[];
};

const DEFAULT_PREFERENCES: EnergyPreferences = {
  homeId: "home1",
  currency: "USD",
  tariff: 0.12,
  monthlyBudget: 0,
  touEnabled: false,
  touPeakPrice: 0.2,
  touOffpeakPrice: 0.12,
  touOffpeakStart: "22:00",
  touOffpeakEnd: "06:00",
  alertTtlMinutes: 5,
  scenes: [],
};

const SETTING_KEYS: Record<keyof EnergyPreferences | "blockedDeviceIds", string> = {
  homeId: "homeId",
  currency: "currency",
  tariff: "tariff",
  monthlyBudget: "monthlyBudget",
  touEnabled: "touEnabled",
  touPeakPrice: "touPeakPrice",
  touOffpeakPrice: "touOffpeakPrice",
  touOffpeakStart: "touOffpeakStart",
  touOffpeakEnd: "touOffpeakEnd",
  alertTtlMinutes: "alertTtlMins",
  scenes: "scenes",
  blockedDeviceIds: "blockedDevices",
};

const parseNumber = (value: string | null | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoolean = (value: string | null | undefined, fallback: boolean) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const parseJSON = <T,>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

type EnergyStateHook = {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  powerHistory: PowerHistoryMap;
  setPowerHistory: React.Dispatch<React.SetStateAction<PowerHistoryMap>>;
  blockedDeviceIds: string[];
  setBlockedDeviceIds: React.Dispatch<React.SetStateAction<string[]>>;
  preferences: EnergyPreferences;
  setPreference: <K extends keyof EnergyPreferences>(
    key: K,
    value: EnergyPreferences[K]
  ) => void;
};

export function useEnergyState(): EnergyStateHook {
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [powerHistory, setPowerHistory] = useState<PowerHistoryMap>({});
  const [blockedDeviceIdsState, setBlockedDeviceIdsState] = useState<string[]>([]);
  const [preferences, setPreferences] =
    useState<EnergyPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const remote = await fetchSettings();
        if (!alive) return;
        setPreferences({
          homeId: remote.homeId ?? DEFAULT_PREFERENCES.homeId,
          currency: remote.currency ?? DEFAULT_PREFERENCES.currency,
          tariff: parseNumber(remote.tariff, DEFAULT_PREFERENCES.tariff),
          monthlyBudget: parseNumber(
            remote.monthlyBudget,
            DEFAULT_PREFERENCES.monthlyBudget
          ),
          touEnabled: parseBoolean(remote.touEnabled, DEFAULT_PREFERENCES.touEnabled),
          touPeakPrice: parseNumber(
            remote.touPeakPrice,
            DEFAULT_PREFERENCES.touPeakPrice
          ),
          touOffpeakPrice: parseNumber(
            remote.touOffpeakPrice,
            DEFAULT_PREFERENCES.touOffpeakPrice
          ),
          touOffpeakStart:
            remote.touOffpeakStart ?? DEFAULT_PREFERENCES.touOffpeakStart,
          touOffpeakEnd: remote.touOffpeakEnd ?? DEFAULT_PREFERENCES.touOffpeakEnd,
          alertTtlMinutes: parseNumber(
            remote.alertTtlMins,
            DEFAULT_PREFERENCES.alertTtlMinutes
          ),
          scenes: parseJSON(remote.scenes, DEFAULT_PREFERENCES.scenes),
        });
        setBlockedDeviceIdsState(
          parseJSON(remote.blockedDevices, [] as string[])
        );
      } catch (err) {
        console.warn("Failed to fetch settings", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const setPreference = useCallback(
    <K extends keyof EnergyPreferences>(key: K, value: EnergyPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
      void saveSetting(SETTING_KEYS[key], value);
    },
    []
  );

  const setBlockedDeviceIds = useCallback<
    React.Dispatch<React.SetStateAction<string[]>>
  >(
    (value) => {
      setBlockedDeviceIdsState((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        void saveSetting(SETTING_KEYS.blockedDeviceIds, next);
        return next;
      });
    },
    []
  );

  return {
    devices,
    setDevices,
    alerts,
    setAlerts,
    powerHistory,
    setPowerHistory,
    blockedDeviceIds: blockedDeviceIdsState,
    setBlockedDeviceIds,
    preferences,
    setPreference,
  };
}
