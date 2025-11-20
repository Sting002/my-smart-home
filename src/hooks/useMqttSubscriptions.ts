import { useEffect } from "react";
import { mqttService, type MqttMessageContext } from "@/services/mqttService";
import type { Alert, Device, PowerHistoryMap } from "@/utils/energyContextTypes";
import { toMillis } from "@/utils/time";

type Args = {
  enabled: boolean;
  homeId: string;
  blockedDeviceIds: string[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  setPowerHistory: React.Dispatch<React.SetStateAction<PowerHistoryMap>>;
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  maxPoints: number;
};

export function useMqttSubscriptions({
  enabled,
  homeId,
  blockedDeviceIds,
  setDevices,
  setPowerHistory,
  setAlerts,
  maxPoints,
}: Args) {
  useEffect(() => {
    if (!enabled) return;

    const powerPattern = `home/${homeId}/sensor/+/power`;
    const energyPattern = `home/${homeId}/sensor/+/energy`;
    const alertPattern = `home/${homeId}/event/alert`;

    const getDeviceId = (topic: string) => {
      const parts = topic.split("/");
      return parts.length >= 4 ? parts[3] : "";
    };

    const onPower = (data: unknown, { topic }: MqttMessageContext) => {
      if (!data || typeof (data as Record<string, unknown>).watts !== "number")
        return;

      const reading = data as { ts?: number | string; watts: number };
      const ts = toMillis(reading.ts, Date.now());
      const deviceId = getDeviceId(topic);
      if (!deviceId || blockedDeviceIds.includes(deviceId)) return;

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
              isOn: reading.watts > 5,
              watts: reading.watts,
              kwhToday: 0,
              thresholdW: 1000,
              autoOffMins: 0,
              lastSeen: ts,
            },
          ];
        }
        return prev.map((x) =>
          x.id === deviceId
            ? {
                ...x,
                watts: reading.watts,
                isOn: reading.watts > 5,
                lastSeen: ts,
              }
            : x
        );
      });

      setPowerHistory((prev) => {
        const list = prev[deviceId] ?? [];
        const next = [...list, { ts, watts: reading.watts }];
        return { ...prev, [deviceId]: next.slice(-maxPoints) };
      });
    };

    const onEnergy = (data: unknown, { topic }: MqttMessageContext) => {
      if (!data || typeof (data as Record<string, unknown>).wh_total !== "number")
        return;

      const energy = data as { wh_total: number };
      const deviceId = getDeviceId(topic);
      if (!deviceId || blockedDeviceIds.includes(deviceId)) return;

      setDevices((prev) =>
        prev.map((x) =>
          x.id === deviceId ? { ...x, kwhToday: energy.wh_total / 1000 } : x
        )
      );
    };

    const onAlert = (data: unknown) => {
      const payload = (data ?? {}) as Record<string, unknown>;
      const severity = String(payload["severity"] ?? "info");
      const type: Alert["type"] =
        severity === "danger"
          ? "critical"
          : severity === "warning"
          ? "warning"
          : "info";

      const deviceId =
        typeof payload["deviceId"] === "string"
          ? (payload["deviceId"] as string)
          : undefined;
      if (deviceId && blockedDeviceIds.includes(deviceId)) return;

      const id = deviceId
        ? `device:${deviceId}`
        : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const alert: Alert = {
        id,
        type,
        message: String(payload["message"] ?? payload["type"] ?? "Alert"),
        timestamp: Number(payload["ts"] ?? Date.now()),
        deviceId,
        payload: { ...payload, kind: "mqtt" },
      };

      if (deviceId) {
        setAlerts((prev) => {
          const rest = prev.filter((a) => a.deviceId !== deviceId);
          return [alert, ...rest].slice(0, 50);
        });
      } else {
        setAlerts((prev) => [alert, ...prev].slice(0, 50));
      }
    };

    mqttService.subscribe(powerPattern, onPower);
    mqttService.subscribe(energyPattern, onEnergy);
    mqttService.subscribe(alertPattern, onAlert);

    return () => {
      mqttService.unsubscribe(powerPattern, onPower);
      mqttService.unsubscribe(energyPattern, onEnergy);
      mqttService.unsubscribe(alertPattern, onAlert);
    };
  }, [
    enabled,
    homeId,
    blockedDeviceIds,
    setDevices,
    setPowerHistory,
    setAlerts,
    maxPoints,
  ]);
}
