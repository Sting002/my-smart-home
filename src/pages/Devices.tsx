import React, { useState } from "react";
import { useEnergy } from "../contexts/EnergyContext";
import { DeviceCard } from "../components/DeviceCard";
import { useNavigate } from "react-router-dom";

export const Devices: React.FC = () => {
  const { devices, toggleDevice } = useEnergy();
  const [filter, setFilter] = useState<"all" | "on" | "off">("all");
  const [sortBy, setSortBy] = useState<"name" | "usage">("usage");
  const navigate = useNavigate();

  const filteredDevices = devices
    .filter((d) => {
      if (filter === "on") return d.isOn;
      if (filter === "off") return !d.isOn;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "usage") return b.kwhToday - a.kwhToday;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">Devices</h1>
        <button
          onClick={() => navigate("/devices/add")}
          className="bg-green-500 hover:bg-green-600 text-foreground px-4 py-2 rounded-lg font-semibold text-sm"
        >
          + Add Device
        </button>
      </div>

      <div className="flex gap-2">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as "all" | "on" | "off")}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700"
        >
          <option value="all">All Devices</option>
          <option value="on">Active</option>
          <option value="off">Inactive</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "usage" | "name")}
          className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700"
        >
          <option value="usage">Sort by Usage</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {filteredDevices.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔌</div>
          <h3 className="text-white text-xl font-semibold mb-2">No Devices Found</h3>
          <p className="text-gray-400">Connect your ESP32 devices via MQTT</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onToggle={() => toggleDevice(device.id)}
              onClick={() => navigate(`/device/${device.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Devices;
