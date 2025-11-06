import React from "react";
import type { Alert as AppAlert } from "@/utils/energyContextTypes";

interface AlertBadgeProps {
  alert: AppAlert;
}

export const AlertBadge: React.FC<AlertBadgeProps> = ({ alert }) => {
  const sev =
    alert.type === "critical"
      ? "danger"
      : alert.type === "warning"
      ? "warning"
      : "info";

  const getColor = () => {
    switch (sev) {
      case "danger":
        return "bg-red-500/20 border-red-500 text-red-400";
      case "warning":
        return "bg-yellow-500/20 border-yellow-500 text-yellow-400";
      default:
        return "bg-blue-500/20 border-blue-500 text-blue-400";
    }
  };

  const getIcon = () => {
    switch (sev) {
      case "danger":
        return "⚠️";
      case "warning":
        return "⚡";
      default:
        return "ℹ️";
    }
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={`border rounded-lg p-3 ${getColor()}`}>
      <div className="flex items-start gap-2">
        <span className="text-xl">{getIcon()}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm">{alert.type}</div>
          <div className="text-xs opacity-90 mt-1">{alert.message}</div>
          <div className="text-xs opacity-70 mt-1">{formatTime(alert.timestamp)}</div>
        </div>
      </div>
    </div>
  );
};
