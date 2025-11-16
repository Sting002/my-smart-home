// src/pages/Onboarding.tsx
import React, { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mqttService } from "@/services/mqttService";
import { useEnergy } from "@/contexts/EnergyContext";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { updateOnboardingConfig } from "@/api/onboarding";

const isValidWsUrl = (val: string) => {
  try {
    const u = new URL(val);
    return (u.protocol === "ws:" || u.protocol === "wss:") && !!u.host;
  } catch {
    return false;
  }
};

export const Onboarding: React.FC = () => {
  const { config: initialConfig, refresh: refreshOnboardingConfig } = useOnboardingConfig();
  const [step, setStep] = useState(1);
  const [brokerUrl, setBrokerUrl] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();
  const { refreshBrokerConfig } = useEnergy();

  useEffect(() => {
    if (initialConfig.brokerUrl) {
      setBrokerUrl(initialConfig.brokerUrl);
    }
  }, [initialConfig.brokerUrl]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError("");

    if (!isValidWsUrl(brokerUrl)) {
      setError("Enter a valid WebSocket URL (e.g., ws://localhost:9001/mqtt)");
      setConnecting(false);
      return;
    }

    try {
      await mqttService.connectAndWait(brokerUrl, 4000);

      const trimmed = brokerUrl.trim();
      await updateOnboardingConfig({ brokerUrl: trimmed, onboarded: "true" });
      
      refreshOnboardingConfig();
      refreshBrokerConfig();

      navigate("/dashboard", { replace: true });
    } catch (e) {
      mqttService.disconnect();
      setError("Failed to connect to MQTT broker. Check URL and broker.");
    } finally {
      setConnecting(false);
    }
  }, [brokerUrl, navigate, refreshBrokerConfig, refreshOnboardingConfig]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {step === 1 && (
          <div className="text-center space-y-6">
            <div className="text-6xl mb-4">⚡</div>
            <h1 className="text-3xl font-bold text-white">Smart Energy Monitor</h1>
            <p className="text-gray-400">
              Track your energy consumption in real-time and save on electricity costs
            </p>
            <div className="space-y-3 text-left bg-gray-800 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h3 className="text-white font-semibold">Real-time Monitoring</h3>
                  <p className="text-gray-400 text-sm">Track power usage as it happens</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">💰</span>
                <div>
                  <h3 className="text-white font-semibold">Cost Tracking</h3>
                  <p className="text-gray-400 text-sm">Monitor your electricity expenses</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>
                <div>
                  <h3 className="text-white font-semibold">Smart Automation</h3>
                  <p className="text-gray-400 text-sm">Set rules and schedules</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold"
            >
              Get Started
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Connect to MQTT Broker</h2>
              <p className="text-gray-400">Enter your MQTT WebSocket URL (port + path)</p>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-400 rounded-lg p-3 text-sm">
                {error}
              </div>
            )}

            <div className="bg-gray-800 rounded-xl p-6 space-y-4">
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
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Example: <code>ws://localhost:9001/mqtt</code> or{" "}
                  <code>wss://broker.example.com:8083/mqtt</code>
                </p>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold"
            >
              {connecting ? "Connecting..." : "Connect"}
            </button>

            <button onClick={() => setStep(1)} className="w-full text-gray-400 hover:text-white">
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
