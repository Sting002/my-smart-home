/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  mqttService,
  type MqttMessageContext,
  type MqttStatus,
} from "@/services/mqttService";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";
import type {
  Device,
  EnergyContextType,
  Alert,
  PowerHistoryMap,
} from "@/utils/energyContextTypes";
import { fetchDevices as apiFetchDevices, upsertDevice as apiUpsertDevice } from "@/api/devices";

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

// Chart memory
const MAX_POINTS = Number(import.meta.env?.VITE_MAX_CHART_POINTS || 120);
// Default broker if none saved during onboarding
const DEFAULT_WS =
  import.meta.env?.VITE_MQTT_BROKER_URL || "ws://localhost:9001/mqtt";

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
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

  // Track devices the user explicitly deleted so they don't reappear from MQTT
  const [blockedDeviceIds, setBlockedDeviceIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("blockedDevices") || "[]");
    } catch {
      return [] as string[];
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

  // Track live connection status so we can (re)subscribe when ready
  const [connected, setConnected] = useState<boolean>(
    () => mqttService.isConnected()
  );

  // ===== Persist some state to localStorage =====
  useEffect(() => {
    localStorage.setItem("devices", JSON.stringify(devices));
  }, [devices]);

  useEffect(() => {
    localStorage.setItem("blockedDevices", JSON.stringify(blockedDeviceIds));
  }, [blockedDeviceIds]);

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

  // ===== Fetch devices from backend on mount (if authenticated) =====
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
      } catch (e) {
        // Not fatal (unauthenticated or backend offline)
        if (import.meta.env?.VITE_DEBUG_MQTT === "true") {
          console.warn("Device fetch from backend failed:", e);
        }
      }
    })();
  }, [blockedDeviceIds]);

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

      // Ignore messages for devices the user deleted
      if (blockedDeviceIds.includes(deviceId)) return;

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

      if (blockedDeviceIds.includes(deviceId)) return;

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

      // Optimistic update for immediate UI feedback
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId
            ? {
                ...d,
                isOn: nextOn,
                // If turning off, drop displayed watts to a small idle value until next reading
                watts: nextOn ? d.watts : Math.min(d.watts, 1),
              }
            : d
        )
      );

      // Send command over MQTT
      mqttService.publish(`home/${homeId}/cmd/${deviceId}/set`, {
        on: nextOn,
      });
    },
    [devices, homeId]
  );

  const updateDevice = useCallback(
    (deviceId: string, updates: Partial<Device>) => {
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, ...updates } : d))
      );
      // Best-effort persist to backend (ignore errors silently)
      try {
        const updated = devices.find((d) => d.id === deviceId);
        if (updated) {
          const out: Device = { ...updated, ...updates } as Device;
          void apiUpsertDevice(out);
        }
      } catch {}
    },
    [devices]
  );

  const addDevice = useCallback((device: Device) => {
    setDevices((prev) => [...prev, device]);
    try {
      void apiUpsertDevice(device);
    } catch {}
    // If user previously deleted this device, un-block it now that it is explicitly added
    setBlockedDeviceIds((prev) => prev.filter((id) => id !== device.id));
  }, []);

  const removeDevice = useCallback((deviceId: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    // Drop power history for the device
    setPowerHistory((prev) => {
      const { [deviceId]: _omit, ...rest } = prev;
      return rest;
    });
    // Prevent auto-recreate from incoming MQTT messages
    setBlockedDeviceIds((prev) => (prev.includes(deviceId) ? prev : [...prev, deviceId]));
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
      removeDevice,
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
      removeDevice,
    ]
  );

  // ===== Background Rule Runner =====
  const exceedSinceRef = useRef<Record<string, number>>({});
  const triggeredRef = useRef<Record<string, boolean>>({});

  const loadRules = useCallback((): Array<
    { id: string; deviceId: string; thresholdW: number; minutes: number; action: string; sceneId?: string; lastTriggered?: number }
  > => {
    try {
      return JSON.parse(localStorage.getItem("rules") || "[]");
    } catch {
      return [];
    }
  }, []);

  const saveRulesBack = useCallback((rules: ReturnType<typeof loadRules>) => {
    localStorage.setItem("rules", JSON.stringify(rules));
  }, []);

  const isEssential = useCallback((name?: string, type?: string) => {
    const n = String(name || "").toLowerCase();
    const t = String(type || "").toLowerCase();
    return n.includes("fridge") || n.includes("refrigerator") || t.includes("fridge") || t.includes("refrigerator");
  }, []);

  const computeSceneTargets = useCallback(
    (sceneId?: string) => {
      if (!sceneId) return [] as Array<{ deviceId: string; turnOn: boolean }>;
      // Try custom scenes first
      let custom: Array<{ id: string; name: string; actions: Array<{ deviceId: string; turnOn: boolean }> }> = [];
      try {
        custom = JSON.parse(localStorage.getItem("scenes") || "[]");
      } catch {
        custom = [];
      }
      const found = custom.find((s) => s.id === sceneId);
      if (found && Array.isArray(found.actions) && found.actions.length) return found.actions;
      // Built-in defaults
      switch (sceneId) {
        case "away":
        case "sleep":
        case "workday":
          return devices.map((d) => ({ deviceId: d.id, turnOn: isEssential(d.name, d.type) }));
        case "weekend":
          return devices.map((d) => ({ deviceId: d.id, turnOn: isEssential(d.name, d.type) ? true : d.isOn }));
        default:
          return devices.map((d) => ({ deviceId: d.id, turnOn: d.isOn }));
      }
    },
    [devices, isEssential]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const rules = loadRules();
      let updated = false;

      for (const r of rules) {
        const device = devices.find((d) => d.id === r.deviceId);
        if (!device) {
          delete exceedSinceRef.current[r.id];
          delete triggeredRef.current[r.id];
          continue;
        }

        if (device.watts > (Number(r.thresholdW) || 0)) {
          if (!exceedSinceRef.current[r.id]) exceedSinceRef.current[r.id] = now;
          const elapsedMins = (now - exceedSinceRef.current[r.id]) / 60000;
          if (elapsedMins >= (Number(r.minutes) || 0)) {
            if (!triggeredRef.current[r.id]) {
              // Fire action
              if (r.action === "notify") {
                toast({
                  title: "Automation triggered",
                  description: `${device.name} > ${r.thresholdW}W for ${r.minutes} min`,
                });
              } else if (r.action === "turnOff") {
                if (!mqttService.isConnected()) {
                  toast({
                    title: "Not connected to MQTT",
                    description: `Cannot turn off ${device.name}. Check Settings → Broker URL.`,
                    action: (
                      <ToastAction altText="Open Settings" onClick={() => navigate("/settings")}>
                        Reconnect
                      </ToastAction>
                    ),
                  });
                } else {
                  setDevices((prev) => prev.map((d) => (d.id === device.id ? { ...d, isOn: false, watts: Math.min(d.watts, 1) } : d)));
                  mqttService.publish(`home/${homeId}/cmd/${device.id}/set`, { on: false });
                }
              } else if (r.action === "activateScene") {
                const targets = computeSceneTargets(r.sceneId);
                if (!mqttService.isConnected()) {
                  toast({
                    title: "Not connected to MQTT",
                    description: `Cannot activate scene. Check Settings → Broker URL.`,
                    action: (
                      <ToastAction altText="Open Settings" onClick={() => navigate("/settings")}>
                        Reconnect
                      </ToastAction>
                    ),
                  });
                } else {
                  for (const t of targets) {
                    const dev = devices.find((d) => d.id === t.deviceId);
                    if (!dev) continue;
                    setDevices((prev) => prev.map((d) => (d.id === t.deviceId ? { ...d, isOn: t.turnOn, watts: t.turnOn ? d.watts : Math.min(d.watts, 1) } : d)));
                    mqttService.publish(`home/${homeId}/cmd/${t.deviceId}/set`, { on: t.turnOn });
                  }
                  toast({ title: "Scene activated", description: r.sceneId || "scene" });
                }
              }

              triggeredRef.current[r.id] = true;
              r.lastTriggered = now;
              updated = true;
            }
          }
        } else {
          // Reset when device drops below threshold
          delete exceedSinceRef.current[r.id];
          delete triggeredRef.current[r.id];
        }
      }

      if (updated) saveRulesBack(rules);
    }, 5000);

    return () => clearInterval(interval);
  }, [devices, homeId, loadRules, saveRulesBack, computeSceneTargets, navigate]);

  return (
    <EnergyContext.Provider value={value}>{children}</EnergyContext.Provider>
  );
};

export const useEnergy = (): EnergyContextType => {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error("useEnergy must be used within EnergyProvider");
  return ctx;
};
