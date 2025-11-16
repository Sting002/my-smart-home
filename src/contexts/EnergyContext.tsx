/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  mqttService,
} from "@/services/mqttService";
import {
  fetchDevices as apiFetchDevices,
  upsertDevice as apiUpsertDevice,
  removeDevice as apiRemoveDevice,
} from "@/api/devices";
import { useEnergyState } from "@/hooks/useEnergyState";
import { useOnboardingConfig, DEFAULT_BROKER_URL } from "@/hooks/useOnboardingConfig";
import { useMqttLifecycle } from "@/hooks/useMqttLifecycle";
import { useMqttSubscriptions } from "@/hooks/useMqttSubscriptions";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import { useDeviceGuards } from "@/hooks/useDeviceGuards";
import { getAlerts as fetchServerAlerts } from "@/api/history";
import type { Device, EnergyContextType } from "@/utils/energyContextTypes";

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

const MAX_POINTS = Number(import.meta.env?.VITE_MAX_CHART_POINTS || 120);

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const {
    devices,
    setDevices,
    alerts,
    setAlerts,
    powerHistory,
    setPowerHistory,
    blockedDeviceIds,
    setBlockedDeviceIds,
    preferences,
    setPreference,
  } = useEnergyState();

  const {
    homeId,
    currency,
    tariff,
    monthlyBudget,
    touEnabled,
    touPeakPrice,
    touOffpeakPrice,
    touOffpeakStart,
    touOffpeakEnd,
    alertTtlMinutes,
    scenes,
  } = preferences;

  const setHomeId = useCallback(
    (value: string) => setPreference("homeId", value),
    [setPreference]
  );
  const setCurrency = useCallback(
    (value: string) => setPreference("currency", value),
    [setPreference]
  );
  const setTariff = useCallback(
    (value: number) => setPreference("tariff", value),
    [setPreference]
  );
  const setMonthlyBudget = useCallback(
    (value: number) => setPreference("monthlyBudget", value),
    [setPreference]
  );
  const setTouEnabled = useCallback(
    (value: boolean) => setPreference("touEnabled", value),
    [setPreference]
  );
  const setTouPeakPrice = useCallback(
    (value: number) => setPreference("touPeakPrice", value),
    [setPreference]
  );
  const setTouOffpeakPrice = useCallback(
    (value: number) => setPreference("touOffpeakPrice", value),
    [setPreference]
  );
  const setTouOffpeakStart = useCallback(
    (value: string) => setPreference("touOffpeakStart", value),
    [setPreference]
  );
  const setTouOffpeakEnd = useCallback(
    (value: string) => setPreference("touOffpeakEnd", value),
    [setPreference]
  );
  const setAlertTtlMinutes = useCallback(
    (value: number) => setPreference("alertTtlMinutes", value),
    [setPreference]
  );

  const { config: brokerConfig, refresh: refreshBrokerConfig } = useOnboardingConfig();
  const [connected, setConnected] = useState<boolean>(() => mqttService.isConnected());

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const ttlMinutes = alertTtlMinutes > 0 ? alertTtlMinutes : 5;
        const cutoff = Date.now() - ttlMinutes * 60_000;
        setAlerts((prev) => prev.filter((a) => Number(a.timestamp || 0) >= cutoff));
      } catch (err) {
        console.warn("Failed to prune alerts", err);
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [alertTtlMinutes, setAlerts]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const serverAlerts = await fetchServerAlerts({ limit: 20 });
        if (!alive) return;
        setAlerts((prev) => {
          if (prev.length) return prev;
          return serverAlerts.map((alert) => ({
            id: alert.id,
            type:
              alert.severity === "danger"
                ? "critical"
                : alert.severity === "warning"
                ? "warning"
                : "info",
            message: alert.message,
            timestamp: alert.timestamp,
            deviceId: alert.device_id || undefined,
            payload: { ...alert, kind: "history" },
          }));
        });
      } catch (err) {
        console.warn("Failed to hydrate alerts from backend", err);
      }
    })();
    return () => {
      alive = false;
    };
  }, [setAlerts]);

  useEffect(() => {
    (async () => {
      try {
        const serverDevices = await apiFetchDevices();
        if (Array.isArray(serverDevices) && serverDevices.length > 0) {
          const filtered = (serverDevices as Device[]).filter(
            (d) => !blockedDeviceIds.includes(d.id)
          );
          setDevices((prev) => {
            const merged = filtered.map((server) => {
              const existing = prev.find((d) => d.id === server.id);
              if (!existing) return server;
              return {
                ...server,
                isOn: typeof existing.isOn === "boolean" ? existing.isOn : !!server.isOn,
                watts:
                  typeof existing.watts === "number"
                    ? existing.watts
                    : typeof server.watts === "number"
                    ? server.watts
                    : 0,
                kwhToday:
                  typeof existing.kwhToday === "number"
                    ? existing.kwhToday
                    : typeof server.kwhToday === "number"
                    ? server.kwhToday
                    : 0,
                lastSeen: existing.lastSeen ?? server.lastSeen ?? Date.now(),
              };
            });
            const leftovers = prev.filter(
              (localDevice) => !filtered.some((server) => server.id === localDevice.id)
            );
            return [...merged, ...leftovers];
          });
        }
      } catch (error) {
        if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
          console.warn("Device fetch from backend failed:", error);
        }
      }
    })();
  }, [blockedDeviceIds, setDevices]);

  useMqttLifecycle({
    brokerUrl: brokerConfig.brokerUrl || DEFAULT_BROKER_URL,
    enabled: brokerConfig.onboarded,
    onStatusChange: setConnected,
  });

  useMqttSubscriptions({
    enabled: connected,
    homeId,
    blockedDeviceIds,
    setDevices,
    setPowerHistory,
    setAlerts,
    maxPoints: MAX_POINTS,
  });

  const isEssential = useCallback(
    (name?: string, type?: string, id?: string) => {
      if (id) {
        const device = devices.find((d) => d.id === id);
        if (device && device.essential) return true;
      }
      const n = String(name || "").toLowerCase();
      const t = String(type || "").toLowerCase();
      return (
        n.includes("fridge") ||
        n.includes("refrigerator") ||
        t.includes("fridge") ||
        t.includes("refrigerator")
      );
    },
    [devices]
  );

  const computeSceneTargets = useCallback(
    (sceneId?: string) => {
      if (!sceneId) return [] as Array<{ deviceId: string; turnOn: boolean }>;
      const custom = scenes.find((s) => s.id === sceneId);
      if (custom) {
        const list = Array.isArray((custom as { actions?: unknown }).actions)
          ? ((custom as { actions: Array<{ deviceId: string; turnOn: boolean }> })
              .actions)
          : custom.targets;
        if (Array.isArray(list)) {
          return list.map((action) => {
            const device = devices.find((d) => d.id === action.deviceId);
            if (device?.essential && !action.turnOn) {
              return { ...action, turnOn: true };
            }
            return action;
          });
        }
      }
      switch (sceneId) {
        case "away":
        case "sleep":
        case "workday":
          return devices.map((d) => ({
            deviceId: d.id,
            turnOn: isEssential(d.name, d.type, d.id),
          }));
        case "weekend":
          return devices.map((d) => ({
            deviceId: d.id,
            turnOn: isEssential(d.name, d.type, d.id) ? true : d.isOn,
          }));
        default:
          return devices.map((d) => ({ deviceId: d.id, turnOn: d.isOn }));
      }
    },
    [devices, isEssential, scenes]
  );

  useBudgetAlerts({
    devices,
    tariff,
    monthlyBudget,
    touEnabled,
    touPeakPrice,
    touOffpeakPrice,
    touOffpeakStart,
    touOffpeakEnd,
  });

  useDeviceGuards({ devices, homeId, setDevices, setAlerts });

  const toggleDevice = useCallback(
    (deviceId: string) => {
      if (!mqttService.isConnected()) {
        toast({
          title: "Not connected to MQTT",
          description: "Command not sent. Check Settings → Broker URL.",
          action: (
            <ToastAction altText="Open Settings" onClick={() => navigate("/settings")}>
              Reconnect
            </ToastAction>
          ),
        });
        return;
      }

      const current = devices.find((d) => d.id === deviceId);
      if (!current) return;
      const nextOn = !current.isOn;

      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                isOn: nextOn,
                watts: nextOn ? d.watts : Math.min(d.watts, 1),
                lastSeen: Date.now(),
              }
            : d
        )
      );

      mqttService.publish(`home/${homeId}/cmd/${deviceId}/set`, { on: nextOn });
    },
    [devices, homeId, navigate, setDevices]
  );

  const updateDevice = useCallback(
    (deviceId: string, updates: Partial<Device>) => {
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, ...updates } : d))
      );
      try {
        const current = devices.find((d) => d.id === deviceId);
        if (current) {
          const next: Device = { ...current, ...updates } as Device;
          void apiUpsertDevice(next);
        }
      } catch {
        // ignore
      }
    },
    [devices, setDevices]
  );

  const addDevice = useCallback(
    (device: Device) => {
      setDevices((prev) => [...prev, device]);
      setBlockedDeviceIds((prev) => prev.filter((id) => id !== device.id));
      try {
        void apiUpsertDevice(device);
      } catch {
        // ignore
      }
    },
    [setDevices, setBlockedDeviceIds]
  );

  const removeDevice = useCallback(
    (deviceId: string) => {
      try {
        void apiRemoveDevice(deviceId);
      } catch (err) {
        console.warn("Failed to remove device from backend", err);
      }
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
      setPowerHistory((prev) => {
        const { [deviceId]: _removed, ...rest } = prev;
        return rest;
      });
      setAlerts((prev) => prev.filter((a) => a.deviceId !== deviceId));
      setBlockedDeviceIds((prev) =>
        prev.includes(deviceId) ? prev : [...prev, deviceId]
      );
    },
    [setDevices, setPowerHistory, setAlerts, setBlockedDeviceIds]
  );

  const value = useMemo<EnergyContextType>(
    () => ({
      devices,
      alerts,
      powerHistory,
      blockedDeviceIds,
      homeId,
      currency,
      tariff,
      monthlyBudget,
      touEnabled,
      touPeakPrice,
      touOffpeakPrice,
      touOffpeakStart,
      touOffpeakEnd,
      alertTtlMinutes,
      setHomeId,
      setCurrency,
      setTariff,
      setMonthlyBudget,
      setTouEnabled,
      setTouPeakPrice,
      setTouOffpeakPrice,
      setTouOffpeakStart,
      setTouOffpeakEnd,
      setAlertTtlMinutes,
      setBlockedDeviceIds,
      toggleDevice,
      updateDevice,
      addDevice,
      removeDevice,
      refreshBrokerConfig,
    }),
    [
      devices,
      alerts,
      powerHistory,
      blockedDeviceIds,
      homeId,
      currency,
      tariff,
      monthlyBudget,
      touEnabled,
      touPeakPrice,
      touOffpeakPrice,
      touOffpeakStart,
      touOffpeakEnd,
      alertTtlMinutes,
      setHomeId,
      setCurrency,
      setTariff,
      setMonthlyBudget,
      setTouEnabled,
      setTouPeakPrice,
      setTouOffpeakPrice,
      setTouOffpeakStart,
      setTouOffpeakEnd,
      setAlertTtlMinutes,
      setBlockedDeviceIds,
      toggleDevice,
      updateDevice,
      addDevice,
      removeDevice,
      refreshBrokerConfig,
    ]
  );

  return <EnergyContext.Provider value={value}>{children}</EnergyContext.Provider>;
};

export const useEnergy = (): EnergyContextType => {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error("useEnergy must be used within EnergyProvider");
  return ctx;
};
