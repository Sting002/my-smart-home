import React, { useState, useEffect } from "react";
import { mqttService, type MqttStatus } from "@/services/mqttService";

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<MqttStatus>("disconnected");

  useEffect(() => {
    const handle = (s: MqttStatus) => setStatus(s);
    mqttService.onStatusChange(handle);
    // seed current
    setStatus(mqttService.isConnected() ? "connected" : "disconnected");
    return () => mqttService.offStatusChange(handle);
  }, []);

  if (status !== "connected") {
    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-4 py-2 rounded-lg text-sm z-50">
        ⚠ MQTT {status} - Check broker
      </div>
    );
  }

  return null;
};

export default ConnectionStatus;

