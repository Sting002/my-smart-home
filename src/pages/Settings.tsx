import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEnergy } from "../contexts/EnergyContext";
import { useAuth } from "@/contexts/AuthContext";
import { mqttService } from "@/services/mqttService";
import { useOnboardingConfig, DEFAULT_BROKER_URL } from "@/hooks/useOnboardingConfig";
import { updateOnboardingConfig } from "@/api/onboarding";
import { removeDevice as apiRemoveDevice } from "@/api/devices";

type ExportShape = {
  homeId: string;
  currency: string;
  tariff: number;
  devices: unknown;
  exportDate: string;
  monthlyBudget: number;
  touEnabled: boolean;
  touPeakPrice: number;
  touOffpeakPrice: number;
  touOffpeakStart: string;
  touOffpeakEnd: string;
  alertTtlMinutes: number;
};

type SettingsForm = {
  homeId: string;
  currency: string;
  tariff: number;
  monthlyBudget: number;
  alertTtlMinutes: number;
  touEnabled: boolean;
  touPeakPrice: number;
  touOffpeakPrice: number;
  touOffpeakStart: string;
  touOffpeakEnd: string;
};

const DEFAULTS: SettingsForm = {
  homeId: "home1",
  currency: "USD",
  tariff: 0.12,
  monthlyBudget: 0,
  alertTtlMinutes: 5,
  touEnabled: false,
  touPeakPrice: 0.2,
  touOffpeakPrice: 0.12,
  touOffpeakStart: "22:00",
  touOffpeakEnd: "06:00",
};

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const {
    devices,
    refreshBrokerConfig,
    homeId,
    setHomeId,
    currency,
    setCurrency,
    tariff,
    setTariff,
    monthlyBudget,
    setMonthlyBudget,
    alertTtlMinutes,
    setAlertTtlMinutes,
    touEnabled,
    setTouEnabled,
    touPeakPrice,
    setTouPeakPrice,
    touOffpeakPrice,
    setTouOffpeakPrice,
    touOffpeakStart,
    setTouOffpeakStart,
    touOffpeakEnd,
    setTouOffpeakEnd,
    addDevice,
    removeDevice,
  } = useEnergy();
  const { logout, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { config: onboardingConfig, refresh: refreshOnboarding } = useOnboardingConfig();

  const [form, setForm] = useState<SettingsForm>(() => ({
    homeId,
    currency,
    tariff,
    monthlyBudget,
    alertTtlMinutes,
    touEnabled,
    touPeakPrice,
    touOffpeakPrice,
    touOffpeakStart,
    touOffpeakEnd,
  }));

  useEffect(() => {
    setForm({
      homeId,
      currency,
      tariff,
      monthlyBudget,
      alertTtlMinutes,
      touEnabled,
      touPeakPrice,
      touOffpeakPrice,
      touOffpeakStart,
      touOffpeakEnd,
    });
  }, [
    homeId,
    currency,
    tariff,
    monthlyBudget,
    alertTtlMinutes,
    touEnabled,
    touPeakPrice,
    touOffpeakPrice,
    touOffpeakStart,
    touOffpeakEnd,
  ]);

  const [brokerUrl, setBrokerUrl] = useState(
    onboardingConfig.brokerUrl || DEFAULT_BROKER_URL
  );
  useEffect(() => {
    setBrokerUrl(onboardingConfig.brokerUrl || DEFAULT_BROKER_URL);
  }, [onboardingConfig.brokerUrl]);

  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [importErr, setImportErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onFieldChange = useCallback(
    <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
    }
  }, [logout, navigate]);

  const persistFormPreferences = useCallback(() => {
    if (form.homeId !== homeId) setHomeId(form.homeId.trim() || DEFAULTS.homeId);
    if (form.currency !== currency) setCurrency(form.currency);
    if (form.tariff !== tariff) setTariff(form.tariff || DEFAULTS.tariff);
    if (form.monthlyBudget !== monthlyBudget)
      setMonthlyBudget(form.monthlyBudget || 0);
    if (form.alertTtlMinutes !== alertTtlMinutes)
      setAlertTtlMinutes(form.alertTtlMinutes || DEFAULTS.alertTtlMinutes);
    if (form.touEnabled !== touEnabled) setTouEnabled(form.touEnabled);
    if (form.touPeakPrice !== touPeakPrice)
      setTouPeakPrice(form.touPeakPrice || DEFAULTS.touPeakPrice);
    if (form.touOffpeakPrice !== touOffpeakPrice)
      setTouOffpeakPrice(form.touOffpeakPrice || DEFAULTS.touOffpeakPrice);
    if (form.touOffpeakStart !== touOffpeakStart)
      setTouOffpeakStart(form.touOffpeakStart || DEFAULTS.touOffpeakStart);
    if (form.touOffpeakEnd !== touOffpeakEnd)
      setTouOffpeakEnd(form.touOffpeakEnd || DEFAULTS.touOffpeakEnd);
  }, [
    alertTtlMinutes,
    currency,
    form.alertTtlMinutes,
    form.currency,
    form.homeId,
    form.monthlyBudget,
    form.tariff,
    form.touEnabled,
    form.touOffpeakEnd,
    form.touOffpeakPrice,
    form.touOffpeakStart,
    form.touPeakPrice,
    homeId,
    monthlyBudget,
    setAlertTtlMinutes,
    setCurrency,
    setHomeId,
    setMonthlyBudget,
    setTariff,
    setTouEnabled,
    setTouOffpeakEnd,
    setTouOffpeakPrice,
    setTouOffpeakStart,
    setTouPeakPrice,
    tariff,
    touEnabled,
    touOffpeakEnd,
    touOffpeakPrice,
    touOffpeakStart,
    touPeakPrice,
  ]);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    setShowSuccess(false);
    setSavingSettings(true);
    try {
      persistFormPreferences();

      const trimmedBroker = brokerUrl.trim() || DEFAULT_BROKER_URL;
      const brokerChanged = trimmedBroker !== onboardingConfig.brokerUrl;
      if (brokerChanged) {
        await mqttService.connectAndWait(trimmedBroker, 4000, {
          keepalive: 30,
          reconnectPeriod: 1000,
        });
        await updateOnboardingConfig({
          brokerUrl: trimmedBroker,
          onboarded: "true",
        });
        refreshOnboarding();
        refreshBrokerConfig();
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save settings";
      setSaveError(message);
    } finally {
      setSavingSettings(false);
    }
  }, [
    brokerUrl,
    onboardingConfig.brokerUrl,
    persistFormPreferences,
    refreshBrokerConfig,
    refreshOnboarding,
  ]);

  const handleExportData = useCallback(() => {
    const data: ExportShape = {
      homeId,
      currency,
      tariff,
      devices,
      exportDate: new Date().toISOString(),
      monthlyBudget,
      touEnabled,
      touPeakPrice,
      touOffpeakPrice,
      touOffpeakStart,
      touOffpeakEnd,
      alertTtlMinutes,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `energy-data-${Date.now()}.json`;
    a.click();
  }, [
    alertTtlMinutes,
    currency,
    devices,
    homeId,
    monthlyBudget,
    tariff,
    touEnabled,
    touOffpeakEnd,
    touOffpeakPrice,
    touOffpeakStart,
    touPeakPrice,
  ]);

  const onChooseFile = useCallback(() => fileRef.current?.click(), []);

  const onFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportErr(null);
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const updates: Partial<SettingsForm> = {};
        if (typeof parsed.homeId === "string") {
          updates.homeId = parsed.homeId;
          setHomeId(parsed.homeId);
        }
        if (typeof parsed.currency === "string") {
          updates.currency = parsed.currency;
          setCurrency(parsed.currency);
        }
        if (typeof parsed.tariff === "number") {
          updates.tariff = parsed.tariff;
          setTariff(parsed.tariff);
        }
        if (typeof parsed.monthlyBudget === "number") {
          updates.monthlyBudget = parsed.monthlyBudget;
          setMonthlyBudget(parsed.monthlyBudget);
        }
        if (typeof parsed.alertTtlMinutes === "number") {
          updates.alertTtlMinutes = parsed.alertTtlMinutes;
          setAlertTtlMinutes(parsed.alertTtlMinutes);
        }
        if (typeof parsed.touEnabled === "boolean") {
          updates.touEnabled = parsed.touEnabled;
          setTouEnabled(parsed.touEnabled);
        }
        if (typeof parsed.touPeakPrice === "number") {
          updates.touPeakPrice = parsed.touPeakPrice;
          setTouPeakPrice(parsed.touPeakPrice);
        }
        if (typeof parsed.touOffpeakPrice === "number") {
          updates.touOffpeakPrice = parsed.touOffpeakPrice;
          setTouOffpeakPrice(parsed.touOffpeakPrice);
        }
        if (typeof parsed.touOffpeakStart === "string") {
          updates.touOffpeakStart = parsed.touOffpeakStart;
          setTouOffpeakStart(parsed.touOffpeakStart);
        }
        if (typeof parsed.touOffpeakEnd === "string") {
          updates.touOffpeakEnd = parsed.touOffpeakEnd;
          setTouOffpeakEnd(parsed.touOffpeakEnd);
        }
        if (Array.isArray(parsed.devices)) {
          for (const candidate of parsed.devices) {
            if (candidate && typeof candidate.id === "string") {
              addDevice(candidate);
            }
          }
        }
        if (Object.keys(updates).length) {
          setForm((prev) => ({ ...prev, ...updates }));
        }
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      } catch {
        setImportErr("Invalid file format");
      } finally {
        e.target.value = "";
      }
    },
    [
      addDevice,
      setAlertTtlMinutes,
      setCurrency,
      setHomeId,
      setMonthlyBudget,
      setTariff,
      setTouEnabled,
      setTouOffpeakEnd,
      setTouOffpeakPrice,
      setTouOffpeakStart,
      setTouPeakPrice,
    ]
  );

  const onResetAll = useCallback(async () => {
    if (!isAdmin) {
      alert("Only administrators can clear all data.");
      return;
    }
    const confirmTxt = prompt('Type "RESET" to clear all stored data.');
    if (confirmTxt !== "RESET") return;

    try {
      setHomeId(DEFAULTS.homeId);
      setCurrency(DEFAULTS.currency);
      setTariff(DEFAULTS.tariff);
      setMonthlyBudget(DEFAULTS.monthlyBudget);
      setAlertTtlMinutes(DEFAULTS.alertTtlMinutes);
      setTouEnabled(DEFAULTS.touEnabled);
      setTouPeakPrice(DEFAULTS.touPeakPrice);
      setTouOffpeakPrice(DEFAULTS.touOffpeakPrice);
      setTouOffpeakStart(DEFAULTS.touOffpeakStart);
      setTouOffpeakEnd(DEFAULTS.touOffpeakEnd);
      setForm({ ...DEFAULTS });

      for (const device of devices) {
        try {
          await apiRemoveDevice(device.id);
        } catch (err) {
          console.warn("Failed to delete device from backend", err);
        }
        removeDevice(device.id);
      }

      await updateOnboardingConfig({
        brokerUrl: DEFAULT_BROKER_URL,
        onboarded: "false",
      });
      refreshOnboarding();
      refreshBrokerConfig();
      setBrokerUrl(DEFAULT_BROKER_URL);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to reset data", err);
      setSaveError("Failed to clear data");
    }
  }, [
    devices,
    isAdmin,
    refreshBrokerConfig,
    refreshOnboarding,
    removeDevice,
    setAlertTtlMinutes,
    setCurrency,
    setHomeId,
    setMonthlyBudget,
    setTariff,
    setTouEnabled,
    setTouOffpeakEnd,
    setTouOffpeakPrice,
    setTouOffpeakStart,
    setTouPeakPrice,
  ]);

  const touDisabled = !form.touEnabled;

  return (
    <div className="space-y-6">
      {showSuccess && (
        <div className="bg-green-500/20 border border-green-500 text-green-400 rounded-lg p-3">
          Settings saved successfully!
        </div>
      )}

      {user?.role === "admin" && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-white font-semibold mb-4">Admin Tools</h2>
          <p className="text-gray-400 text-sm mb-4">
            Manage user access and other privileged actions from the admin dashboard.
          </p>
          <button
            onClick={() => navigate("/admin")}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-semibold"
          >
            Open Admin Dashboard
          </button>
        </div>
      )}

      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-white font-semibold mb-4">Energy Preferences</h2>
        <div className="grid gap-4">
          <div>
            <label htmlFor="homeId" className="text-gray-400 text-sm">
              Home ID
            </label>
            <input
              id="homeId"
              name="homeId"
              type="text"
              value={form.homeId}
              onChange={(e) => onFieldChange("homeId", e.target.value)}
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
              value={form.currency}
              onChange={(e) => onFieldChange("currency", e.target.value)}
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
              value={form.tariff}
              onChange={(e) => onFieldChange("tariff", Number(e.target.value))}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label htmlFor="monthlyBudget" className="text-gray-400 text-sm">
              Monthly Budget ({form.currency})
            </label>
            <input
              id="monthlyBudget"
              name="monthlyBudget"
              type="number"
              step="1"
              value={form.monthlyBudget}
              onChange={(e) =>
                onFieldChange("monthlyBudget", Number(e.target.value))
              }
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label htmlFor="alertTtlMinutes" className="text-gray-400 text-sm">
              Alert retention (minutes)
            </label>
            <input
              id="alertTtlMinutes"
              name="alertTtlMinutes"
              type="number"
              step="1"
              value={form.alertTtlMinutes}
              onChange={(e) =>
                onFieldChange("alertTtlMinutes", Number(e.target.value))
              }
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold">Time-of-Use Pricing</h2>
            <p className="text-gray-400 text-sm">
              Configure peak and off-peak pricing windows.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-gray-300 text-sm">
            <input
              type="checkbox"
              checked={form.touEnabled}
              onChange={(e) => onFieldChange("touEnabled", e.target.checked)}
            />
            Enable TOU
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-gray-400 text-sm">Peak price ({form.currency})</label>
            <input
              type="number"
              step="0.01"
              disabled={touDisabled}
              value={form.touPeakPrice}
              onChange={(e) =>
                onFieldChange("touPeakPrice", Number(e.target.value))
              }
              className="w-full bg-gray-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm">
              Off-peak price ({form.currency})
            </label>
            <input
              type="number"
              step="0.01"
              disabled={touDisabled}
              value={form.touOffpeakPrice}
              onChange={(e) =>
                onFieldChange("touOffpeakPrice", Number(e.target.value))
              }
              className="w-full bg-gray-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm">Off-peak start</label>
            <input
              type="time"
              disabled={touDisabled}
              value={form.touOffpeakStart}
              onChange={(e) => onFieldChange("touOffpeakStart", e.target.value)}
              className="w-full bg-gray-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm">Off-peak end</label>
            <input
              type="time"
              disabled={touDisabled}
              value={form.touOffpeakEnd}
              onChange={(e) => onFieldChange("touOffpeakEnd", e.target.value)}
              className="w-full bg-gray-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg mt-1"
            />
          </div>
        </div>
      </div>

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
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-1 "
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: <code>ws://192.168.1.100:9001/mqtt</code> or{" "}
              <code>wss://broker.example.com:8083/mqtt</code>
            </p>
          </div>
        </div>
      </div>

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
            disabled={!isAdmin}
            className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold"
          >
            Clear All Data
          </button>
          {!isAdmin && (
            <p className="text-xs text-yellow-400 text-center">
              Only administrators can clear stored data.
            </p>
          )}
        </div>
      </div>

      {saveError && <div className="text-red-400 text-sm">{saveError}</div>}
      <button
        onClick={handleSave}
        disabled={savingSettings}
        className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold"
      >
        {savingSettings ? "Saving..." : "Save Settings"}
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
