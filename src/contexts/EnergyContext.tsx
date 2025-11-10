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
                // Bump lastSeen for immediate online/offline UI responsiveness
                lastSeen: Date.now(),
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
  // Standby kill tracking (below-threshold duration)
  const lowSinceRef = useRef<Record<string, number>>({});
  // Device offline alert tracking (debounce)
  const offlineNotifiedRef = useRef<Record<string, number>>({});

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

  const isEssential = useCallback((name?: string, type?: string, id?: string) => {
    // If device has explicit essential flag, prefer it
    if (id) {
      const dev = devices.find((d) => d.id === id);
      if (dev && dev.essential === true) return true;
    }
    const n = String(name || "").toLowerCase();
    const t = String(type || "").toLowerCase();
    return n.includes("fridge") || n.includes("refrigerator") || t.includes("fridge") || t.includes("refrigerator");
  }, [devices]);

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
          return devices.map((d) => ({ deviceId: d.id, turnOn: isEssential(d.name, d.type, d.id) }));
        case "weekend":
          return devices.map((d) => ({ deviceId: d.id, turnOn: isEssential(d.name, d.type, d.id) ? true : d.isOn }));
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

      // ---- Standby Kill (uses device.thresholdW and autoOffMins) ----
      for (const d of devices) {
        const thresh = Number(d.thresholdW || 0);
        const mins = Number(d.autoOffMins || 0);
        if (!d.isOn || !mins || !thresh) {
          delete lowSinceRef.current[d.id];
          continue;
        }
        if (d.watts < thresh) {
          if (!lowSinceRef.current[d.id]) lowSinceRef.current[d.id] = now;
          const elapsed = (now - (lowSinceRef.current[d.id] || now)) / 60000;
          if (elapsed >= mins) {
            if (!mqttService.isConnected()) {
              toast({ title: "Standby kill blocked", description: `Cannot turn off ${d.name} (not connected)` });
            } else {
              setDevices((prev) => prev.map((x) => (x.id === d.id ? { ...x, isOn: false, watts: Math.min(x.watts, 1) } : x)));
              mqttService.publish(`home/${homeId}/cmd/${d.id}/set`, { on: false });
              toast({ title: "Standby kill", description: `${d.name} turned off after ${mins} min < ${thresh}W` });
            }
            delete lowSinceRef.current[d.id];
          }
        } else {
          delete lowSinceRef.current[d.id];
        }
      }

      // ---- Device Health Alerts (offline > 5 min) ----
      for (const d of devices) {
        const offlineFor = now - (Number(d.lastSeen || 0));
        if (offlineFor > 5 * 60 * 1000) {
          const last = offlineNotifiedRef.current[d.id] || 0;
          if (now - last > 15 * 60 * 1000) {
            offlineNotifiedRef.current[d.id] = now;
            const alert = {
              id: `${now}_${d.id}_offline`,
              type: "warning" as const,
              message: `${d.name} appears offline (${Math.floor(offlineFor / 60000)} min)`,
              timestamp: now,
              deviceId: d.id,
              payload: { lastSeen: d.lastSeen },
            };
            setAlerts((prev) => [alert, ...prev].slice(0, 50));
          }
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [devices, homeId, loadRules, saveRulesBack, computeSceneTargets, navigate]);

  // ---- Budget Alerts (simple daily heuristic) ----
  useEffect(() => {
    const timer = setInterval(() => {
      try {
        const budgetMonthly = Number(localStorage.getItem("monthlyBudget") || 0) || 0;
        if (!budgetMonthly) return;
        const budgetDaily = budgetMonthly / 30;
        // Price: use TOU if enabled, else flat tariff
        const touEnabled = localStorage.getItem("touEnabled") === "true";
        const priceNow = (() => {
          if (!touEnabled) return tariff;
          const peak = Number(localStorage.getItem("touPeakPrice") || tariff) || tariff;
          const offp = Number(localStorage.getItem("touOffpeakPrice") || tariff) || tariff;
          const start = String(localStorage.getItem("touOffpeakStart") || "22:00");
          const end = String(localStorage.getItem("touOffpeakEnd") || "06:00");
          const t = new Date();
          const mins = t.getHours() * 60 + t.getMinutes();
          const toM = (s: string) => {
            const [hh, mm] = s.split(":").map((x) => Number(x));
            return hh * 60 + (mm || 0);
          };
          const sM = toM(start), eM = toM(end);
          const inOff = sM < eM ? (mins >= sM && mins < eM) : (mins >= sM || mins < eM);
          return inOff ? offp : peak;
        })();
        const todayKwh = devices.reduce((sum, d) => sum + Number(d.kwhToday || 0), 0);
        const todayCost = todayKwh * priceNow;
        const ratio = todayCost / budgetDaily;
        if (ratio >= 1.0) {
          toast({ title: "Budget reached", description: `Today's usage ~${todayCost.toFixed(2)} over daily budget` });
        } else if (ratio >= 0.9) {
          toast({ title: "Budget 90%", description: `Today's usage ~${todayCost.toFixed(2)} near daily budget` });
        } else if (ratio >= 0.75) {
          toast({ title: "Budget 75%", description: `Today's usage ~${todayCost.toFixed(2)}` });
        }
      } catch {}
    }, 60000);
    return () => clearInterval(timer);
  }, [devices, tariff]);

  return (
    <EnergyContext.Provider value={value}>{children}</EnergyContext.Provider>
  );
};

export const useEnergy = (): EnergyContextType => {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error("useEnergy must be used within EnergyProvider");
  return ctx;
};
