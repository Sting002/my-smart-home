import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEnergy } from "../contexts/EnergyContext";
import { mqttService, PowerReading } from "../services/mqttService";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const DeviceDetail: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { devices, updateDevice, homeId, toggleDevice } = useEnergy();
  const navigate = useNavigate();
  const device = devices.find((d) => d.id === deviceId);
  const [powerHistory, setPowerHistory] = useState<PowerReading[]>([]);

  useEffect(() => {
    if (!device || !deviceId) return;

    const callback = (data: PowerReading) => {
      setPowerHistory((prev) => {
        const updated = [...prev, data].slice(-60);
        return updated;
      });
    };

    mqttService.subscribe(
      `home/${homeId}/sensor/${deviceId}/power`,
      (payload) => callback(payload as PowerReading)
    );

    return () => {
      mqttService.unsubscribe(
        `home/${homeId}/sensor/${deviceId}/power`,
        (payload) => callback(payload as PowerReading)
      );
    };
  }, [deviceId, homeId, device]);

  if (!device) {
    return (
      <div className="text-center py-12">
        <h3 className="text-white text-xl">Device not found</h3>
        <button onClick={() => navigate("/devices")} className="mt-4 text-green-500">
          Back to Devices
        </button>
      </div>
    );
  }

  const chartData = powerHistory.map((r) => ({
    time: new Date(r.ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    watts: r.watts,
  }));

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/devices")}
        className="text-green-500 flex items-center gap-2"
      >
        ← Back
      </button>

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{device.name}</h1>
            <p className="text-gray-400">{device.room}</p>
          </div>
          <button
            onClick={() => toggleDevice(device.id)}
            className={`px-6 py-2 rounded-lg font-semibold ${
              device.isOn ? "bg-green-500 text-white" : "bg-gray-700 text-gray-300"
            }`}
          >
            {device.isOn ? "ON" : "OFF"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-3xl font-bold text-white">{device.watts}W</div>
            <div className="text-sm text-gray-400">Current Power</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white">
              {device.kwhToday.toFixed(2)}
            </div>
            <div className="text-sm text-gray-400">kWh Today</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Power History (Last Hour)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} />
            <Line
              type="monotone"
              dataKey="watts"
              stroke="#22C55E"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm">Threshold (W)</label>
            <input
              type="number"
              value={device.thresholdW}
              onChange={(e) =>
                updateDevice(device.id, { thresholdW: parseInt(e.target.value) })
              }
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm">Auto-off (minutes)</label>
            <input
              type="number"
              value={device.autoOffMins}
              onChange={(e) =>
                updateDevice(device.id, { autoOffMins: parseInt(e.target.value) })
              }
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetail;