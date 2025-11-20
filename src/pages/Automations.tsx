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
  name: string;
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

type ListRule = RuleDraft & { id: string; createdAt?: string };

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

const createDefaultDraft = (): RuleDraft => ({
  id: undefined,
  name: "Automation rule",
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

const pad = (value: number) => String(value).padStart(2, "0");

const serializeRule = (draft: RuleDraft, homeId: string): CreateRuleRequest => {
  const base: CreateRuleRequest = {
    id: draft.id,
    name: draft.name.trim() || `Automation ${draft.deviceId || ""}`.trim() || "Automation",
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
    name: rule.name ?? "",
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
    createdAt: rule.created_at,
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
  const [draft, setDraft] = useState<RuleDraft>(createDefaultDraft);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterDeviceId, setFilterDeviceId] = useState<string>("");
  const [filterTriggerType, setFilterTriggerType] = useState<TriggerType | "">("");
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"created" | "name">("created");

  const {
    rules: serverRules,
    loading,
    error,
    addRule: createRule,
    editRule: updateRule,
    toggleRule: toggleRuleOnServer,
    removeRule: removeRuleOnServer,
  } = useServerRules();

  const rules = useMemo(
    () =>
      serverRules
        .map(deserializeRule)
        .filter((r): r is ListRule => Boolean(r)),
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

  const visibleRules = useMemo(() => {
    let list = rules;
    if (filterDeviceId) {
      list = list.filter((rule) => rule.deviceId === filterDeviceId);
    }
    if (filterTriggerType) {
      list = list.filter((rule) => rule.triggerType === filterTriggerType);
    }
    if (showEnabledOnly) {
      list = list.filter((rule) => rule.enabled);
    }

    const sorted = [...list].sort((a, b) => {
      if (sortBy === "name") {
        return (a.name || "").localeCompare(b.name || "", undefined, {
          sensitivity: "base",
        });
      }
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    return sorted.slice(0, 50);
  }, [filterDeviceId, filterTriggerType, rules, showEnabledOnly, sortBy]);

  const validateDraft = useCallback(() => {
    const nextErrors: Record<string, string> = {};
    if (!draft.deviceId) nextErrors.deviceId = "Select a device";

    if (draft.triggerType === "power") {
      if (!draft.thresholdW || draft.thresholdW < 1)
        nextErrors.thresholdW = "Enter a positive threshold";
      if (!draft.minutes || draft.minutes < 1)
        nextErrors.minutes = "Enter minutes >= 1";
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

  const resetBuilder = useCallback(() => {
    setErrors({});
    setEditingRuleId(null);
    setDraft(createDefaultDraft());
  }, []);

  const startEditing = useCallback((rule: ListRule) => {
    setShowBuilder(true);
    setErrors({});
    setEditingRuleId(rule.id);
    setDraft({
      ...rule,
      scheduleDays: [...rule.scheduleDays],
    });
  }, []);

  const handleSaveRule = useCallback(async () => {
    if (!validateDraft()) return;
    try {
      const payload = serializeRule(
        { ...draft, id: editingRuleId ?? draft.id },
        homeId || "home1"
      );

      if (editingRuleId) {
        await updateRule(payload);
        toast({ title: "Rule updated", description: "Automation rule saved." });
      } else {
        await createRule(payload);
        toast({ title: "Rule created", description: "Automation rule saved." });
      }

      setShowBuilder(false);
      resetBuilder();
    } catch (err) {
      console.error("Failed to save rule", err);
      toast({
        title: editingRuleId ? "Failed to update rule" : "Failed to create rule",
        description: "Try again later.",
      });
    }
  }, [createRule, draft, editingRuleId, homeId, resetBuilder, updateRule, validateDraft]);

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

  const confirmAndRemoveRule = useCallback(
    async (id: string) => {
      const target = rules.find((r) => r.id === id);
      const confirmed = window.confirm(
        `Delete automation "${target?.name || target?.deviceId || id}"?\nThis cannot be undone.`
      );
      if (!confirmed) return;
      await removeRule(id);
    },
    [removeRule, rules]
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
      const deviceName = device?.name || rule.deviceId || "Unknown device";

      let trigger = "";
      if (rule.triggerType === "power") {
        trigger = `if power > ${rule.thresholdW}W for ${rule.minutes} min`;
      } else if (rule.triggerType === "time") {
        trigger = `at ${pad(rule.timeHour)}:${pad(rule.timeMinute)} daily`;
      } else if (rule.triggerType === "schedule") {
        const daysLabel = [...rule.scheduleDays]
          .sort((a, b) => DAY_TO_INDEX[a] - DAY_TO_INDEX[b])
          .map((day) => day.slice(0, 3).toUpperCase())
          .join(", ");
        trigger = `on ${daysLabel || "selected days"} at ${rule.scheduleTime}`;
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

  const formatCreated = useCallback((value?: string) => {
    if (!value) return "Created date unknown";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Created date unknown";
    return `Created ${date.toLocaleString()}`;
  }, []);

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
            onClick={() => {
              if (showBuilder) {
                setShowBuilder(false);
                resetBuilder();
              } else {
                resetBuilder();
                setShowBuilder(true);
              }
            }}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            {showBuilder ? (editingRuleId ? "Cancel edit" : "Cancel") : "New Rule"}
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-4 sm:grid-cols-2 mb-4">
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Filter by device</label>
            <select
              value={filterDeviceId}
              onChange={(e) => setFilterDeviceId(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">All devices</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.room})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Trigger</label>
            <select
              value={filterTriggerType}
              onChange={(e) => setFilterTriggerType(e.target.value as TriggerType | "")}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">All triggers</option>
              <option value="power">Power</option>
              <option value="time">Time</option>
              <option value="schedule">Schedule</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="enabledOnly"
              type="checkbox"
              checked={showEnabledOnly}
              onChange={(e) => setShowEnabledOnly(e.target.checked)}
              className="h-4 w-4 accent-green-500"
            />
            <label htmlFor="enabledOnly" className="text-gray-300 text-sm">
              Show enabled only
            </label>
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "created" | "name")}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="created">Newest first</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        {showBuilder && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">
                {editingRuleId ? "Edit Automation Rule" : "Create Automation Rule"}
              </h3>
              {editingRuleId && (
                <span className="text-xs text-gray-400">Updating existing rule</span>
              )}
            </div>
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm font-medium block mb-2">
                    Rule name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={draft.name}
                    onChange={onChange}
                    placeholder="e.g. Turn off heater if above 2kW"
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <label className="text-gray-400 text-sm font-medium" htmlFor="builder-enabled">
                    Enabled
                  </label>
                  <input
                    id="builder-enabled"
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        enabled: e.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-green-500"
                  />
                </div>
              </div>
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
                onClick={handleSaveRule}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold"
              >
                {editingRuleId ? "Update Rule" : "Save Rule"}
              </button>
              {editingRuleId && (
                <button
                  type="button"
                  onClick={resetBuilder}
                  className="text-gray-400 hover:text-gray-200 text-sm font-semibold w-max"
                >
                  Reset form
                </button>
              )}
            </div>
          </div>
        )}

        {loading && !rules.length && (
          <p className="text-gray-400 text-sm">Loading automations...</p>
        )}

        {error && (
          <p className="text-red-400 text-sm">
            Failed to load rules. {error}
          </p>
        )}

        {!loading && rules.length === 0 && !showBuilder && (
          <p className="text-gray-400 text-sm">No automations yet. Create your first rule.</p>
        )}
        {!loading && rules.length > 0 && visibleRules.length === 0 && (
          <p className="text-gray-400 text-sm">
            No rules match the current filters. Try clearing filters.
          </p>
        )}

        <div className="space-y-3">
          {visibleRules.map((rule) => {
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
                    <p className="text-gray-500 text-xs">
                      {rule.enabled ? "Enabled" : "Disabled"} • {formatCreated(rule.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEditing(rule)}
                      className="text-gray-300 hover:text-white text-xs font-semibold px-3 py-1 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      Edit
                    </button>
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
                      onClick={() => confirmAndRemoveRule(rule.id)}
                      className="text-gray-400 hover:text-red-400 px-2 py-1 transition-colors text-xs font-semibold"
                      aria-label="Delete rule"
                    >
                      Delete
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
