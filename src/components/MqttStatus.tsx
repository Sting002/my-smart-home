import { useEffect, useState } from "react";
import { mqttService, type MqttStatus as MqttStatusType } from "@/services/mqttService";

const MqttStatus = () => {
  const [status, setStatus] = useState<MqttStatusType>("disconnected");

  useEffect(() => {
    const handleStatus = (newStatus: MqttStatusType) => setStatus(newStatus);
    mqttService.onStatusChange(handleStatus);
    return () => {
      mqttService.offStatusChange(handleStatus);
    };
  }, []);

  return <div>MQTT Status: {status}</div>;
};

export default MqttStatus;
