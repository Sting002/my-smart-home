import React, { useCallback, useMemo, useState } from "react";
import { useEnergy } from "../contexts/EnergyContext";

type RuleAction = "notify" | "turnOff" | "activateScene";

interface Scene {
  id: string;
  name: string;
  icon: string;
  actions: { deviceId: string; turnOn: boolean }[];
}

interface RuleDraft {
  deviceId: string;
  thresholdW: number;
  minutes: number;
  action: RuleAction;
}

export const Automations: React.FC = () => {
  const { devices, homeId } = useEnergy();

  const scenes: Scene[] = useMemo(
    () => [
      { id: "away", name: "Away Mode", icon: "🚗", actions: [] },
      { id: "sleep", name: "Sleep Mode", icon: "🌙", actions: [] },
      { id: "workday", name: "Workday", icon: "💼", actions: [] },
      { id: "weekend", name: "Weekend", icon: "🎉", actions: [] },
    ],
    []
  );

  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>({
    deviceId: "",
    thresholdW: 1000,
    minutes: 5,
    action: "notify",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<(RuleDraft & { id: string; lastTriggered?: number })[]>(
    () => JSON.parse(localStorage.getItem("rules") || "[]")
  );

  const saveRules = useCallback((next: typeof rules) => {
    setRules(next);
    localStorage.setItem("rules", JSON.stringify(next));
  }, []);

  const activateScene = useCallback((scene: Scene) => {
    // stub: integrate later with mqtt or device actions
    console.log("Activating scene:", scene.name, "home:", homeId);
  }, [homeId]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDraft(prev => ({
      ...prev,
      [name]: name === "thresholdW" || name === "minutes" ? Number(value) : value,
    }) as RuleDraft);
  }, []);

  const addRule = useCallback(() => {
    const nextErrors: Record<string, string> = {};
    if (!draft.deviceId) nextErrors.deviceId = "Select a device";
    if (!draft.thresholdW || draft.thresholdW < 1) nextErrors.thresholdW = "Enter a positive threshold";
    if (!draft.minutes || draft.minutes < 1) nextErrors.minutes = "Enter minutes ≥ 1";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const newRule = { ...draft, id: `${Date.now()}` };
    const next = [newRule, ...rules].slice(0, 50);
    saveRules(next);
    setShowBuilder(false);
  }, [draft, rules, saveRules]);

  const removeRule = useCallback((id: string) => {
    saveRules(rules.filter(r => r.id !== id));
  }, [rules, saveRules]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-xl font-bold mb-4">Quick Scenes</h2>
        <div className="grid grid-cols-2 gap-4">
          {scenes.map(scene => (
            <button
              key={scene.id}
              onClick={() => activateScene(scene)}
              className="bg-gray-800 hover:bg-gray-750 rounded-xl p-6 text-center transition-all border border-gray-700"
            >
              <div className="text-4xl mb-2">{scene.icon}</div>
              <div className="text-white font-semibold">{scene.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold">Automation Rules</h2>
          <button
            onClick={() => setShowBuilder(s => !s)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            + New Rule
          </button>
        </div>

        {showBuilder && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Create Rule</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="deviceId" className="text-gray-400 text-sm">IF device</label>
                <select
                  id="deviceId"
                  name="deviceId"
                  value={draft.deviceId}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                >
                  <option value="">Select device...</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                {errors.deviceId && <p className="text-xs text-red-400 mt-1">{errors.deviceId}</p>}
              </div>

              <div>
                <label htmlFor="thresholdW" className="text-gray-400 text-sm">Exceeds (W)</label>
                <input
                  id="thresholdW"
                  name="thresholdW"
                  type="number"
                  value={draft.thresholdW}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                />
                {errors.thresholdW && <p className="text-xs text-red-400 mt-1">{errors.thresholdW}</p>}
              </div>

              <div>
                <label htmlFor="minutes" className="text-gray-400 text-sm">For (minutes)</label>
                <input
                  id="minutes"
                  name="minutes"
                  type="number"
                  value={draft.minutes}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                />
                {errors.minutes && <p className="text-xs text-red-400 mt-1">{errors.minutes}</p>}
              </div>

              <div>
                <label htmlFor="action" className="text-gray-400 text-sm">THEN</label>
                <select
                  id="action"
                  name="action"
                  value={draft.action}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                >
                  <option value="notify">Send notification</option>
                  <option value="turnOff">Turn off device</option>
                  <option value="activateScene">Activate scene</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <button onClick={addRule} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded font-semibold">
                Save Rule
              </button>
              <button
                onClick={() => setShowBuilder(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No automation rules configured yet</div>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => {
              const device = devices.find(d => d.id === rule.deviceId);
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between bg-gray-900 rounded-lg p-3 border border-gray-700"
                >
                  <div className="text-gray-300 text-sm">
                    <span className="font-semibold">{device?.name ?? rule.deviceId}</span>{" "}
                    if &gt; {rule.thresholdW}W for {rule.minutes} min → {rule.action}
                    {rule.lastTriggered ? (
                      <span className="text-xs text-gray-500"> • last {new Date(rule.lastTriggered).toLocaleString()}</span>
                    ) : null}
                  </div>
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="text-gray-400 hover:text-red-400 text-sm"
                    aria-label="Remove rule"
                    title="Remove rule"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
