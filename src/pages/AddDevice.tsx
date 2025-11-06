import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEnergy } from "../contexts/EnergyContext";

export const AddDevice: React.FC = () => {
  const navigate = useNavigate();
  const { addDevice } = useEnergy();
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    room: "",
    type: "default",
    thresholdW: 1000,
    autoOffMins: 0,
  });

  const deviceTypes = [
    { value: "fridge", label: "Refrigerator", icon: "❄️" },
    { value: "washer", label: "Washing Machine", icon: "🌀" },
    { value: "ac", label: "Air Conditioner", icon: "🌡️" },
    { value: "heater", label: "Heater", icon: "🔥" },
    { value: "water", label: "Water Heater", icon: "💧" },
    { value: "microwave", label: "Microwave", icon: "📻" },
    { value: "default", label: "Other", icon: "🔌" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    addDevice({
      ...formData,
      isOn: false,
      watts: 0,
      kwhToday: 0,
      lastSeen: Date.now(),
    });

    navigate("/devices");
  };

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/devices")}
        className="text-green-500 flex items-center gap-2"
      >
        ← Back
      </button>

      <div className="bg-gray-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Add New Device</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="device-id" className="text-gray-400 text-sm">
              Device ID
            </label>
            <input
              id="device-id"
              name="device-id"
              type="text"
              required
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              placeholder="e.g., device_001"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must match ESP32 device ID
            </p>
          </div>

          <div>
            <label htmlFor="device-name" className="text-gray-400 text-sm">
              Device Name
            </label>
            <input
              id="device-name"
              name="device-name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Living Room AC"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
            />
          </div>

          <div>
            <label htmlFor="device-room" className="text-gray-400 text-sm">
              Room
            </label>
            <input
              id="device-room"
              name="device-room"
              type="text"
              required
              value={formData.room}
              onChange={(e) => setFormData({ ...formData, room: e.target.value })}
              placeholder="e.g., Living Room"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
            />
          </div>

          <div>
            <label className="text-gray-400 text-sm">Device Type</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {deviceTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, type: type.value })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.type === type.value
                      ? "border-green-500 bg-green-500/10"
                      : "border-gray-700 bg-gray-700"
                  }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-white text-sm">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="thresholdW" className="text-gray-400 text-sm">
              Power Threshold (W)
            </label>
            <input
              id="thresholdW"
              name="thresholdW"
              type="number"
              value={formData.thresholdW}
              onChange={(e) =>
                setFormData({ ...formData, thresholdW: parseInt(e.target.value) })
              }
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold"
          >
            Add Device
          </button>
        </form>
      </div>
    </div>
  );
};
