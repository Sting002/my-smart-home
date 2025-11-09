import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEnergy } from "../contexts/EnergyContext";
import { mqttService, PowerReading } from "../services/mqttService";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "@/hooks/use-toast";
import { removeDevice as apiRemoveDevice } from "@/api/devices";

export const DeviceDetail: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { devices, updateDevice, homeId, toggleDevice, removeDevice } = useEnergy();
  const navigate = useNavigate();
  const device = devices.find(d => d.id === deviceId);

  const [powerHistory, setPowerHistory] = useState<PowerReading[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!device || !deviceId) return;

    const callback = (data: PowerReading) => {
      setPowerHistory(prev => {
        const updated = [...prev, data].slice(-120);
        return updated;
      });
    };

    mqttService.subscribe(`home/${homeId}/sensor/${deviceId}/power`, callback);
    return () => {
      mqttService.unsubscribe(`home/${homeId}/sensor/${deviceId}/power`, callback);
    };
  }, [device, deviceId, homeId]);

  const isOnline = useMemo(() => {
    if (!device) return false;
    return Date.now() - device.lastSeen < 30_000;
  }, [device]);

  const chartData = useMemo(
    () =>
      powerHistory.map(r => ({
        time: new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        watts: r.watts,
      })),
    [powerHistory]
  );

  const onChangeNum = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, key: "thresholdW" | "autoOffMins") => {
      if (!device) return;
      setSaving(true);
      const val = Number(e.target.value);
      updateDevice(device.id, { [key]: val });
      const t = setTimeout(() => setSaving(false), 300);
      return () => clearTimeout(t);
    },
    [device, updateDevice]
  );

  const onDelete = useCallback(async () => {
    if (!device) return;
    const ok = window.confirm(`Delete device "${device.name}" (${device.id})? This cannot be undone.`);
    if (!ok) return;
    try {
      // Try backend delete (non-fatal if unauthorized)
      try {
        await apiRemoveDevice(device.id);
      } catch {}

      // Clear retained MQTT readings (if connected)
      try {
        if (mqttService.isConnected()) {
          const powerTopic = `home/${homeId}/sensor/${device.id}/power`;
          const energyTopic = `home/${homeId}/sensor/${device.id}/energy`;
          mqttService.publishRaw(powerTopic, "", { retain: true });
          mqttService.publishRaw(energyTopic, "", { retain: true });
        }
      } catch {}

      // Remove locally and navigate away
      removeDevice(device.id);
      toast({ title: "Device deleted", description: `${device.name} removed` });
      navigate("/devices", { replace: true });
    } catch (e) {
      toast({ title: "Failed to delete", description: `Could not delete ${device.name}` });
    }
  }, [device, homeId, navigate, removeDevice]);

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

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/devices")} className="text-green-500 flex items-center gap-2">
        ← Back
      </button>

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{device.name}</h1>
            <p className="text-gray-400">{device.room}</p>
            <div className={`mt-1 text-xs ${isOnline ? "text-green-400" : "text-gray-500"}`}>
              {isOnline ? "Online" : "Offline"}
            </div>
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
            <div className="text-3xl font-bold text-white">{device.kwhToday.toFixed(2)}</div>
            <div className="text-sm text-gray-400">kWh Today</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Power History (Last ~2h)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip contentStyle={{ backgroundColor: "#1F2937", border: "none" }} />
            <Line type="monotone" dataKey="watts" stroke="#22C55E" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Settings</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="thresholdW" className="text-gray-400 text-sm">Threshold (W)</label>
            <input
              id="thresholdW"
              name="thresholdW"
              type="number"
              value={device.thresholdW}
              onChange={(e) => onChangeNum(e, "thresholdW")}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label htmlFor="autoOffMins" className="text-gray-400 text-sm">Auto-off (minutes)</label>
            <input
              id="autoOffMins"
              name="autoOffMins"
              type="number"
              value={device.autoOffMins}
              onChange={(e) => onChangeNum(e, "autoOffMins")}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          {saving && <div className="text-xs text-gray-400">Saving…</div>}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Danger Zone</h2>
        <button
          onClick={onDelete}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold"
        >
          Delete Device
        </button>
      </div>
    </div>
  );
};

