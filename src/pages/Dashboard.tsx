// C:\Users\hasti\Desktop\my smart home\src\pages\Dashboard.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useEnergy } from "../contexts/EnergyContext";
import { PowerGauge } from "../components/PowerGauge";
import { AlertBadge } from "../components/AlertBadge";
import { mqttService } from "../services/mqttService";

export const Dashboard: React.FC = () => {
  const { devices, alerts, currency, tariff, homeId } = useEnergy();
  const [totalWatts, setTotalWatts] = useState(0);
  const [todayKwh, setTodayKwh] = useState(0);

  useEffect(() => {
    const total = devices.reduce((sum, d) => sum + (d.isOn ? d.watts : 0), 0);
    setTotalWatts(total);
    const kwh = devices.reduce((sum, d) => sum + d.kwhToday, 0);
    setTodayKwh(kwh);
  }, [devices]);

  const estimatedCost = useMemo(() => (todayKwh * tariff).toFixed(2), [todayKwh, tariff]);

  const topConsumers = useMemo(
    () => [...devices].sort((a, b) => b.kwhToday - a.kwhToday).slice(0, 5),
    [devices]
  );

  const allOff = useCallback(() => {
    devices.forEach((d) => {
      if (d.isOn) {
        mqttService.publish(`home/${homeId}/cmd/${d.id}/set`, { on: false });
      }
    });
  }, [devices, homeId]);

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
          <div className="space-y-2">
            {topConsumers.map((device) => (
              <div key={device.id} className="flex justify-between items-center">
                <span className="text-gray-300">{device.name}</span>
                <span className="text-white font-semibold">{device.kwhToday.toFixed(2)} kWh</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-sm">No devices connected yet.</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={allOff}
          className="bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold"
        >
          All Off
        </button>
        <button className="bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold">
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
