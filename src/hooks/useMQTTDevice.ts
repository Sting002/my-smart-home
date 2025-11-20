import { useEffect, useRef } from "react";
import { mqttService, PowerReading, EnergyReading } from "../services/mqttService";
import { useEnergy } from "../contexts/EnergyContext";
import { toMillis } from "@/utils/time";

export const useMQTTDevice = (deviceId: string) => {
  const { homeId, updateDevice, addDevice, devices } = useEnergy();
  const devicesRef = useRef(devices);
  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    const powerCallback = (data: PowerReading) => {
      const device = devicesRef.current.find((d) => d.id === deviceId);

      if (!device) {
        addDevice({
          id: deviceId,
          name: `Device ${deviceId}`,
          room: "Unknown",
          type: "default",
          isOn: data.watts > 5,
          watts: data.watts,
          kwhToday: 0,
          thresholdW: 1000,
          autoOffMins: 0,
          lastSeen: toMillis(data.ts, Date.now()),
        });
      } else {
        updateDevice(deviceId, {
          watts: data.watts,
          isOn: data.watts > 5,
          lastSeen: toMillis(data.ts, Date.now()),
        });
      }
    };

    const energyCallback = (data: EnergyReading) => {
      const kwhToday = data.wh_total / 1000;
      updateDevice(deviceId, { kwhToday });
    };

    // Use stable callbacks so unsubscribe works correctly
    const onPower = (payload: unknown) => powerCallback(payload as PowerReading);
    const onEnergy = (payload: unknown) => energyCallback(payload as EnergyReading);

    mqttService.subscribe(
      `home/${homeId}/sensor/${deviceId}/power`,
      onPower
    );
    mqttService.subscribe(
      `home/${homeId}/sensor/${deviceId}/energy`,
      onEnergy
    );

    return () => {
      mqttService.unsubscribe(
        `home/${homeId}/sensor/${deviceId}/power`,
        onPower
      );
      mqttService.unsubscribe(
        `home/${homeId}/sensor/${deviceId}/energy`,
        onEnergy
      );
    };
  }, [deviceId, homeId, updateDevice, addDevice]);
};
