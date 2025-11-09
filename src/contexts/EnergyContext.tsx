/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  mqttService,
  type MqttMessageContext,
  type MqttStatus,
} from "@/services/mqttService";
import type {
  Device,
  EnergyContextType,
  Alert,
  PowerHistoryMap,
} from "@/utils/energyContextTypes";

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

// Chart memory
const MAX_POINTS = Number(import.meta.env?.VITE_MAX_CHART_POINTS || 120);
// Default broker if none saved during onboarding
const DEFAULT_WS =
  import.meta.env?.VITE_MQTT_BROKER_URL || "ws://localhost:9001/mqtt";

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // ===== Local persistent state =====
  const [devices, setDevices] = useState<Device[]>(() => {
    const stored = localStorage.getItem("devices");
    return stored ? (JSON.parse(stored) as Device[]) : [];
  });

  const [alerts, setAlerts] = useState<Alert[]>(() => {
    const stored = localStorage.getItem("alerts");
    return stored ? (JSON.parse(stored) as Alert[]) : [];
  });

  const [powerHistory, setPowerHistory] = useState<PowerHistoryMap>({});

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

  // Track live connection status so we can (re)subscribe when ready
  const [connected, setConnected] = useState<boolean>(
    () => mqttService.isConnected()
  );

  // ===== Persist some state to localStorage =====
  useEffect(() => {
    localStorage.setItem("devices", JSON.stringify(devices));
  }, [devices]);

  useEffect(() => {
    localStorage.setItem("alerts", JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    localStorage.setItem("homeId", homeId);
    localStorage.setItem("currency", currency);
    localStorage.setItem("tariff", tariff.toString());
  }, [homeId, currency, tariff]);

  // ===== Connect to MQTT when onboarded and broker URL changes =====
  useEffect(() => {
    const onboarded = localStorage.getItem("onboarded") === "true";
    const url = localStorage.getItem("brokerUrl") || DEFAULT_WS;
    if (!onboarded) return;

    if (!mqttService.isConnected()) {
      mqttService.connect(url, { keepalive: 30, reconnectPeriod: 1000 });
    }

    // Listen for connection status changes to trigger (re)subscriptions
    const onStatus = (status: MqttStatus) => {
      setConnected(status === "connected");
    };
    mqttService.onStatusChange(onStatus);

    // Seed current state
    setConnected(mqttService.isConnected());

    return () => {
      mqttService.offStatusChange(onStatus);
    };
  }, [
    // Re-evaluate when onboarding flag or broker URL change on re-render
    localStorage.getItem("onboarded"),
    localStorage.getItem("brokerUrl") || DEFAULT_WS,
  ]);

  // ===== Subscription wiring (runs only when connected and when homeId changes) =====
  useEffect(() => {
    if (!connected) return;

    // Topics for this home
    const powerPattern = `home/${homeId}/sensor/+/power`;
    const energyPattern = `home/${homeId}/sensor/+/energy`;
    const alertPattern = `home/${homeId}/event/alert`;

    // ---- Handlers ----
    const onPower = (data: unknown, { topic }: MqttMessageContext) => {
      // Expect { ts?: number, watts: number }
      if (
        !data ||
        typeof (data as Record<string, unknown>).watts !== "number"
      )
        return;

      const d = data as { ts?: number; watts: number };
      const parts = topic.split("/");
      // home / <homeId> / sensor / <deviceId> / power
      const deviceId = parts[4];
      if (!deviceId) return;

      setDevices((prev) => {
        const existing = prev.find((x) => x.id === deviceId);
        if (!existing) {
          // First time we see this device, create a placeholder entry
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
            ? {
                ...x,
                watts: d.watts,
                isOn: d.watts > 5,
                lastSeen: d.ts ?? Date.now(),
              }
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
      // Expect { wh_total: number }
      if (
        !data ||
        typeof (data as Record<string, unknown>).wh_total !== "number"
      )
        return;

      const e = data as { wh_total: number };
      const deviceId = topic.split("/")[4];
      if (!deviceId) return;

      setDevices((prev) =>
        prev.map((x) =>
          x.id === deviceId ? { ...x, kwhToday: e.wh_total / 1000 } : x
        )
      );
    };

    const onAlert = (data: unknown) => {
      // Expected: { ts, deviceId?, severity: "info"|"warning"|"danger", message, type? }
      const payload = (data ?? {}) as Record<string, unknown>;
      const sevRaw = String(payload["severity"] ?? "info");
      const sev: Alert["type"] =
        sevRaw === "danger"
          ? "critical"
          : sevRaw === "warning"
          ? "warning"
          : "info";

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

    // Subscribe when connected
    mqttService.subscribe(powerPattern, onPower);
    mqttService.subscribe(energyPattern, onEnergy);
    mqttService.subscribe(alertPattern, onAlert);

    // Cleanup on homeId change or unmount
    return () => {
      mqttService.unsubscribe(powerPattern, onPower);
      mqttService.unsubscribe(energyPattern, onEnergy);
      mqttService.unsubscribe(alertPattern, onAlert);
    };
  }, [connected, homeId]);

  // ===== Public actions =====
  const toggleDevice = useCallback(
    (deviceId: string) => {
      const device = devices.find((d) => d.id === deviceId);
      if (!device) return;
      mqttService.publish(`home/${homeId}/cmd/${deviceId}/set`, {
        on: !device.isOn,
      });
    },
    [devices, homeId]
  );

  const updateDevice = useCallback(
    (deviceId: string, updates: Partial<Device>) => {
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, ...updates } : d))
      );
    },
    []
  );

  const addDevice = useCallback((device: Device) => {
    setDevices((prev) => [...prev, device]);
  }, []);

  // ===== Context value =====
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
    [
      devices,
      alerts,
      powerHistory,
      homeId,
      currency,
      tariff,
      toggleDevice,
      updateDevice,
      addDevice,
    ]
  );

  return (
    <EnergyContext.Provider value={value}>{children}</EnergyContext.Provider>
  );
};

export const useEnergy = (): EnergyContextType => {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error("useEnergy must be used within EnergyProvider");
  return ctx;
};
