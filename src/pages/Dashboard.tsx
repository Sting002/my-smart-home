// C:\Users\hasti\Desktop\my smart home\src\pages\Dashboard.tsx
import React, { useMemo, useCallback } from "react";
import { useEnergy } from "../contexts/EnergyContext";
import { PowerGauge } from "../components/PowerGauge";
import { AlertBadge } from "../components/AlertBadge";
import { mqttService } from "../services/mqttService";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";

export const Dashboard: React.FC = () => {
  const { devices, alerts, currency, tariff, homeId, updateDevice } = useEnergy();
  const navigate = useNavigate();

  // Derive current totals without extra state
  const totalWatts = useMemo(
    () => devices.reduce((sum, d) => sum + (d.isOn ? d.watts : 0), 0),
    [devices]
  );
  const todayKwh = useMemo(
    () => devices.reduce((sum, d) => sum + d.kwhToday, 0),
    [devices]
  );

  const estimatedCost = useMemo(() => {
    try {
      const touEnabled = localStorage.getItem("touEnabled") === "true";
      if (!touEnabled) return (todayKwh * tariff).toFixed(2);
      const toNum = (x: any, d: number) => (isNaN(Number(x)) ? d : Number(x));
      const peak = toNum(localStorage.getItem("touPeakPrice"), tariff);
      const offp = toNum(localStorage.getItem("touOffpeakPrice"), tariff);
      const start = String(localStorage.getItem("touOffpeakStart") || "22:00");
      const end = String(localStorage.getItem("touOffpeakEnd") || "06:00");
      const t = new Date();
      const mins = t.getHours() * 60 + t.getMinutes();
      const toM = (s: string) => { const [h,m] = s.split(":").map(Number); return h*60 + (m||0); };
      const sM = toM(start), eM = toM(end);
      const inOff = sM < eM ? (mins >= sM && mins < eM) : (mins >= sM || mins < eM);
      const price = inOff ? offp : peak;
      return (todayKwh * price).toFixed(2);
    } catch { return (todayKwh * tariff).toFixed(2); }
  }, [todayKwh, tariff]);

  const topConsumers = useMemo(
    () => [...devices].sort((a, b) => b.kwhToday - a.kwhToday).slice(0, 5),
    [devices]
  );

  const onCount = useMemo(() => devices.filter((d) => d.isOn).length, [devices]);

  const allOff = useCallback(() => {
    if (!mqttService.isConnected()) {
      toast({
        title: "Not connected to MQTT",
        description: "Cannot send commands. Check Settings → Broker URL.",
        action: (
          <ToastAction altText="Open Settings" onClick={() => navigate("/settings")}>
            Reconnect
          </ToastAction>
        ),
      });
      return;
    }
    const toTurnOff = devices.filter((d) => d.isOn);
    if (toTurnOff.length > 2) {
      const confirmed = window.confirm(`Turn off ${toTurnOff.length} devices?`);
      if (!confirmed) return;
    }
    // Optimistic UI update so Device pages reflect OFF immediately
    toTurnOff.forEach((d) => {
      updateDevice(d.id, { isOn: false, watts: Math.min(d.watts, 1), lastSeen: Date.now() });
      mqttService.publish(`home/${homeId}/cmd/${d.id}/set`, { on: false });
    });
    toast({ title: "All Off sent", description: `Turning off ${toTurnOff.length} devices` });
  }, [devices, homeId, navigate]);

  const anyDevice = devices.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6">
        <PowerGauge watts={totalWatts} />
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">{todayKwh.toFixed(2)}</div>
            <div className="text-sm text-gray-400">kWh Today</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-500">
              {currency} {estimatedCost}
            </div>
            <div className="text-sm text-gray-400">Est. Cost</div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-white font-semibold mb-3">Top Consumers</h2>
        {anyDevice ? (
          <div className="space-y-1">
            {(() => {
              const totalKwh = Math.max(
                devices.reduce((s, d) => s + d.kwhToday, 0),
                0.00001
              );
              return topConsumers.map((device) => {
                const pct = Math.round((device.kwhToday / totalKwh) * 100);
                return (
                  <button
                    key={device.id}
                    onClick={() => navigate(`/device/${device.id}`)}
                    className="w-full flex justify-between items-center text-left hover:bg-gray-700/40 rounded px-2 py-1"
                  >
                    <span className="text-gray-300">{device.name}</span>
                    <span className="text-white font-semibold">
                      {device.kwhToday.toFixed(2)} kWh ({pct}%)
                    </span>
                  </button>
                );
              });
            })()}
          </div>
        ) : (
          <div className="text-gray-400 text-sm">
            No devices connected yet.
            <div className="mt-2">
              <button
                onClick={() => navigate("/devices/add")}
                className="text-green-400 hover:text-green-300 underline text-sm"
              >
                Add a device
              </button>
              <span className="text-gray-600"> · </span>
              <button
                onClick={() => navigate("/settings")}
                className="text-blue-400 hover:text-blue-300 underline text-sm"
              >
                Open Settings
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={allOff}
          disabled={!mqttService.isConnected() || onCount === 0}
          className={`py-3 rounded-lg font-semibold ${
            !mqttService.isConnected() || onCount === 0
              ? "bg-red-500/40 text-white/50 cursor-not-allowed"
              : "bg-red-500 hover:bg-red-600 text-white"
          }`}
        >
          All Off
        </button>
        <button
          onClick={() => navigate("/automations")}
          className="bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold"
        >
          Away Mode
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-white font-semibold">Recent Alerts</h2>
          {alerts.slice(0, 3).map((alert) => (
            <AlertBadge key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
