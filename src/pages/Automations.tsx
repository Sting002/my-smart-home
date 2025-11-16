import React, { useCallback, useMemo, useState } from "react";
import { useEnergy } from "../contexts/EnergyContext";
import { toast } from "@/hooks/use-toast";
import { useServerRules } from "@/hooks/useServerRules";
import type { CreateRuleRequest, Rule } from "@/api/rules";

type RuleAction = "notify" | "turnOff" | "turnOn";
type TriggerType = "power" | "time" | "schedule";
type ScheduleDay =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

interface RuleDraft {
  id?: string;
  deviceId: string;
  triggerType: TriggerType;
  thresholdW: number;
  minutes: number;
  timeHour: number;
  timeMinute: number;
  scheduleDays: ScheduleDay[];
  scheduleTime: string;
  action: RuleAction;
  enabled: boolean;
}

type ListRule = RuleDraft & { id: string };

const DAY_ORDER: ScheduleDay[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const DAY_TO_INDEX: Record<ScheduleDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DEFAULT_DRAFT: RuleDraft = {
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
};

const pad = (value: number) => String(value).padStart(2, "0");

const serializeRule = (draft: RuleDraft, homeId: string): CreateRuleRequest => {
  const base: CreateRuleRequest = {
    id: draft.id,
    name: `Automation ${draft.deviceId}`,
    enabled: draft.enabled,
    homeId,
    conditions: [],
    actions: [],
  };

  if (draft.triggerType === "power") {
    base.conditions.push({
      type: "power_threshold",
      uiType: "power",
      deviceId: draft.deviceId,
      operator: ">",
      threshold: draft.thresholdW,
      durationMinutes: draft.minutes,
    });
  } else if (draft.triggerType === "time") {
    const time = `${pad(draft.timeHour)}:${pad(draft.timeMinute)}`;
    base.conditions.push({
      type: "time_of_day",
      uiType: "time",
      start: time,
      end: time,
      mode: "exact",
    });
  } else if (draft.triggerType === "schedule") {
    const time = draft.scheduleTime || "22:00";
    base.conditions.push({
      type: "day_of_week",
      uiType: "schedule",
      days: draft.scheduleDays.map((d) => DAY_TO_INDEX[d]),
    });
    base.conditions.push({
      type: "time_of_day",
      uiType: "schedule",
      start: time,
      end: time,
      mode: "exact",
    });
  }

  if (draft.action === "turnOff" || draft.action === "turnOn") {
    base.actions.push({
      type: "set_device",
      uiType: draft.action,
      deviceId: draft.deviceId,
      on: draft.action === "turnOn",
    });
  } else if (draft.action === "notify") {
    base.actions.push({
      type: "alert",
      uiType: "notify",
      severity: "info",
      message: `Automation triggered for ${draft.deviceId}`,
    });
  }

  return base;
};

const deserializeRule = (rule: Rule): ListRule | null => {
  if (!rule.conditions?.length || !rule.actions?.length) return null;
  const primaryCondition = rule.conditions[0];
  const primaryAction = rule.actions[0];

  const draft: ListRule = {
    id: rule.id,
    deviceId: primaryCondition.deviceId ?? primaryAction.deviceId ?? "",
    triggerType: "power",
    thresholdW: 1000,
    minutes: primaryCondition.durationMinutes ?? 5,
    timeHour: 22,
    timeMinute: 0,
    scheduleDays: [],
    scheduleTime: "22:00",
    action: "notify",
    enabled: rule.enabled,
  } as ListRule;

  if (primaryCondition.uiType === "time" || primaryCondition.mode === "exact") {
    draft.triggerType = "time";
    const [h, m] = String(primaryCondition.start ?? "0:0")
      .split(":")
      .map((val) => Number(val));
    draft.timeHour = Number.isFinite(h) ? h : 0;
    draft.timeMinute = Number.isFinite(m) ? m : 0;
  } else if (primaryCondition.uiType === "schedule") {
    draft.triggerType = "schedule";
    const dayCondition = rule.conditions.find((c) => c.type === "day_of_week");
    const timeCondition = rule.conditions.find((c) => c.type === "time_of_day");
    if (dayCondition?.days?.length) {
      draft.scheduleDays = dayCondition.days
        .map((day) => DAY_ORDER[day] ?? null)
        .filter((v): v is ScheduleDay => Boolean(v));
    }
    if (typeof timeCondition?.start === "string") {
      draft.scheduleTime = timeCondition.start;
    }
  } else if (primaryCondition.type === "power_threshold") {
    draft.triggerType = "power";
    draft.thresholdW = primaryCondition.threshold ?? 1000;
  }

  if (primaryAction.uiType === "turnOff" || primaryAction.on === false) {
    draft.action = "turnOff";
  } else if (primaryAction.uiType === "turnOn" || primaryAction.on === true) {
    draft.action = "turnOn";
  } else if (primaryAction.type === "alert") {
    draft.action = "notify";
  }

  return draft;
};

export const Automations: React.FC = () => {
  const { devices, homeId } = useEnergy();
  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(DEFAULT_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const {
    rules: serverRules,
    loading,
    error,
    addRule: createRule,
    toggleRule: toggleRuleOnServer,
    removeRule: removeRuleOnServer,
  } = useServerRules();

  const rules = useMemo(
    () =>
      serverRules
        .map(deserializeRule)
        .filter((r): r is ListRule => Boolean(r))
        .slice(0, 50),
    [serverRules]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setDraft((prev) => {
        if (
          name === "thresholdW" ||
          name === "minutes" ||
          name === "timeHour" ||
          name === "timeMinute"
        ) {
          return { ...prev, [name]: Number(value) };
        }
        return { ...prev, [name]: value };
      });
    },
    []
  );

  const toggleScheduleDay = useCallback((day: ScheduleDay) => {
    setDraft((prev) => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter((d) => d !== day)
        : [...prev.scheduleDays, day],
    }));
  }, []);

  const validateDraft = useCallback(() => {
    const nextErrors: Record<string, string> = {};
    if (!draft.deviceId) nextErrors.deviceId = "Select a device";

    if (draft.triggerType === "power") {
      if (!draft.thresholdW || draft.thresholdW < 1)
        nextErrors.thresholdW = "Enter a positive threshold";
      if (!draft.minutes || draft.minutes < 1)
        nextErrors.minutes = "Enter minutes ≥ 1";
    } else if (draft.triggerType === "time") {
      if (draft.timeHour < 0 || draft.timeHour > 23)
        nextErrors.timeHour = "Hour must be 0-23";
      if (draft.timeMinute < 0 || draft.timeMinute > 59)
        nextErrors.timeMinute = "Minute must be 0-59";
    } else if (draft.triggerType === "schedule") {
      if (draft.scheduleDays.length === 0)
        nextErrors.scheduleDays = "Select at least one day";
      if (!draft.scheduleTime) nextErrors.scheduleTime = "Enter a time";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [draft]);

  const handleCreateRule = useCallback(async () => {
    if (!validateDraft()) return;
    try {
      await createRule(serializeRule(draft, homeId));
      setShowBuilder(false);
      setDraft(DEFAULT_DRAFT);
      toast({ title: "Rule created", description: "Automation rule saved." });
    } catch (err) {
      console.error("Failed to create rule", err);
      toast({ title: "Failed to create rule", description: "Try again later." });
    }
  }, [createRule, draft, homeId, validateDraft]);

  const removeRule = useCallback(
    async (id: string) => {
      try {
        await removeRuleOnServer(id);
        toast({ title: "Rule deleted" });
      } catch (err) {
        console.error("Failed to delete rule", err);
        toast({ title: "Failed to delete rule", description: "Try again later." });
      }
    },
    [removeRuleOnServer]
  );

  const toggleRule = useCallback(
    async (id: string) => {
      try {
        const result = await toggleRuleOnServer(id);
        toast({
          title: result.enabled ? "Rule enabled" : "Rule disabled",
        });
      } catch (err) {
        console.error("Failed to toggle rule", err);
        toast({ title: "Failed to toggle rule", description: "Try again later." });
      }
    },
    [toggleRuleOnServer]
  );

  const getRuleDescription = useCallback(
    (rule: ListRule) => {
      const device = devices.find((d) => d.id === rule.deviceId);
      const deviceName = device?.name ?? rule.deviceId;

      let trigger = "";
      if (rule.triggerType === "power") {
        trigger = `if power > ${rule.thresholdW}W for ${rule.minutes} min`;
      } else if (rule.triggerType === "time") {
        trigger = `at ${pad(rule.timeHour)}:${pad(rule.timeMinute)} daily`;
      } else if (rule.triggerType === "schedule") {
        trigger = `on ${rule.scheduleDays.join(", ")} at ${rule.scheduleTime}`;
      }

      const actionLabel =
        rule.action === "notify"
          ? "send notification"
          : rule.action === "turnOff"
          ? "turn off"
          : "turn on";

      return `${deviceName} - ${trigger}, ${actionLabel}`;
    },
    [devices]
  );

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-white font-semibold text-lg">Automation Rules</h2>
            <p className="text-gray-400 text-sm">
              Create smart rules to automate your devices
            </p>
          </div>
          <button
            onClick={() => setShowBuilder((s) => !s)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {showBuilder ? "Cancel" : "New Rule"}
          </button>
        </div>

        {showBuilder && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Create Automation Rule</h3>
            <div className="grid gap-4">
              <div>
                <label htmlFor="deviceId" className="text-gray-400 text-sm font-medium block mb-2">
                  Device
                </label>
                <select
                  id="deviceId"
                  name="deviceId"
                  value={draft.deviceId}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="">Select device</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} ({device.room})
                    </option>
                  ))}
                </select>
                {errors.deviceId && <p className="text-red-400 text-xs mt-1">{errors.deviceId}</p>}
              </div>

              <div>
                <label className="text-gray-400 text-sm font-medium block mb-2">
                  Trigger Type
                </label>
                <select
                  name="triggerType"
                  value={draft.triggerType}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="power">Power threshold</option>
                  <option value="time">Time of day</option>
                  <option value="schedule">Weekly schedule</option>
                </select>
              </div>

              {draft.triggerType === "power" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-sm">Threshold (W)</label>
                    <input
                      type="number"
                      name="thresholdW"
                      value={draft.thresholdW}
                      onChange={onChange}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    />
                    {errors.thresholdW && (
                      <p className="text-red-400 text-xs mt-1">{errors.thresholdW}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Duration (minutes)</label>
                    <input
                      type="number"
                      name="minutes"
                      value={draft.minutes}
                      onChange={onChange}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    />
                    {errors.minutes && (
                      <p className="text-red-400 text-xs mt-1">{errors.minutes}</p>
                    )}
                  </div>
                </div>
              )}

              {draft.triggerType === "time" && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-sm">Hour</label>
                    <input
                      type="number"
                      name="timeHour"
                      value={draft.timeHour}
                      onChange={onChange}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    />
                    {errors.timeHour && (
                      <p className="text-red-400 text-xs mt-1">{errors.timeHour}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Minute</label>
                    <input
                      type="number"
                      name="timeMinute"
                      value={draft.timeMinute}
                      onChange={onChange}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    />
                    {errors.timeMinute && (
                      <p className="text-red-400 text-xs mt-1">{errors.timeMinute}</p>
                    )}
                  </div>
                </div>
              )}

              {draft.triggerType === "schedule" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-400 text-sm">Days</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {DAY_ORDER.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleScheduleDay(day)}
                          className={`px-3 py-1 rounded-full text-xs ${
                            draft.scheduleDays.includes(day)
                              ? "bg-green-500/20 text-green-300"
                              : "bg-gray-700 text-gray-400"
                          }`}
                        >
                          {day.slice(0, 3).toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {errors.scheduleDays && (
                      <p className="text-red-400 text-xs mt-1">{errors.scheduleDays}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Time</label>
                    <input
                      type="time"
                      name="scheduleTime"
                      value={draft.scheduleTime}
                      onChange={onChange}
                      className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    />
                    {errors.scheduleTime && (
                      <p className="text-red-400 text-xs mt-1">{errors.scheduleTime}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="text-gray-400 text-sm font-medium block mb-2">
                  Action
                </label>
                <select
                  name="action"
                  value={draft.action}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="notify">Send notification</option>
                  <option value="turnOff">Turn device off</option>
                  <option value="turnOn">Turn device on</option>
                </select>
              </div>

              <button
                onClick={handleCreateRule}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold"
              >
                Save Rule
              </button>
            </div>
          </div>
        )}

        {loading && !rules.length && (
          <p className="text-gray-400 text-sm">Loading automations…</p>
        )}

        {error && (
          <p className="text-red-400 text-sm">
            Failed to load rules. {error}
          </p>
        )}

        {!loading && rules.length === 0 && !showBuilder && (
          <p className="text-gray-400 text-sm">No automations yet. Create your first rule.</p>
        )}

        <div className="space-y-3">
          {rules.map((rule) => {
            const description = getRuleDescription(rule);
            return (
              <div
                key={rule.id}
                className="bg-gray-900 rounded-lg p-4 border border-gray-800 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-semibold">
                      {description}
                    </h4>
                    <p className="text-gray-400 text-xs">
                      Action:{" "}
                      {rule.action === "notify"
                        ? "Notify only"
                        : rule.action === "turnOff"
                        ? "Turn off device"
                        : "Turn on device"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                        rule.enabled
                          ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                      }`}
                    >
                      {rule.enabled ? "ON" : "OFF"}
                    </button>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="text-gray-400 hover:text-red-400 px-2 py-1 transition-colors"
                      aria-label="Delete rule"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Automations;
