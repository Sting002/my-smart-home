import React from "react";
import type { Device } from "@/utils/energyContextTypes";

interface DeviceCardProps {
  device: Device;
  onToggle: () => void;
  onClick?: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  onToggle,
  onClick,
}) => {
  const getDeviceIcon = (type: string) => {
    const icons: Record<string, string> = {
      fridge: "❄️",
      washer: "🌀",
      ac: "🌡️",
      heater: "🔥",
      water: "💧",
      microwave: "📻",
      default: "🔌",
    };
    return icons[type] || icons.default;
  };

  return (
    <div
      className="bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition-all cursor-pointer border border-gray-700"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{getDeviceIcon(device.type)}</div>
          <div>
            <h3 className="text-white font-semibold">{device.name}</h3>
            <p className="text-gray-400 text-sm">{device.room}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`w-12 h-6 rounded-full transition-all ${
            device.isOn ? "bg-green-500" : "bg-gray-600"
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full transition-transform ${
              device.isOn ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <div className="text-2xl font-bold text-white">{device.watts}W</div>
          <div className="text-sm text-gray-400">
            {device.kwhToday.toFixed(2)} kWh today
          </div>
        </div>
        {device.isOn && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
      </div>
    </div>
  );
};
