import { createElement, useCallback, useEffect, useRef } from "react";
import { mqttService } from "@/services/mqttService";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { Device, Alert } from "@/utils/energyContextTypes";
import { useNavigate } from "react-router-dom";

type Rule = {
  id: string;
  deviceId: string;
  thresholdW: number;
  minutes: number;
  action: string;
  sceneId?: string;
  lastTriggered?: number;
};

type Args = {
  devices: Device[];
  homeId: string;
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  computeSceneTargets: (sceneId?: string) => Array<{
    deviceId: string;
    turnOn: boolean;
  }>;
};

function useRulesPersistence() {
  const loadRules = useCallback((): Rule[] => {
    try {
      return JSON.parse(localStorage.getItem("rules") || "[]");
    } catch {
      return [];
    }
  }, []);

  const saveRules = useCallback((rules: Rule[]) => {
    localStorage.setItem("rules", JSON.stringify(rules));
  }, []);

  return { loadRules, saveRules };
}

export function useAutomationRunner({
  devices,
  homeId,
  setDevices,
  setAlerts,
  computeSceneTargets,
}: Args) {
  const navigate = useNavigate();
  const { loadRules, saveRules } = useRulesPersistence();

  const renderReconnectAction = useCallback(
    () =>
      createElement(
        ToastAction,
        {
          altText: "Open Settings",
          onClick: () => navigate("/settings"),
        },
        "Reconnect"
      ),
    [navigate]
  );

  const exceedSinceRef = useRef<Record<string, number>>({});
  const triggeredRef = useRef<Record<string, boolean>>({});
  const lowSinceRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const rules = loadRules();
      let updatedRules = false;

      for (const rule of rules) {
        const device = devices.find((d) => d.id === rule.deviceId);
        if (!device) {
          delete exceedSinceRef.current[rule.id];
          delete triggeredRef.current[rule.id];
          continue;
        }

        if (device.watts > (Number(rule.thresholdW) || 0)) {
          if (!exceedSinceRef.current[rule.id]) exceedSinceRef.current[rule.id] = now;
          const elapsedMins = (now - exceedSinceRef.current[rule.id]) / 60000;
          if (elapsedMins >= (Number(rule.minutes) || 0) && !triggeredRef.current[rule.id]) {
            if (rule.action === "notify") {
              toast({
                title: "Automation triggered",
                description: `${device.name} > ${rule.thresholdW}W for ${rule.minutes} min`,
              });
            } else if (rule.action === "turnOff") {
              if (!mqttService.isConnected()) {
                toast({
                  title: "Not connected to MQTT",
                  description: `Cannot turn off ${device.name}. Check Settings -> Broker URL.`,
                  action: renderReconnectAction(),
                });
              } else {
                setDevices((prev) =>
                  prev.map((d) =>
                    d.id === device.id ? { ...d, isOn: false, watts: Math.min(d.watts, 1) } : d
                  )
                );
                mqttService.publish(`home/${homeId}/cmd/${device.id}/set`, { on: false });
              }
            } else if (rule.action === "activateScene") {
              const targets = computeSceneTargets(rule.sceneId);
              if (!mqttService.isConnected()) {
                toast({
                  title: "Not connected to MQTT",
                  description: `Cannot activate scene. Check Settings -> Broker URL.`,
                  action: renderReconnectAction(),
                });
              } else {
                for (const target of targets) {
                  setDevices((prev) =>
                    prev.map((d) =>
                      d.id === target.deviceId
                        ? {
                            ...d,
                            isOn: target.turnOn,
                            watts: target.turnOn ? d.watts : Math.min(d.watts, 1),
                          }
                        : d
                    )
                  );
                  mqttService.publish(`home/${homeId}/cmd/${target.deviceId}/set`, {
                    on: target.turnOn,
                  });
                }
                toast({ title: "Scene activated", description: rule.sceneId || "scene" });
              }
            }

            triggeredRef.current[rule.id] = true;
            rule.lastTriggered = now;
            updatedRules = true;
          }
        } else {
          delete exceedSinceRef.current[rule.id];
          delete triggeredRef.current[rule.id];
        }
      }

      if (updatedRules) saveRules(rules);

      for (const device of devices) {
        const thresh = Number(device.thresholdW || 0);
        const mins = Number(device.autoOffMins || 0);
        if (!device.isOn || !mins || !thresh) {
          delete lowSinceRef.current[device.id];
          continue;
        }
        if (device.watts < thresh) {
          if (!lowSinceRef.current[device.id]) lowSinceRef.current[device.id] = now;
          const elapsed = (now - (lowSinceRef.current[device.id] || now)) / 60000;
          if (elapsed >= mins) {
            if (!mqttService.isConnected()) {
              toast({
                title: "Standby kill blocked",
                description: `Cannot turn off ${device.name} (not connected)`,
              });
            } else {
              setDevices((prev) =>
                prev.map((d) =>
                  d.id === device.id ? { ...d, isOn: false, watts: Math.min(d.watts, 1) } : d
                )
              );
              mqttService.publish(`home/${homeId}/cmd/${device.id}/set`, { on: false });
              toast({
                title: "Standby kill",
                description: `${device.name} turned off after ${mins} min < ${thresh}W`,
              });
            }
            delete lowSinceRef.current[device.id];
          }
        } else {
          delete lowSinceRef.current[device.id];
        }
      }

      for (const device of devices) {
        const offlineFor = now - Number(device.lastSeen || 0);
        if (offlineFor > 5 * 60 * 1000) {
          const message = `${device.name} appears offline (${Math.floor(offlineFor / 60000)} min)`;
          const alert: Alert = {
            id: `device:${device.id}`,
            type: "warning",
            message,
            timestamp: now,
            deviceId: device.id,
            payload: { lastSeen: device.lastSeen, kind: "offline" },
          };
          setAlerts((prev) => {
            const rest = prev.filter((a) => a.deviceId !== device.id);
            return [alert, ...rest].slice(0, 50);
          });
        } else {
          setAlerts((prev) =>
            prev.filter((alert) => {
              if (alert.deviceId !== device.id) return true;
              const payloadKind =
                typeof alert.payload === "object" &&
                alert.payload !== null &&
                "kind" in alert.payload
                  ? (alert.payload as { kind?: unknown }).kind
                  : undefined;
              return payloadKind !== "offline";
            })
          );
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [computeSceneTargets, devices, homeId, loadRules, navigate, renderReconnectAction, saveRules, setAlerts, setDevices]);
}
