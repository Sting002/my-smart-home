import React, { useState } from "react";
import { useEnergy } from "../contexts/EnergyContext";

interface Scene {
  id: string;
  name: string;
  icon: string;
  actions: { deviceId: string; turnOn: boolean }[];
}

export const Automations: React.FC = () => {
  const { devices, homeId } = useEnergy();
  const [scenes] = useState<Scene[]>([
    { id: "away", name: "Away Mode", icon: "🚗", actions: [] },
    { id: "sleep", name: "Sleep Mode", icon: "🌙", actions: [] },
    { id: "workday", name: "Workday", icon: "💼", actions: [] },
    { id: "weekend", name: "Weekend", icon: "🎉", actions: [] },
  ]);

  const [showRuleBuilder, setShowRuleBuilder] = useState(false);

  const activateScene = (scene: Scene) => {
    console.log("Activating scene:", scene.name);
    // Implement scene activation logic
  };

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

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-semibold">Automation Rules</h2>
          <button
            onClick={() => setShowRuleBuilder(!showRuleBuilder)}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
          >
            + New Rule
          </button>
        </div>

        {showRuleBuilder && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 border border-gray-700">
            <h3 className="text-white font-semibold mb-3">Create Rule</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-sm">IF device</label>
                <select className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1">
                  <option>Select device...</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-sm">Exceeds (W)</label>
                <input
                  type="number"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                  placeholder="1000"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">For (minutes)</label>
                <input
                  type="number"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1"
                  placeholder="5"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm">THEN</label>
                <select className="w-full bg-gray-700 text-white px-3 py-2 rounded mt-1">
                  <option>Send notification</option>
                  <option>Turn off device</option>
                  <option>Activate scene</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded font-semibold">
                  Save Rule
                </button>
                <button
                  onClick={() => setShowRuleBuilder(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-gray-400 text-center py-8">
          No automation rules configured yet
        </div>
      </div>
    </div>
  );
};
