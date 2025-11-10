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
import { fetchDevices as apiFetchDevices, upsertDevice as apiUpsertDevice } from "@/api/devices";
import { useEnergyState } from "@/hooks/useEnergyState";
import { useOnboardingConfig, DEFAULT_BROKER_URL } from "@/hooks/useOnboardingConfig";
import { useMqttLifecycle } from "@/hooks/useMqttLifecycle";
import { useMqttSubscriptions } from "@/hooks/useMqttSubscriptions";
import { useAutomationRunner } from "@/hooks/useAutomationRunner";
import { useBudgetAlerts } from "@/hooks/useBudgetAlerts";
import type { Device, EnergyContextType } from "@/utils/energyContextTypes";

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

const MAX_POINTS = Number(import.meta.env?.VITE_MAX_CHART_POINTS || 120);
const ALERT_TTL_MINUTES = Number(import.meta.env?.VITE_ALERT_TTL_MINUTES || 5);

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
    homeId,
    setHomeId,
    currency,
    setCurrency,
    tariff,
    setTariff,
  } = useEnergyState();

  const { config: brokerConfig, refresh: refreshBrokerConfig } = useOnboardingConfig();
  const [connected, setConnected] = useState<boolean>(() => mqttService.isConnected());

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const override = Number(localStorage.getItem("alertTtlMins") || "");
        const ttl = override > 0 ? override : ALERT_TTL_MINUTES;
        const cutoff = Date.now() - ttl * 60_000;
        setAlerts((prev) => prev.filter((a) => Number(a.timestamp || 0) >= cutoff));
      } catch {
        // ignore
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, [setAlerts]);

  useEffect(() => {
    (async () => {
      try {
        const serverDevices = await apiFetchDevices();
        if (Array.isArray(serverDevices) && serverDevices.length > 0) {
          const filtered = (serverDevices as Device[]).filter(
            (d) => !blockedDeviceIds.includes(d.id)
          );
          setDevices(filtered);
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
      let customScenes: Array<{
        id: string;
        name: string;
        actions: Array<{ deviceId: string; turnOn: boolean }>;
      }> = [];
      try {
        customScenes = JSON.parse(localStorage.getItem("scenes") || "[]");
      } catch {
        customScenes = [];
      }
      const found = customScenes.find((s) => s.id === sceneId);
      if (found && Array.isArray(found.actions) && found.actions.length) {
        return found.actions;
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
    [devices, isEssential]
  );

  useAutomationRunner({
    devices,
    homeId,
    setDevices,
    setAlerts,
    computeSceneTargets,
  });

  useBudgetAlerts({ devices, tariff });

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
      homeId,
      currency,
      tariff,
      setHomeId,
      setCurrency,
      setTariff,
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
      homeId,
      currency,
      tariff,
      setHomeId,
      setCurrency,
      setTariff,
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
