// C:\Users\hasti\Desktop\my smart home\src\pages\Dashboard.tsx
import React, { useMemo, useCallback, useState, useEffect } from "react";
import { useEnergy } from "../contexts/EnergyContext";
import { PowerGauge } from "../components/PowerGauge";
import { AlertBadge } from "../components/AlertBadge";
import { mqttService } from "../services/mqttService";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";

export const Dashboard: React.FC = () => {
  const { devices, alerts, currency, tariff, homeId, updateDevice, toggleDevice } = useEnergy();
  const navigate = useNavigate();
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [yesterdayKwh, setYesterdayKwh] = useState<number | null>(null);

  // Update last refresh time when devices change
  useEffect(() => {
    setLastUpdate(Date.now());
  }, [devices]);

  // Load yesterday's data from localStorage for comparison
  useEffect(() => {
    const stored = localStorage.getItem("yesterdayTotalKwh");
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) setYesterdayKwh(parsed);
    }
  }, []);

  // Save today's total at midnight for tomorrow's comparison
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timer = setTimeout(() => {
      const totalKwh = devices.reduce((sum, d) => sum + d.kwhToday, 0);
      localStorage.setItem("yesterdayTotalKwh", totalKwh.toString());
      setYesterdayKwh(totalKwh);
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, [devices]);

  // Derive current totals without extra state
  const totalWatts = useMemo(
    () => devices.reduce((sum, d) => sum + (d.isOn ? d.watts : 0), 0),
    [devices]
  );
  const todayKwh = useMemo(
    () => devices.reduce((sum, d) => sum + d.kwhToday, 0),
    [devices]
  );

  // Calculate comparison with yesterday
  const yesterdayComparison = useMemo(() => {
    if (yesterdayKwh === null || yesterdayKwh === 0) {
      // First day - no comparison available yet
      return { isFirstDay: true };
    }
    const diff = ((todayKwh - yesterdayKwh) / yesterdayKwh) * 100;
    return {
      percentage: Math.abs(diff).toFixed(0),
      isLess: diff < 0,
      isFirstDay: false,
    };
  }, [todayKwh, yesterdayKwh]);

  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // Status message based on usage
  const statusMessage = useMemo(() => {
    if (devices.length === 0) return "No devices connected";
    const onCount = devices.filter(d => d.isOn).length;
    if (onCount === 0) return "All devices are off";
    if (totalWatts > 3000) return "High usage detected";
    if (totalWatts > 1500) return "Moderate usage";
    return "Your home is running efficiently";
  }, [devices, totalWatts]);

  // Calculate device runtime (simplified - shows time since last seen if on)
  const getDeviceRuntime = useCallback((device: any) => {
    if (!device.isOn) {
      // Show that it's off
      return "off";
    }
    const now = Date.now();
    const lastSeen = device.lastSeen || now;
    const diffMs = now - lastSeen;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `~${hours}h ${mins}m`;
    if (mins > 0) return `~${mins}m`;
    return "just on";
  }, []);

  const estimatedCost = useMemo(() => {
    try {
      const touEnabled = localStorage.getItem("touEnabled") === "true";
      if (!touEnabled) {
        const cost = todayKwh * tariff;
        return Number.isFinite(cost) ? cost.toFixed(2) : "0.00";
      }
      const toNum = (value: string | null, fallback: number): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
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
      const cost = todayKwh * price;
      return Number.isFinite(cost) ? cost.toFixed(2) : "0.00";
    } catch {
      const cost = todayKwh * tariff;
      return Number.isFinite(cost) ? cost.toFixed(2) : "0.00";
    }
  }, [todayKwh, tariff]);

  const topConsumers = useMemo(
    () => [...devices].sort((a, b) => b.kwhToday - a.kwhToday).slice(0, 5),
    [devices]
  );

  // Projected monthly cost
  const projectedMonthlyCost = useMemo(() => {
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const avgDailyCost = todayKwh * tariff;
    return (avgDailyCost * daysInMonth).toFixed(2);
  }, [todayKwh, tariff]);

  // Relative time for last update
  const getRelativeTime = useCallback(() => {
    const diffMs = Date.now() - lastUpdate;
    const mins = Math.floor(diffMs / 60000);
    if (mins === 0) return "just now";
    if (mins === 1) return "1 minute ago";
    if (mins < 60) return `${mins} minutes ago`;
    const hours = Math.floor(mins / 60);
    if (hours === 1) return "1 hour ago";
    return `${hours} hours ago`;
  }, [lastUpdate]);

  const [relativeTime, setRelativeTime] = useState(getRelativeTime());

  // Update relative time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setRelativeTime(getRelativeTime());
    }, 60000);
    return () => clearInterval(timer);
  }, [getRelativeTime]);

  const onCount = useMemo(() => devices.filter((d) => d.isOn).length, [devices]);

  // Quick toggle handler
  const handleQuickToggle = useCallback((deviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mqttService.isConnected()) {
      toast({
        title: "Not connected to MQTT",
        description: "Cannot control devices right now",
      });
      return;
    }
    toggleDevice(deviceId);
  }, [toggleDevice]);

  const allOff = useCallback(() => {
    if (!mqttService.isConnected()) {
      toast({
        title: "Not connected to MQTT",
        description: "Cannot send commands. Check Settings -> Broker URL.",
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
  }, [devices, homeId, navigate, updateDevice]);

  const anyDevice = devices.length > 0;

  // Get device icon
  const getDeviceIcon = (type: string) => {
    const icons: Record<string, string> = {
      fridge: "❄️",
      washer: "🌀",
      ac: "🌡️",
      heater: "🔥",
      water: "💧",
      microwave: "📻",
      light: "💡",
      tv: "📺",
      default: "🔌",
    };
    return icons[type] || icons.default;
  };

  return (
    <div className="space-y-6">
      {/* Greeting and Status Summary */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl p-5 text-white">
        <h1 className="text-2xl font-bold mb-1">{greeting}!</h1>
        <p className="text-blue-100 text-sm mb-3">{statusMessage}</p>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-blue-100">
              {onCount} of {devices.length} devices running
            </span>
          </div>
          <div className="text-blue-100 text-xs">
            Updated {relativeTime}
          </div>
        </div>
        {yesterdayComparison && !yesterdayComparison.isFirstDay && (
          <div className={`mt-3 px-3 py-2 rounded-lg ${yesterdayComparison.isLess ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
            <p className="text-sm">
              {yesterdayComparison.isLess ? '📉 ' : '📈 '}
              You're using {yesterdayComparison.percentage}% {yesterdayComparison.isLess ? 'less' : 'more'} than yesterday
              {yesterdayComparison.isLess && ' - great job!'}
            </p>
          </div>
        )}
        {yesterdayComparison?.isFirstDay && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-blue-500/20">
            <p className="text-sm">
              📊 Building your usage history - comparison available tomorrow
            </p>
          </div>
        )}
      </div>

      {/* Power Gauge and Stats */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6">
        <PowerGauge watts={totalWatts} />
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">⚡ Today's Usage</div>
            <div className="text-3xl font-bold text-white">{todayKwh.toFixed(2)}</div>
            <div className="text-xs text-gray-400">kWh</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">💰 Today's Cost</div>
            <div className="text-3xl font-bold text-green-500">
              {currency === "USD" ? "$" : currency} {(todayKwh * tariff).toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">Estimated</div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="text-center">
            <div className="text-sm text-gray-400 mb-1">📊 Est. Monthly</div>
            <div className="text-2xl font-bold text-blue-400">
              {currency === "USD" ? "$" : currency} {projectedMonthlyCost}
            </div>
            <div className="text-xs text-gray-500">If usage continues like today</div>
          </div>
        </div>
      </div>

      {/* Top Energy Consumers */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h2 className="text-white font-semibold mb-1 flex items-center gap-2">
          ⚡ Using Most Power Today
        </h2>
        <p className="text-xs text-gray-500 mb-3">Devices with highest energy consumption</p>
        {anyDevice && (
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
                    className="w-full flex justify-between items-center text-left hover:bg-gray-700/40 rounded px-3 py-2"
                  >
                    <span className="text-gray-300 flex items-center gap-2">
                      <span className="text-lg">{getDeviceIcon(device.type)}</span>
                      {device.name}
                    </span>
                    <span className="text-white font-semibold">
                      {device.kwhToday.toFixed(2)} kWh ({pct}%)
                    </span>
                  </button>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Control Buttons */}
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

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-white font-semibold flex items-center gap-2">
            🔔 Recent Alerts
          </h2>
          {alerts.slice(0, 3).map((alert) => (
            <AlertBadge key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
