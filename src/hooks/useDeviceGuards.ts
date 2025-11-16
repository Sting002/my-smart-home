import { useEffect, useRef } from "react";
import type { Alert, Device } from "@/utils/energyContextTypes";
import { mqttService } from "@/services/mqttService";
import { toast } from "@/hooks/use-toast";

type Args = {
  devices: Device[];
  homeId: string;
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
};

export function useDeviceGuards({
  devices,
  homeId,
  setDevices,
  setAlerts,
}: Args) {
  const lowSinceRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      for (const device of devices) {
        const threshold = Number(device.thresholdW || 0);
        const minutes = Number(device.autoOffMins || 0);
        if (!device.isOn || !minutes || !threshold) {
          delete lowSinceRef.current[device.id];
          continue;
        }
        if (device.watts < threshold) {
          if (!lowSinceRef.current[device.id]) {
            lowSinceRef.current[device.id] = now;
          }
          const elapsed = (now - (lowSinceRef.current[device.id] || now)) / 60000;
          if (elapsed >= minutes) {
            if (mqttService.isConnected()) {
              setDevices((prev) =>
                prev.map((d) =>
                  d.id === device.id
                    ? { ...d, isOn: false, watts: Math.min(d.watts, 1) }
                    : d
                )
              );
              mqttService.publish(`home/${homeId}/cmd/${device.id}/set`, { on: false });
            }
            toast({
              title: "Standby kill",
              description: `${device.name} turned off after ${minutes} min below ${threshold}W`,
            });
            delete lowSinceRef.current[device.id];
          }
        } else {
          delete lowSinceRef.current[device.id];
        }
      }

      for (const device of devices) {
        const lastSeen = Number(device.lastSeen || 0);
        if (!lastSeen) continue;
        const offlineFor = now - lastSeen;
        const wasRecentlySeen = offlineFor < 2 * 60 * 60 * 1000;
        if (offlineFor > 5 * 60 * 1000 && wasRecentlySeen) {
          const alert: Alert = {
            id: `device:${device.id}`,
            type: "warning",
            message: `${device.name} appears offline (${Math.floor(
              offlineFor / 60000
            )} min)`,
            timestamp: now,
            deviceId: device.id,
            payload: { lastSeen, kind: "offline" },
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
  }, [devices, homeId, setAlerts, setDevices]);
}
