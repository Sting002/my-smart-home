#!/usr/bin/env node
// Clear retained MQTT messages for power/energy topics for a given home
// Usage:
//   node scripts/clear-retained.cjs --broker mqtt://localhost:1883 --home home1 --devices device_001,device_002
// Or (auto-fetch devices from backend if available and session is valid):
//   node scripts/clear-retained.cjs --broker mqtt://localhost:1883 --home home1 --from-backend http://localhost:4000

const mqtt = require("mqtt");

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag, dflt) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
  return {
    broker: get("--broker", "mqtt://localhost:1883"),
    home: get("--home", "home1"),
    devicesArg: get("--devices", ""),
    backend: get("--from-backend", ""),
  };
}

async function fetchDevicesFromBackend(baseUrl) {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/devices`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data.map((d) => d.id) : [];
  } catch (e) {
    console.error("Failed to fetch devices from backend:", e.message || e);
    return [];
  }
}

async function main() {
  const { broker, home, devicesArg, backend } = parseArgs();

  let deviceIds = [];
  if (devicesArg) {
    deviceIds = devicesArg.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (backend) {
    deviceIds = await fetchDevicesFromBackend(backend);
  }
  if (deviceIds.length === 0) {
    console.error("No devices provided. Use --devices id1,id2 or --from-backend http://localhost:4000");
    process.exit(1);
  }

  console.log(`Broker: ${broker}`);
  console.log(`Home:   ${home}`);
  console.log(`Devices to clear (${deviceIds.length}):`, deviceIds.join(", "));

  const client = mqtt.connect(broker, { keepalive: 15, reconnectPeriod: 0 });

  await new Promise((resolve, reject) => {
    client.once("connect", resolve);
    client.once("error", reject);
  }).catch((e) => {
    console.error("MQTT connect error:", e && e.message ? e.message : e);
    process.exit(2);
  });

  for (const id of deviceIds) {
    const powerTopic = `home/${home}/sensor/${id}/power`;
    const energyTopic = `home/${home}/sensor/${id}/energy`;
    await new Promise((res) => client.publish(powerTopic, "", { retain: true }, res));
    await new Promise((res) => client.publish(energyTopic, "", { retain: true }, res));
    console.log("Cleared retained:", powerTopic, "and", energyTopic);
  }

  client.end(true, () => process.exit(0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

