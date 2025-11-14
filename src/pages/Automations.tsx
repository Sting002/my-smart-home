import React, { useCallback, useState } from "react";
import { useEnergy } from "../contexts/EnergyContext";
import { mqttService } from "@/services/mqttService";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";

type RuleAction = "notify" | "turnOff" | "turnOn";
type TriggerType = "power" | "time" | "schedule";
type ScheduleDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

interface RuleDraft {
  deviceId: string;
  triggerType: TriggerType;
  // Power trigger fields
  thresholdW: number;
  minutes: number;
  // Time trigger fields
  timeHour: number;
  timeMinute: number;
  // Schedule trigger fields
  scheduleDays: ScheduleDay[];
  scheduleTime: string;
  // Action
  action: RuleAction;
  enabled: boolean;
}

export const Automations: React.FC = () => {
  const { devices, homeId, updateDevice } = useEnergy();
  const navigate = useNavigate();

  // Rule builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>({
    deviceId: "",
    triggerType: "power",
    thresholdW: 1000,
    minutes: 5,
    timeHour: 22,
    timeMinute: 0,
    scheduleDays: [],
    scheduleTime: "22:00",
    action: "notify",
    enabled: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<(RuleDraft & { id: string; lastTriggered?: number })[]>(
    () => JSON.parse(localStorage.getItem("rules") || "[]")
  );
  const saveRules = useCallback((next: typeof rules) => {
    setRules(next);
    localStorage.setItem("rules", JSON.stringify(next));
  }, []);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDraft((prev) => {
      if (name === "thresholdW" || name === "minutes" || name === "timeHour" || name === "timeMinute") {
        return { ...prev, [name]: Number(value) };
      }
      return { ...prev, [name]: value };
    });
  }, []);

  const toggleScheduleDay = useCallback((day: ScheduleDay) => {
    setDraft((prev) => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter((d) => d !== day)
        : [...prev.scheduleDays, day],
    }));
  }, []);

  const addRule = useCallback(() => {
    const nextErrors: Record<string, string> = {};
    if (!draft.deviceId) nextErrors.deviceId = "Select a device";
    
    if (draft.triggerType === "power") {
      if (!draft.thresholdW || draft.thresholdW < 1) nextErrors.thresholdW = "Enter a positive threshold";
      if (!draft.minutes || draft.minutes < 1) nextErrors.minutes = "Enter minutes ≥ 1";
    } else if (draft.triggerType === "time") {
      if (draft.timeHour < 0 || draft.timeHour > 23) nextErrors.timeHour = "Hour must be 0-23";
      if (draft.timeMinute < 0 || draft.timeMinute > 59) nextErrors.timeMinute = "Minute must be 0-59";
    } else if (draft.triggerType === "schedule") {
      if (draft.scheduleDays.length === 0) nextErrors.scheduleDays = "Select at least one day";
      if (!draft.scheduleTime) nextErrors.scheduleTime = "Enter a time";
    }
    
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const newRule = { ...draft, id: `${Date.now()}` } as RuleDraft & { id: string };
    const next = [newRule, ...rules].slice(0, 50);
    saveRules(next);
    setShowBuilder(false);
    toast({ title: "Rule created", description: "Automation rule added successfully" });
  }, [draft, rules, saveRules]);

  const removeRule = useCallback(
    (id: string) => {
      saveRules(rules.filter((r) => r.id !== id));
      toast({ title: "Rule deleted" });
    },
    [rules, saveRules]
  );

  const toggleRule = useCallback(
    (id: string) => {
      const next = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
      saveRules(next);
      const rule = next.find((r) => r.id === id);
      toast({ title: rule?.enabled ? "Rule enabled" : "Rule disabled" });
    },
    [rules, saveRules]
  );

  const getRuleDescription = useCallback((rule: RuleDraft & { id: string }) => {
    const device = devices.find((d) => d.id === rule.deviceId);
    const deviceName = device?.name ?? rule.deviceId;
    
    let trigger = "";
    if (rule.triggerType === "power") {
      trigger = `if power > ${rule.thresholdW}W for ${rule.minutes} min`;
    } else if (rule.triggerType === "time") {
      const hour = String(rule.timeHour).padStart(2, "0");
      const minute = String(rule.timeMinute).padStart(2, "0");
      trigger = `at ${hour}:${minute} daily`;
    } else if (rule.triggerType === "schedule") {
      const days = rule.scheduleDays.map((d) => d.slice(0, 3)).join(", ");
      trigger = `on ${days} at ${rule.scheduleTime}`;
    }
    
    return { deviceName, trigger };
  }, [devices]);

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Automation Rules</h2>
            <p className="text-gray-400 text-sm">Create smart rules to automate your devices</p>
          </div>
          <button
            onClick={() => setShowBuilder((s) => !s)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            + New Rule
          </button>
        </div>

        {showBuilder && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Create Automation Rule</h3>
            
            {/* Device Selection */}
            <div className="mb-4">
              <label htmlFor="deviceId" className="text-gray-400 text-sm font-medium block mb-2">
                Device
              </label>
              <select
                id="deviceId"
                name="deviceId"
                value={draft.deviceId}
                onChange={onChange}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select device...</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {errors.deviceId && <p className="text-xs text-red-400 mt-1">{errors.deviceId}</p>}
            </div>

            {/* Trigger Type Selection */}
            <div className="mb-4">
              <label className="text-gray-400 text-sm font-medium block mb-2">Trigger Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, triggerType: "power" })}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    draft.triggerType === "power"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  ⚡ Power
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, triggerType: "time" })}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    draft.triggerType === "time"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  🕐 Time
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, triggerType: "schedule" })}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    draft.triggerType === "schedule"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  📅 Schedule
                </button>
              </div>
            </div>

            {/* Power Trigger Fields */}
            {draft.triggerType === "power" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label htmlFor="thresholdW" className="text-gray-400 text-sm">
                    Power Threshold (W)
                  </label>
                  <input
                    id="thresholdW"
                    name="thresholdW"
                    type="number"
                    value={draft.thresholdW}
                    onChange={onChange}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  {errors.thresholdW && <p className="text-xs text-red-400 mt-1">{errors.thresholdW}</p>}
                </div>
                <div>
                  <label htmlFor="minutes" className="text-gray-400 text-sm">
                    Duration (minutes)
                  </label>
                  <input
                    id="minutes"
                    name="minutes"
                    type="number"
                    value={draft.minutes}
                    onChange={onChange}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  {errors.minutes && <p className="text-xs text-red-400 mt-1">{errors.minutes}</p>}
                </div>
              </div>
            )}

            {/* Time Trigger Fields */}
            {draft.triggerType === "time" && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label htmlFor="timeHour" className="text-gray-400 text-sm">
                    Hour (0-23)
                  </label>
                  <input
                    id="timeHour"
                    name="timeHour"
                    type="number"
                    min="0"
                    max="23"
                    value={draft.timeHour}
                    onChange={onChange}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  {errors.timeHour && <p className="text-xs text-red-400 mt-1">{errors.timeHour}</p>}
                </div>
                <div>
                  <label htmlFor="timeMinute" className="text-gray-400 text-sm">
                    Minute (0-59)
                  </label>
                  <input
                    id="timeMinute"
                    name="timeMinute"
                    type="number"
                    min="0"
                    max="59"
                    value={draft.timeMinute}
                    onChange={onChange}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                  {errors.timeMinute && <p className="text-xs text-red-400 mt-1">{errors.timeMinute}</p>}
                </div>
              </div>
            )}

            {/* Schedule Trigger Fields */}
            {draft.triggerType === "schedule" && (
              <div className="mb-4">
                <label className="text-gray-400 text-sm block mb-2">Days of Week</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as ScheduleDay[]).map(
                    (day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleScheduleDay(day)}
                        className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                          draft.scheduleDays.includes(day)
                            ? "bg-blue-500 text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                      >
                        {day.slice(0, 3).toUpperCase()}
                      </button>
                    )
                  )}
                </div>
                {errors.scheduleDays && <p className="text-xs text-red-400 mb-2">{errors.scheduleDays}</p>}
                
                <label htmlFor="scheduleTime" className="text-gray-400 text-sm">
                  Time
                </label>
                <input
                  id="scheduleTime"
                  name="scheduleTime"
                  type="time"
                  value={draft.scheduleTime}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
                {errors.scheduleTime && <p className="text-xs text-red-400 mt-1">{errors.scheduleTime}</p>}
              </div>
            )}

            {/* Action Selection */}
            <div className="mb-4">
              <label htmlFor="action" className="text-gray-400 text-sm font-medium block mb-2">
                Action
              </label>
              <select
                id="action"
                name="action"
                value={draft.action}
                onChange={onChange}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="notify">📢 Send notification</option>
                <option value="turnOff">⚫ Turn off device</option>
                <option value="turnOn">🟢 Turn on device</option>
              </select>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={addRule}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-semibold transition-colors"
              >
                Save Rule
              </button>
              <button
                onClick={() => {
                  setShowBuilder(false);
                  setErrors({});
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🤖</div>
            <div className="text-gray-400 text-sm">No automation rules configured yet</div>
            <div className="text-gray-500 text-xs mt-1">Click "+ New Rule" to create your first automation</div>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const { deviceName, trigger } = getRuleDescription(rule);
              const isEnabled = rule.enabled !== false;
              
              return (
                <div
                  key={rule.id}
                  className={`rounded-lg p-4 border transition-all ${
                    isEnabled
                      ? "bg-gray-800/80 border-gray-700"
                      : "bg-gray-900/50 border-gray-800 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            isEnabled ? "bg-green-500" : "bg-gray-600"
                          }`}
                        />
                        <span className="text-white font-semibold">{deviceName}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                          {rule.triggerType}
                        </span>
                      </div>
                      
                      <div className="text-gray-300 text-sm mb-1">
                        {trigger} → <span className="text-blue-400">{rule.action}</span>
                      </div>
                      
                      {rule.lastTriggered && (
                        <div className="text-xs text-gray-500">
                          Last triggered: {new Date(rule.lastTriggered).toLocaleString()}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleRule(rule.id)}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                          isEnabled
                            ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                            : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                        }`}
                        title={isEnabled ? "Disable rule" : "Enable rule"}
                      >
                        {isEnabled ? "ON" : "OFF"}
                      </button>
                      <button
                        onClick={() => removeRule(rule.id)}
                        className="text-gray-400 hover:text-red-400 px-2 py-1 transition-colors"
                        aria-label="Remove rule"
                        title="Delete rule"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Automations;



