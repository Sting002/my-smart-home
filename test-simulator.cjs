// MQTT Test Data Simulator
// Run with: node test-simulator.cjs [--broker mqtt://localhost:1883] [--home home1]
// Requires: npm install mqtt

const mqtt = require("mqtt");

// Allow env/CLI overrides for broker URL and home ID
const argv = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
// Use the native MQTT port (default 1883) by default
const BROKER_URL = process.env.BROKER_URL || getArg("--broker", "mqtt://localhost:1883");
const HOME_ID = process.env.HOME_ID || getArg("--home", "home1");
const RETAIN = (process.env.RETAIN === "true") || argv.includes("--retain");

const devices = [
  { id: "device_001", name: "Refrigerator", baseWatts: 150, variance: 30 },
  { id: "device_002", name: "Air Conditioner", baseWatts: 1200, variance: 200 },
  { id: "device_003", name: "Water Heater", baseWatts: 2000, variance: 100 },
  { id: "device_004", name: "Washing Machine", baseWatts: 500, variance: 300 },
];

const client = mqtt.connect(BROKER_URL, {
  keepalive: 30,
  reconnectPeriod: 1000,
  // Drop QoS 0 messages while offline to avoid burst after reconnect
  queueQoSZero: false,
});

// Persistent per-device state and counters
const deviceState = Object.fromEntries(devices.map((d) => [d.id, { on: true }]));
const energyTotals = Object.fromEntries(devices.map((d) => [d.id, 0])); // Wh
const lastTick = Object.fromEntries(devices.map((d) => [d.id, Date.now()]));

client.on("connect", () => {
  console.log("✅ Connected to MQTT broker");
  console.log(`📡 Ready, simulating ${devices.length} devices...`);
  const cmdTopic = `home/${HOME_ID}/cmd/+/set`;
  client.subscribe(cmdTopic, (err) => {
    if (err) {
      console.error("Failed to subscribe:", cmdTopic, err.message || err);
    } else {
      console.log(`🔔 Subscribed to: ${cmdTopic}`);
    }
  });
});

client.on("reconnect", () => {
  console.log("… reconnecting to MQTT broker");
});
client.on("close", () => {
  console.log("🔌 Disconnected from MQTT broker");
});
client.on("offline", () => {
  console.log("⚠️ MQTT offline");
});
client.on("error", (err) => {
  console.error("MQTT error:", err && err.message ? err.message : err);
});

client.on("message", (topic, message) => {
  const match = topic.match(/cmd\/([^/]+)\/set/);
  if (!match) return;
  const deviceId = match[1];
  try {
    const payload = JSON.parse(message.toString());
    const nextOn = !!payload.on;
    if (deviceState[deviceId]) {
      deviceState[deviceId].on = nextOn;
      console.log(`🔧 Command: ${deviceId} -> ${nextOn ? "ON" : "OFF"}`);
    } else {
      console.log(`🔧 Command for unknown device: ${deviceId}`);
    }
  } catch (e) {
    console.log(`⚠️  Invalid command message for ${deviceId}:`, message.toString());
  }
});

function publishPowerReading(device) {
  const now = Date.now();
  const dtSec = Math.max(0.001, (now - (lastTick[device.id] || now)) / 1000);
  lastTick[device.id] = now;

  const on = !!(deviceState[device.id]?.on);
  const base = on
    ? device.baseWatts + (Math.random() - 0.5) * device.variance
    : 0.5 + Math.random() * 0.5; // idle trickle when OFF

  const watts = Math.max(0, base);
  const voltage = 220 + (Math.random() - 0.5) * 10;
  const current = watts / voltage;

  // Integrate energy by elapsed time (Wh)
  energyTotals[device.id] = (energyTotals[device.id] || 0) + (watts * dtSec) / 3600;

  const topic = `home/${HOME_ID}/sensor/${device.id}/power`;
  const payload = {
    ts: now,
    watts: Number(watts.toFixed(2)),
    voltage: Number(voltage.toFixed(2)),
    current: Number(current.toFixed(3)),
  };
  client.publish(topic, JSON.stringify(payload), { retain: RETAIN });
  console.log(`⚡ ${device.name}: ${watts.toFixed(0)}W (${on ? "on" : "off"})`);
}

function publishEnergyReading(device) {
  const topic = `home/${HOME_ID}/sensor/${device.id}/energy`;
  const wh = Number((energyTotals[device.id] || 0).toFixed(2));
  const payload = {
    ts: Date.now(),
    wh_total: wh,
  };
  client.publish(topic, JSON.stringify(payload), { retain: RETAIN });
  console.log(`🔢 ${device.name}: ${(wh / 1000).toFixed(3)} kWh total`);
}

// Single set of publishers guarded by connection state
const powerTimer = setInterval(() => {
  if (!client.connected) return;
  devices.forEach(publishPowerReading);
}, 1000);

const energyTimer = setInterval(() => {
  if (!client.connected) return;
  devices.forEach(publishEnergyReading);
}, 10000);

const alertTimer = setInterval(() => {
  if (!client.connected) return;
  const device = devices[Math.floor(Math.random() * devices.length)];
  const severities = ["info", "warning", "danger"];
  const severity = severities[Math.floor(Math.random() * severities.length)];
  const topic = `home/${HOME_ID}/event/alert`;
  const payload = {
    ts: Date.now(),
    deviceId: device.id,
    type: "High Usage",
    severity,
    message: `${device.name} power spike detected`,
  };
  client.publish(topic, JSON.stringify(payload));
  console.log(`🚨 Alert: ${payload.message} (${severity})`);
}, 30000);

// Graceful shutdown
function shutdown() {
  try {
    clearInterval(powerTimer);
    clearInterval(energyTimer);
    clearInterval(alertTimer);
  } catch {}
  try {
    client.end(true, () => process.exit(0));
  } catch {
    process.exit(0);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("\n🏠 MQTT Test Simulator Started");
console.log("🔗 Broker:", BROKER_URL);
console.log("🏷️  Home ID:", HOME_ID);
console.log("\nPress Ctrl+C to stop\n");
