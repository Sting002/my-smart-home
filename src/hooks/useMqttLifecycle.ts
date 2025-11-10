import { useEffect } from "react";
import {
  mqttService,
  type MqttStatus,
} from "@/services/mqttService";

type Args = {
  brokerUrl: string;
  enabled: boolean;
  onStatusChange: (connected: boolean) => void;
};

export function useMqttLifecycle({
  brokerUrl,
  enabled,
  onStatusChange,
}: Args) {
  useEffect(() => {
    if (!enabled) {
      onStatusChange(false);
      return;
    }

    if (!mqttService.isConnected()) {
      mqttService.connect(brokerUrl, { keepalive: 30, reconnectPeriod: 1000 });
    }

    const handler = (status: MqttStatus) => {
      onStatusChange(status === "connected");
    };

    mqttService.onStatusChange(handler);
    onStatusChange(mqttService.isConnected());

    return () => {
      mqttService.offStatusChange(handler);
    };
  }, [brokerUrl, enabled, onStatusChange]);
}
