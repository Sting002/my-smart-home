import React, { useState, useEffect } from "react";
import { mqttService } from "../services/mqttService";

export const ConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<
    "connected" | "disconnected" | "reconnecting" | "error"
  >("disconnected");

  useEffect(() => {
    const handler = (s: any) => setStatus(s as any);
    mqttService.onStatusChange(handler);
    return () => mqttService.offStatusChange(handler);
  }, []);

  if (status === "connected") return null;

  const style =
    status === "reconnecting"
      ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
      : status === "error"
      ? "bg-red-500/20 border-red-500 text-red-400"
      : "bg-yellow-500/20 border-yellow-500 text-yellow-400";

  const label =
    status === "reconnecting"
      ? "MQTT Reconnecting…"
      : status === "error"
      ? "MQTT Error – check broker"
      : "MQTT Disconnected – check broker";

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 ${style} px-4 py-2 rounded-lg text-sm z-50`}
    >
      ⚠️ {label}
    </div>
  );
};
