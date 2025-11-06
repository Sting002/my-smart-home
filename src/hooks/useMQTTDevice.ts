import { useEffect, useRef } from "react";
import { mqttService, PowerReading, EnergyReading } from "../services/mqttService";
import { useEnergy } from "../contexts/EnergyContext";

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
          lastSeen: data.ts,
        });
      } else {
        updateDevice(deviceId, {
          watts: data.watts,
          isOn: data.watts > 5,
          lastSeen: data.ts,
        });
      }
    };

    const energyCallback = (data: EnergyReading) => {
      const kwhToday = data.wh_total / 1000;
      updateDevice(deviceId, { kwhToday });
    };

    mqttService.subscribe(
      `home/${homeId}/sensor/${deviceId}/power`,
      (payload) => powerCallback(payload as PowerReading)
    );
    mqttService.subscribe(
      `home/${homeId}/sensor/${deviceId}/energy`,
      (payload) => energyCallback(payload as EnergyReading)
    );

    return () => {
      mqttService.unsubscribe(
        `home/${homeId}/sensor/${deviceId}/power`,
        (payload) => powerCallback(payload as PowerReading)
      );
      mqttService.unsubscribe(
        `home/${homeId}/sensor/${deviceId}/energy`,
        (payload) => energyCallback(payload as EnergyReading)
      );
    };
  }, [deviceId, homeId, updateDevice, addDevice]);
};
