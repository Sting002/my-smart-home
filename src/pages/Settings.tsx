import React, { useState } from "react";
import { useEnergy } from "../contexts/EnergyContext";

export const Settings: React.FC = () => {
  const { homeId, setHomeId, currency, setCurrency, tariff, setTariff, devices } = useEnergy();
  const [brokerUrl, setBrokerUrl] = useState(localStorage.getItem("brokerUrl") || "ws://localhost:9001");
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    localStorage.setItem("brokerUrl", brokerUrl);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleExportData = () => {
    const data = {
      homeId,
      currency,
      tariff,
      devices,
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `energy-data-${Date.now()}.json`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="bg-green-500/20 border border-green-500 text-green-400 rounded-lg p-3">
          Settings saved successfully!
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Home Profile</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="home-id" className="text-gray-400 text-sm">Home ID</label>
            <input
              id="home-id"
              name="home-id"
              type="text"
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label htmlFor="currency" className="text-gray-400 text-sm">Currency</label>
            <select
              id="currency"
              name="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="KES">KES (KSh)</option>
            </select>
          </div>
          <div>
            <label htmlFor="tariff" className="text-gray-400 text-sm">Tariff (per kWh)</label>
            <input
              id="tariff"
              name="tariff"
              type="number"
              step="0.01"
              value={tariff}
              onChange={(e) => setTariff(parseFloat(e.target.value))}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">MQTT Connection</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="broker-url" className="text-gray-400 text-sm">Broker URL</label>
            <input
              id="broker-url"
              name="broker-url"
              type="text"
              value={brokerUrl}
              onChange={(e) => setBrokerUrl(e.target.value)}
              placeholder="ws://localhost:9001"
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: ws://192.168.1.100:9001 or wss://broker.example.com:8083
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Data & Privacy</h2>
        <div className="space-y-3">
          <button
            onClick={handleExportData}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold"
          >
            Export Data (JSON)
          </button>
          <button className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold">
            Clear All Data
          </button>
        </div>
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold"
      >
        Save Settings
      </button>

      <div className="bg-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-400 text-sm">Smart Home Energy Monitor</p>
        <p className="text-gray-500 text-xs mt-1">Version 1.0.0</p>
      </div>
    </div>
  );
};

export default Settings;