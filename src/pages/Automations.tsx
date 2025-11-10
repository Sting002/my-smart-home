import React, { useCallback, useMemo, useState } from "react";
import { useEnergy } from "../contexts/EnergyContext";
import { mqttService } from "@/services/mqttService";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";

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
  sceneId?: string;
}

export const Automations: React.FC = () => {
  const { devices, homeId, updateDevice } = useEnergy();
  const navigate = useNavigate();

  // Built-in scenes (targets computed at runtime if no explicit actions)
  const builtinScenes: Scene[] = useMemo(
    () => [
      { id: "away", name: "Away Mode", icon: "🏠", actions: [] },
      { id: "sleep", name: "Sleep Mode", icon: "🌙", actions: [] },
      { id: "workday", name: "Workday", icon: "💼", actions: [] },
      { id: "weekend", name: "Weekend", icon: "🎉", actions: [] },
    ],
    []
  );

  // Custom scenes persisted locally and combined with built-ins for display
  const [customScenes, setCustomScenes] = useState<Scene[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("scenes") || "[]") as Scene[];
    } catch {
      return [] as Scene[];
    }
  });
  const saveCustomScenes = useCallback((next: Scene[]) => {
    setCustomScenes(next);
    localStorage.setItem("scenes", JSON.stringify(next));
  }, []);
  const scenes: Scene[] = useMemo(() => [...builtinScenes, ...customScenes], [builtinScenes, customScenes]);

  // Rule builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>({
    deviceId: "",
    thresholdW: 1000,
    minutes: 5,
    action: "notify",
    sceneId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rules, setRules] = useState<(RuleDraft & { id: string; lastTriggered?: number })[]>(
    () => JSON.parse(localStorage.getItem("rules") || "[]")
  );
  const saveRules = useCallback((next: typeof rules) => {
    setRules(next);
    localStorage.setItem("rules", JSON.stringify(next));
  }, []);

  // Scenes editor state
  const [showSceneEditor, setShowSceneEditor] = useState(false);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [sceneDraft, setSceneDraft] = useState<Scene>(() => ({
    id: "",
    name: "New Scene",
    icon: "⭐",
    actions: devices.map((d) => ({ deviceId: d.id, turnOn: d.isOn })),
  }));

  const openNewScene = useCallback(() => {
    setEditingSceneId(null);
    setSceneDraft({
      id: "",
      name: "New Scene",
      icon: "⭐",
      actions: devices.map((d) => ({ deviceId: d.id, turnOn: d.isOn })),
    });
    setShowSceneEditor(true);
  }, [devices]);

  const openEditScene = useCallback(
    (scene: Scene) => {
      const merged = devices.map((d) => {
        const found = scene.actions.find((a) => a.deviceId === d.id);
        return { deviceId: d.id, turnOn: found ? found.turnOn : d.isOn };
      });
      setEditingSceneId(scene.id);
      setSceneDraft({ ...scene, actions: merged });
      setShowSceneEditor(true);
    },
    [devices]
  );

  const saveSceneDraft = useCallback(() => {
    const name = sceneDraft.name.trim();
    if (!name) {
      toast({ title: "Enter a scene name" });
      return;
    }
    if (editingSceneId) {
      const next = customScenes.map((s) => (s.id === editingSceneId ? { ...sceneDraft, id: editingSceneId } : s));
      saveCustomScenes(next);
      toast({ title: "Scene updated", description: name });
    } else {
      const id = `${Date.now()}`;
      const next = [{ ...sceneDraft, id }, ...customScenes];
      saveCustomScenes(next.slice(0, 50));
      toast({ title: "Scene created", description: name });
    }
    setShowSceneEditor(false);
    setEditingSceneId(null);
  }, [sceneDraft, editingSceneId, customScenes, saveCustomScenes]);

  const deleteScene = useCallback(
    (id: string) => {
      const next = customScenes.filter((s) => s.id !== id);
      saveCustomScenes(next);
      toast({ title: "Scene deleted" });
      if (editingSceneId === id) setShowSceneEditor(false);
    },
    [customScenes, editingSceneId, saveCustomScenes]
  );

  const isEssentialDevice = useCallback((name?: string, type?: string) => {
    const n = String(name || "").toLowerCase();
    const t = String(type || "").toLowerCase();
    return n.includes("fridge") || n.includes("refrigerator") || t.includes("fridge") || t.includes("refrigerator");
  }, []);

  const computeSceneTargets = useCallback(
    (sceneId: string) => {
      switch (sceneId) {
        case "away":
        case "sleep":
        case "workday":
          // Keep only essential devices on (e.g., refrigerator). Turn off others.
          return devices.map((d) => ({ deviceId: d.id, turnOn: isEssentialDevice(d.name, d.type) }));
        case "weekend":
          // Weekend: keep essentials on and leave others as-is
          return devices.map((d) => ({ deviceId: d.id, turnOn: isEssentialDevice(d.name, d.type) ? true : d.isOn }));
        default:
          // Fallback: no change
          return devices.map((d) => ({ deviceId: d.id, turnOn: d.isOn }));
      }
    },
    [devices, isEssentialDevice]
  );

  const activateScene = useCallback(
    (scene: Scene) => {
      if (!mqttService.isConnected()) {
        toast({
          title: "Not connected to MQTT",
          description: `Cannot activate "${scene.name}". Check Settings → Broker URL.`,
          action: (
            <ToastAction altText="Open Settings" onClick={() => navigate("/settings")}>
              Reconnect
            </ToastAction>
          ),
        });
        return;
      }

      const targets = scene.actions && scene.actions.length > 0 ? scene.actions : computeSceneTargets(scene.id);
      let turnedOn = 0;
      let turnedOff = 0;
      targets.forEach(({ deviceId, turnOn }) => {
        const d = devices.find((x) => x.id === deviceId);
        if (!d) return;

        // Optimistic UI update
        updateDevice(deviceId, {
          isOn: turnOn,
          watts: turnOn ? d.watts : Math.min(d.watts, 1),
        });

        // Publish command
        mqttService.publish(`home/${homeId}/cmd/${deviceId}/set`, { on: turnOn });
        if (turnOn) turnedOn++;
        else turnedOff++;
      });

      toast({ title: `Activated: ${scene.name}`, description: `Turned on ${turnedOn}, turned off ${turnedOff}.` });
    },
    [computeSceneTargets, devices, homeId, navigate, updateDevice]
  );

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDraft((prev) => ({
      ...prev,
      [name]: name === "thresholdW" || name === "minutes" ? Number(value) : value,
    }) as RuleDraft);
  }, []);

  const addRule = useCallback(() => {
    const nextErrors: Record<string, string> = {};
    if (!draft.deviceId) nextErrors.deviceId = "Select a device";
    if (!draft.thresholdW || draft.thresholdW < 1) nextErrors.thresholdW = "Enter a positive threshold";
    if (!draft.minutes || draft.minutes < 1) nextErrors.minutes = "Enter minutes ≥ 1";
    if (draft.action === "activateScene" && !draft.sceneId) nextErrors.sceneId = "Select a scene";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const newRule = { ...draft, id: `${Date.now()}` } as RuleDraft & { id: string };
    const next = [newRule, ...rules].slice(0, 50);
    saveRules(next);
    setShowBuilder(false);
  }, [draft, rules, saveRules]);

  const removeRule = useCallback(
    (id: string) => {
      saveRules(rules.filter((r) => r.id !== id));
    },
    [rules, saveRules]
  );

  const sceneNameFor = useCallback((id?: string) => scenes.find((s) => s.id === id)?.name || id || "scene", [scenes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white text-xl font-bold mb-4">Quick Scenes</h2>
        <div className="grid grid-cols-2 gap-4">
          {scenes.map((scene) => (
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

      {/* My Scenes (customizable) */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold">My Scenes</h2>
          <button
            onClick={openNewScene}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            + Add Scene
          </button>
        </div>

        {showSceneEditor && (
          <div className="bg-background rounded-lg p-4 mb-4 border border-gray-700">
            <h3 className="text-white font-semibold mb-3">{editingSceneId ? "Edit Scene" : "Create Scene"}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label htmlFor="sceneName" className="text-gray-400 text-sm">
                  Name
                </label>
                <input
                  id="sceneName"
                  type="text"
                  value={sceneDraft.name}
                  onChange={(e) => setSceneDraft({ ...sceneDraft, name: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                />
              </div>
              <div>
                <label htmlFor="sceneIcon" className="text-gray-400 text-sm">
                  Icon
                </label>
                <input
                  id="sceneIcon"
                  type="text"
                  value={sceneDraft.icon}
                  onChange={(e) => setSceneDraft({ ...sceneDraft, icon: e.target.value })}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                  placeholder="e.g., 🌙"
                />
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-white font-semibold mb-2">Devices</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {devices.map((d) => {
                  const idx = sceneDraft.actions.findIndex((a) => a.deviceId === d.id);
                  const turnOn = idx >= 0 ? sceneDraft.actions[idx].turnOn : d.isOn;
                  return (
                    <label key={d.id} className="flex items-center justify-between bg-gray-700/60 rounded px-3 py-2">
                      <span className="text-gray-200 text-sm">{d.name}</span>
                      <input
                        type="checkbox"
                        checked={turnOn}
                        onChange={(e) => {
                          const next = [...sceneDraft.actions];
                          const i = next.findIndex((a) => a.deviceId === d.id);
                          if (i >= 0) next[i] = { deviceId: d.id, turnOn: e.target.checked };
                          else next.push({ deviceId: d.id, turnOn: e.target.checked });
                          setSceneDraft({ ...sceneDraft, actions: next });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              {editingSceneId && (
                <button
                  onClick={() => editingSceneId && deleteScene(editingSceneId)}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Delete
                </button>
              )}
              <div className="flex-1" />
              <button
                onClick={() => setShowSceneEditor(false)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={saveSceneDraft}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                Save Scene
              </button>
            </div>
          </div>
        )}

        {customScenes.length === 0 ? (
          <div className="text-gray-400 text-sm">No custom scenes yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {customScenes.map((scene) => (
              <div key={scene.id} className="bg-background border border-gray-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="text-2xl">{scene.icon}</div>
                    <div className="text-white font-semibold">{scene.name}</div>
                  </div>
                  <div className="text-xs text-gray-400">{scene.actions.length} devices</div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => activateScene(scene)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-semibold"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => openEditScene(scene)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm font-semibold"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold">Automation Rules</h2>
          <button
            onClick={() => setShowBuilder((s) => !s)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            + New Rule
          </button>
        </div>

        {showBuilder && (
          <div className="bg-background rounded-lg p-4 mb-4 border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Create Rule</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="deviceId" className="text-gray-400 text-sm">
                  IF device
                </label>
                <select
                  id="deviceId"
                  name="deviceId"
                  value={draft.deviceId}
                  onChange={onChange}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
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

              <div>
                <label htmlFor="thresholdW" className="text-gray-400 text-sm">
                  Exceeds (W)
                </label>
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
                <label htmlFor="minutes" className="text-gray-400 text-sm">
                  For (minutes)
                </label>
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
                <label htmlFor="action" className="text-gray-400 text-sm">
                  THEN
                </label>
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

              {draft.action === "activateScene" && (
                <div>
                  <label htmlFor="sceneId" className="text-gray-400 text-sm">
                    Scene
                  </label>
                  <select
                    id="sceneId"
                    name="sceneId"
                    value={draft.sceneId || ""}
                    onChange={onChange}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                  >
                    <option value="">Select scene...</option>
                    {scenes.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {errors.sceneId && <p className="text-xs text-red-400 mt-1">{errors.sceneId}</p>}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-3">
              <button
                onClick={addRule}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded font-semibold"
              >
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
            {rules.map((rule) => {
              const device = devices.find((d) => d.id === rule.deviceId);
              const sceneName = rule.action === "activateScene" ? sceneNameFor(rule.sceneId) : undefined;
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between bg-background rounded-lg p-3 border border-gray-700"
                >
                  <div className="text-white/90 text-sm">
                    <span className="font-semibold">{device?.name ?? rule.deviceId}</span>{" "}
                    if &gt; {rule.thresholdW}W for {rule.minutes} min → {rule.action}
                    {sceneName ? `: ${sceneName}` : ""}
                    {rule.lastTriggered ? (
                      <span className="text-xs text-gray-500"> last {new Date(rule.lastTriggered).toLocaleString()}</span>
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

export default Automations;



