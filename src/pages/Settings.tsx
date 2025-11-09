import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEnergy } from "../contexts/EnergyContext";
import { useAuth } from "@/contexts/AuthContext";
import { mqttService } from "@/services/mqttService";

type ExportShape = {
  homeId: string;
  currency: string;
  tariff: number;
  devices: unknown;
  exportDate: string;
};

export const Settings: React.FC = () => {
  const { homeId, setHomeId, currency, setCurrency, tariff, setTariff, devices } = useEnergy();

  // ✅ In use below (MQTT section + Save button)
  const [brokerUrl, setBrokerUrl] = useState(
    localStorage.getItem("brokerUrl") || "ws://localhost:9001/mqtt"
  );

  // ✅ In use below (top success banner + import success)
  const [showSuccess, setShowSuccess] = useState(false);

  // ✅ In use below (import error message)
  const [importErr, setImportErr] = useState<string | null>(null);

  // ✅ In use below (Import button)
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }, [logout, navigate]);

  // ✅ Uses brokerUrl state; shows success banner
  const handleSave = useCallback(() => {
    localStorage.setItem("brokerUrl", brokerUrl);
    // Reconnect to apply new broker immediately
    try {
      mqttService.disconnect();
      mqttService.connect(brokerUrl, { keepalive: 30, reconnectPeriod: 1000 });
    } catch (err) {
      console.error("MQTT reconnect failed:", err);
    }
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }, [brokerUrl]);

  // ✅ Used by “Export Data (JSON)”
  const handleExportData = useCallback(() => {
    const data: ExportShape = {
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
  }, [homeId, currency, tariff, devices]);

  // ✅ Used by “Import Data (JSON)”
  const onChooseFile = useCallback(() => fileRef.current?.click(), []);
  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportErr(null);
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (typeof parsed.homeId === "string") setHomeId(parsed.homeId);
        if (typeof parsed.currency === "string") setCurrency(parsed.currency);
        if (typeof parsed.tariff === "number") setTariff(parsed.tariff);
        if (parsed.devices) localStorage.setItem("devices", JSON.stringify(parsed.devices));
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch {
        setImportErr("Invalid file format");
      } finally {
        // allow selecting the same file again later
        e.target.value = "";
      }
    },
    [setHomeId, setCurrency, setTariff]
  );

  // ✅ Used by “Clear All Data”
  const onResetAll = useCallback(async () => {
    const confirmTxt = prompt('Type "RESET" to clear all local data (devices, settings).');
    if (confirmTxt !== "RESET") return;

    try {
      // Attempt to clear retained simulator readings so UI doesn't repopulate immediately
      if (!mqttService.isConnected()) {
        // Try a quick connect using the current broker URL to clear retained messages
        const url = localStorage.getItem("brokerUrl") || brokerUrl;
        if (url) {
          try {
            await mqttService.connectAndWait(url, 2500, { keepalive: 15, reconnectPeriod: 500 });
          } catch {
            // ignore connect failure; proceed to clear local data only
          }
        }
      }
      if (mqttService.isConnected()) {
        devices.forEach((d: { id: string }) => {
          const powerTopic = `home/${homeId}/sensor/${d.id}/power`;
          const energyTopic = `home/${homeId}/sensor/${d.id}/energy`;
          // Per MQTT spec: zero-length retained payload clears retained message
          mqttService.publishRaw(powerTopic, "", { retain: true });
          mqttService.publishRaw(energyTopic, "", { retain: true });
        });
        // Close the connection after clearing
        mqttService.disconnect();
      }
    } catch (e) {
      // non-fatal – proceed to clear local data
      console.warn("Failed to clear retained topics:", e);
    }

    localStorage.clear();
    window.location.reload();
  }, [devices, homeId, brokerUrl]);

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="bg-green-500/20 border border-green-500 text-green-400 rounded-lg p-3">
          Settings saved successfully!
        </div>
      )}

      {/* Home Profile */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Home Profile</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="homeId" className="text-gray-400 text-sm">
              Home ID
            </label>
            <input
              id="homeId"
              name="homeId"
              type="text"
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label htmlFor="currency" className="text-gray-400 text-sm">
              Currency
            </label>
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
              <option value="ZWL">ZWL (Z$)</option>
              <option value="ZAR">ZAR (R)</option>
            </select>
          </div>
          <div>
            <label htmlFor="tariff" className="text-gray-400 text-sm">
              Tariff (per kWh)
            </label>
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

      {/* MQTT Connection */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">MQTT Connection</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="brokerUrl" className="text-gray-400 text-sm">
              Broker URL
            </label>
            <input
              id="brokerUrl"
              name="brokerUrl"
              type="text"
              value={brokerUrl}
              onChange={(e) => setBrokerUrl(e.target.value)}
              placeholder="ws://localhost:9001/mqtt"
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: <code>ws://192.168.1.100:9001/mqtt</code> or{" "}
              <code>wss://broker.example.com:8083/mqtt</code>
            </p>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Data & Privacy</h2>
        {importErr && <div className="text-red-400 text-sm mb-2">{importErr}</div>}

        <div className="space-y-3">
          <button
            onClick={handleExportData}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold"
          >
            Export Data (JSON)
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            onChange={onFileSelected}
            className="hidden"
          />
          <button
            onClick={onChooseFile}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold"
          >
            Import Data (JSON)
          </button>

          <button
            onClick={onResetAll}
            className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-semibold"
          >
            Clear All Data
          </button>
        </div>
      </div>

      {/* Save & Logout */}
      <button
        onClick={handleSave}
        className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold"
      >
        Save Settings
      </button>

      <button
        onClick={handleLogout}
        className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-lg font-semibold mt-2"
      >
        Logout
      </button>

      <div className="bg-gray-800 rounded-xl p-6 text-center">
        <p className="text-gray-400 text-sm">Smart Home Energy Monitor</p>
        <p className="text-gray-500 text-xs mt-1">Version 1.0.0</p>
      </div>
    </div>
  );
};

export default Settings;
