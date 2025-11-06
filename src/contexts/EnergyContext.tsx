/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback, // ✅ FIX: added import
} from "react";
import { mqttService, type MqttMessageContext } from "../services/mqttService";
import type {
  Device,
  EnergyContextType,
  Alert,
  PowerHistoryMap,
} from "@/utils/energyContextTypes";

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

const MAX_POINTS = Number(import.meta.env?.VITE_MAX_CHART_POINTS || 120);
const DEFAULT_WS = import.meta.env?.VITE_MQTT_BROKER_URL || "ws://localhost:9001";

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>(() => {
    const stored = localStorage.getItem("devices");
    return stored ? (JSON.parse(stored) as Device[]) : [];
  });

  const [alerts, setAlerts] = useState<Alert[]>(() => {
    const stored = localStorage.getItem("alerts");
    return stored ? (JSON.parse(stored) as Alert[]) : [];
  });

  const [powerHistory, setPowerHistory] = useState<PowerHistoryMap>({});

  const [homeId, setHomeId] = useState(() => localStorage.getItem("homeId") || "home1");
  const [currency, setCurrency] = useState(() => localStorage.getItem("currency") || "USD");
  const [tariff, setTariff] = useState(() => {
    const stored = localStorage.getItem("tariff");
    return stored ? parseFloat(stored) : 0.12;
  });

  // Persist local data
  useEffect(() => localStorage.setItem("devices", JSON.stringify(devices)), [devices]);
  useEffect(() => localStorage.setItem("alerts", JSON.stringify(alerts)), [alerts]);
  useEffect(() => {
    localStorage.setItem("homeId", homeId);
    localStorage.setItem("currency", currency);
    localStorage.setItem("tariff", tariff.toString());
  }, [homeId, currency, tariff]);

  // Connect on mount if onboarded
  useEffect(() => {
    if (localStorage.getItem("onboarded") === "true") {
      const url = localStorage.getItem("brokerUrl") || DEFAULT_WS;
      mqttService.connect(url, { keepalive: 30 });
    }
  }, []);

  // === Wildcard MQTT Subscriptions ===
  useEffect(() => {
    const powerPattern = `home/${homeId}/sensor/+/power`;
    const energyPattern = `home/${homeId}/sensor/+/energy`;
    const alertPattern = `home/${homeId}/event/alert`;

    const onPower = (data: unknown, { topic }: MqttMessageContext) => {
      if (!data || typeof (data as Record<string, unknown>).watts !== "number") return;
      const d = data as { ts?: number; watts: number };
      const parts = topic.split("/");
      const deviceId = parts[4];
      if (!deviceId) return;

      setDevices((prev) => {
        const existing = prev.find((x) => x.id === deviceId);
        if (!existing) {
          return [
            ...prev,
            {
              id: deviceId,
              name: `Device ${deviceId}`,
              room: "Unknown",
              type: "default",
              isOn: d.watts > 5,
              watts: d.watts,
              kwhToday: 0,
              thresholdW: 1000,
              autoOffMins: 0,
              lastSeen: d.ts ?? Date.now(),
            },
          ];
        }
        return prev.map((x) =>
          x.id === deviceId
            ? { ...x, watts: d.watts, isOn: d.watts > 5, lastSeen: d.ts ?? Date.now() }
            : x
        );
      });

      setPowerHistory((prev) => {
        const list = prev[deviceId] ?? [];
        const next = [...list, { ts: d.ts ?? Date.now(), watts: d.watts }];
        return { ...prev, [deviceId]: next.slice(-MAX_POINTS) };
      });
    };

    const onEnergy = (data: unknown, { topic }: MqttMessageContext) => {
      if (!data || typeof (data as Record<string, unknown>).wh_total !== "number") return;
      const e = data as { wh_total: number };
      const deviceId = topic.split("/")[4];
      if (!deviceId) return;
      setDevices((prev) =>
        prev.map((x) => (x.id === deviceId ? { ...x, kwhToday: e.wh_total / 1000 } : x))
      );
    };

    const onAlert = (data: unknown) => {
      const payload = (data ?? {}) as Record<string, unknown>;
      const sevRaw = String(payload["severity"] ?? "info");
      const sev: Alert["type"] =
        sevRaw === "danger" ? "critical" : sevRaw === "warning" ? "warning" : "info";

      const alert: Alert = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: sev,
        message: String(payload["message"] ?? payload["type"] ?? "Alert"),
        timestamp: Number(payload["ts"] ?? Date.now()),
        deviceId:
          typeof payload["deviceId"] === "string"
            ? (payload["deviceId"] as string)
            : undefined,
        payload,
      };

      setAlerts((prev) => [alert, ...prev].slice(0, 50));
    };

    mqttService.subscribe(powerPattern, onPower);
    mqttService.subscribe(energyPattern, onEnergy);
    mqttService.subscribe(alertPattern, onAlert);

    return () => {
      mqttService.unsubscribe(powerPattern, onPower);
      mqttService.unsubscribe(energyPattern, onEnergy);
      mqttService.unsubscribe(alertPattern, onAlert);
    };
  }, [homeId]);

  // === Context Methods ===
  const toggleDevice = useCallback(
    (deviceId: string) => {
      const device = devices.find((d) => d.id === deviceId);
      if (device) {
        mqttService.publish(`home/${homeId}/cmd/${deviceId}/set`, { on: !device.isOn });
      }
    },
    [devices, homeId]
  );

  const updateDevice = (deviceId: string, updates: Partial<Device>) =>
    setDevices((prev) => prev.map((d) => (d.id === deviceId ? { ...d, ...updates } : d)));

  const addDevice = (device: Device) => setDevices((prev) => [...prev, device]);

  const value = useMemo<EnergyContextType>(
    () => ({
      devices,
      alerts,
      powerHistory,
      homeId,
      currency,
      tariff,
      setHomeId,
      setTariff,
      setCurrency,
      toggleDevice,
      updateDevice,
      addDevice,
    }),
    [devices, alerts, powerHistory, homeId, currency, tariff, toggleDevice]
  );

  return <EnergyContext.Provider value={value}>{children}</EnergyContext.Provider>;
};

export const useEnergy = () => {
  const context = useContext(EnergyContext);
  if (!context) throw new Error("useEnergy must be used within EnergyProvider");
  return context;
};
