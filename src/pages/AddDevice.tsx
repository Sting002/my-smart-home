// C:\Users\hasti\Desktop\my smart home\src\pages\AddDevice.tsx
import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useEnergy } from "../contexts/EnergyContext";
import type { Device } from "@/utils/energyContextTypes";

const deviceTypes = [
  { value: "fridge", label: "Refrigerator", icon: "❄️" },
  { value: "washer", label: "Washing Machine", icon: "🌀" },
  { value: "ac", label: "Air Conditioner", icon: "🌡️" },
  { value: "heater", label: "Heater", icon: "🔥" },
  { value: "water", label: "Water Heater", icon: "💧" },
  { value: "microwave", label: "Microwave", icon: "📻" },
  { value: "default", label: "Other", icon: "🔌" },
] as const;

const schema = z.object({
  id: z.string().min(3, "ID must be at least 3 characters"),
  name: z.string().min(2, "Name is required"),
  room: z.string().min(2, "Room is required"),
  type: z.enum(
    deviceTypes.map((d) => d.value) as [typeof deviceTypes[number]["value"], ...string[]]
  ),
  thresholdW: z.coerce.number().int().nonnegative(),
  autoOffMins: z.coerce.number().int().min(0),
});

type FormData = z.infer<typeof schema>;

const AddDevice: React.FC = () => {
  const navigate = useNavigate();
  const { addDevice, devices } = useEnergy();

  const [formData, setFormData] = useState<FormData>({
    id: "",
    name: "",
    room: "",
    type: "default",
    thresholdW: 1000,
    autoOffMins: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const idExists = useMemo(
    () =>
      devices.some(
        (d) => d.id.trim().toLowerCase() === formData.id.trim().toLowerCase()
      ),
    [devices, formData.id]
  );

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "thresholdW" || name === "autoOffMins" ? Number(value) : value,
    }));
  }, []);

  const selectType = useCallback((type: FormData["type"]) => {
    setFormData((prev) => ({ ...prev, type }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      const parsed = schema.safeParse(formData);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          map[String(issue.path[0])] = issue.message;
        }
        setErrors(map);
        return;
      }
      if (idExists) {
        setErrors((prev) => ({
          ...prev,
          id: "A device with this ID already exists",
        }));
        return;
      }

      setSubmitting(true);

      // ✅ Build a fully-typed Device object explicitly
      const data = parsed.data;
      const newDevice: Device = {
        id: data.id,
        name: data.name,
        room: data.room,
        type: data.type,
        isOn: false,
        watts: 0,
        kwhToday: 0,
        thresholdW: data.thresholdW,
        autoOffMins: data.autoOffMins,
        lastSeen: Date.now(),
      };

      addDevice(newDevice);
      setSubmitting(false);
      navigate("/devices");
    },
    [formData, addDevice, navigate, idExists]
  );

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/devices")}
        className="text-green-500 flex items-center gap-2"
      >
        ← Back
      </button>

      <div className="bg-gray-800 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Add New Device</h1>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="deviceId" className="text-gray-400 text-sm">
              Device ID
            </label>
            <input
              id="deviceId"
              name="id"
              type="text"
              required
              value={formData.id}
              onChange={onChange}
              placeholder="e.g., device_001"
              aria-invalid={!!errors.id}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1">
              Must match ESP32 device ID
            </p>
            {errors.id && (
              <p className="text-xs text-red-400 mt-1">{errors.id}</p>
            )}
          </div>

          <div>
            <label htmlFor="deviceName" className="text-gray-400 text-sm">
              Device Name
            </label>
            <input
              id="deviceName"
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={onChange}
              placeholder="e.g., Living Room AC"
              aria-invalid={!!errors.name}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
              autoComplete="name"
            />
            {errors.name && (
              <p className="text-xs text-red-400 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="deviceRoom" className="text-gray-400 text-sm">
              Room
            </label>
            <input
              id="deviceRoom"
              name="room"
              type="text"
              required
              value={formData.room}
              onChange={onChange}
              placeholder="e.g., Living Room"
              aria-invalid={!!errors.room}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
              autoComplete="section-room"
            />
            {errors.room && (
              <p className="text-xs text-red-400 mt-1">{errors.room}</p>
            )}
          </div>

          <div>
            <span className="text-gray-400 text-sm">Device Type</span>
            <div
              className="grid grid-cols-2 gap-2 mt-2"
              role="radiogroup"
              aria-label="Device type"
            >
              {deviceTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => selectType(type.value)}
                  aria-pressed={formData.type === type.value}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.type === type.value
                      ? "border-green-500 bg-green-500/10"
                      : "border-gray-700 bg-gray-700"
                  }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-white text-sm">{type.label}</div>
                </button>
              ))}
            </div>
            {errors.type && (
              <p className="text-xs text-red-400 mt-1">{errors.type}</p>
            )}
          </div>

          <div>
            <label htmlFor="thresholdW" className="text-gray-400 text-sm">
              Power Threshold (W)
            </label>
            <input
              id="thresholdW"
              name="thresholdW"
              type="number"
              value={formData.thresholdW}
              onChange={onChange}
              aria-invalid={!!errors.thresholdW}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
            />
            {errors.thresholdW && (
              <p className="text-xs text-red-400 mt-1">
                {errors.thresholdW}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="autoOffMins" className="text-gray-400 text-sm">
              Auto-off (minutes)
            </label>
            <input
              id="autoOffMins"
              name="autoOffMins"
              type="number"
              value={formData.autoOffMins}
              onChange={onChange}
              aria-invalid={!!errors.autoOffMins}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg mt-1"
            />
            {errors.autoOffMins && (
              <p className="text-xs text-red-400 mt-1">
                {errors.autoOffMins}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white py-3 rounded-lg font-semibold"
          >
            {submitting ? "Adding..." : "Add Device"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddDevice;
