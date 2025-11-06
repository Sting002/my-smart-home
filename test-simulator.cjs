// MQTT Test Data Simulator
// Run with: node test-simulator.cjs
// Requires: npm install mqtt

const mqtt = require("mqtt");

// Use the native MQTT port (default 1883)
const BROKER_URL = "mqtt://localhost:1883";
const HOME_ID = "home1";

const devices = [
  { id: "device_001", name: "Refrigerator", baseWatts: 150, variance: 30 },
  { id: "device_002", name: "Air Conditioner", baseWatts: 1200, variance: 200 },
  { id: "device_003", name: "Water Heater", baseWatts: 2000, variance: 100 },
  { id: "device_004", name: "Washing Machine", baseWatts: 500, variance: 300 },
];

const client = mqtt.connect(BROKER_URL);
let energyTotals = {};

client.on("connect", () => {
  console.log("✅ Connected to MQTT broker");
  console.log(`📡 Publishing test data for ${devices.length} devices...`);
  devices.forEach((device) => { energyTotals[device.id] = 0; });
  setInterval(() => { devices.forEach(publishPowerReading); }, 1000);
  setInterval(() => { devices.forEach(publishEnergyReading); }, 10000);
  const cmdTopic = `home/${HOME_ID}/cmd/+/set`;
  client.subscribe(cmdTopic, (err) => {
    if (!err) console.log(`📥 Subscribed to: ${cmdTopic}`);
  });
});

client.on("message", (topic, message) => {
  console.log(`📨 Command received: ${topic} -> ${message.toString()}`);
  const match = topic.match(/cmd\/([^/]+)\/set/);
  if (match) {
    const deviceId = match[1];
    try {
      const command = JSON.parse(message.toString());
      console.log(`   Device ${deviceId}: ${command.on ? "ON" : "OFF"}`);
    } catch {
      console.log(`   Device ${deviceId}: (Invalid command message)`);
    }
  }
});

function publishPowerReading(device) {
  const voltage = 220 + (Math.random() - 0.5) * 10;
  const watts = device.baseWatts + (Math.random() - 0.5) * device.variance;
  const current = watts / voltage;
  energyTotals[device.id] += (watts * 1) / 3600;
  const topic = `home/${HOME_ID}/sensor/${device.id}/power`;
  const payload = {
    ts: Date.now(),
    watts: Number(watts.toFixed(2)),
    voltage: Number(voltage.toFixed(2)),
    current: Number(current.toFixed(3)),
  };
  client.publish(topic, JSON.stringify(payload));
  console.log(`⚡ ${device.name}: ${watts.toFixed(0)}W`);
}

function publishEnergyReading(device) {
  const topic = `home/${HOME_ID}/sensor/${device.id}/energy`;
  const payload = {
    ts: Date.now(),
    wh_total: Number(energyTotals[device.id].toFixed(2)),
  };
  client.publish(topic, JSON.stringify(payload));
  console.log(`📊 ${device.name}: ${(energyTotals[device.id] / 1000).toFixed(3)} kWh total`);
}

setInterval(() => {
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
  console.log(`⚠️  Alert: ${payload.message} (${severity})`);
}, 30000);

console.log("\n🚀 MQTT Test Simulator Started");
console.log("📍 Broker:", BROKER_URL);
console.log("🏠 Home ID:", HOME_ID);
console.log("\nPress Ctrl+C to stop\n");
