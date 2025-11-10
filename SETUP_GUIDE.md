# ESP32 Setup Guide and App Integration

This guide shows how to wire an ESP32, publish power/energy readings to MQTT, and connect the web app. It reflects the current app behavior (Vite on port 8080, onboarding, MQTT over WebSockets, and topic schemas).

## Hardware Requirements

- ESP32 development board
- Current/voltage sensor (INA219, ACS712, or HLW8012)
- Relay module (optional, for device command testing)
- 5V power supply and jumper wires

## Wiring (INA219 example)

```
ESP32          INA219
-------------------------
3.3V   --->    VCC
GND    --->    GND
GPIO21 --->    SDA
GPIO22 --->    SCL
```

Relay (optional): `GPIO23 -> IN`, `5V -> VCC`, `GND -> GND`.

## MQTT Topics and Payloads

- Power (sensor -> app): `home/{homeId}/sensor/{deviceId}/power`
  - `{ watts: number, voltage?: number, current?: number, ts?: number }`
  - If `ts` is omitted, the app uses its local time. If you send `ts`, use epoch milliseconds.
  - The UI considers a device `ON` when `watts > 5`.
- Energy (sensor -> app): `home/{homeId}/sensor/{deviceId}/energy`
  - `{ wh_total: number, ts?: number }` (app computes kWh today as `wh_total / 1000`)
- Command (app -> device): `home/{homeId}/cmd/{deviceId}/set`
  - `{ on: boolean }`
  - The app updates UI optimistically (instant toggle) and sets `lastSeen` to now; device readings should follow.

Device is considered ON in the UI when `watts > 5`.

## ESP32 Firmware (Arduino)

The sketch below publishes power once/second and energy every 10s. It omits `ts` to let the app timestamp readings, avoiding clock sync issues.

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker (TCP 1883 for device)
const char* mqtt_server = "192.168.1.100";  // Broker IP
const int mqtt_port = 1883;

// Device config
const char* homeId = "home1";
const char* deviceId = "device_001";

WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_INA219 ina219;

unsigned long lastPublish = 0;
float totalWh = 0.0f;
unsigned long lastEnergyUpdate = 0;

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) {
    Serial.println("INA219 not found");
    while (1) { delay(10); }
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // Publish power every 1s
  if (millis() - lastPublish > 1000) {
    publishPowerData();
    lastPublish = millis();
  }

  // Publish cumulative energy every 10s
  if (millis() - lastEnergyUpdate > 10000) {
    publishEnergyData();
    lastEnergyUpdate = millis();
  }
}

void publishPowerData() {
  float voltage = ina219.getBusVoltage_V();
  float current = ina219.getCurrent_mA() / 1000.0;
  float power = voltage * current; // W

  // Integrate energy (Wh): W * seconds / 3600
  totalWh += (power * 1.0f) / 3600.0f; // 1 second interval

  char topic[96];
  snprintf(topic, sizeof(topic), "home/%s/sensor/%s/power", homeId, deviceId);

  char payload[160];
  snprintf(payload, sizeof(payload), "{\"watts\":%.2f,\"voltage\":%.2f,\"current\":%.3f}", power, voltage, current);
  client.publish(topic, payload);
}

void publishEnergyData() {
  char topic[96];
  snprintf(topic, sizeof(topic), "home/%s/sensor/%s/energy", homeId, deviceId);

  char payload[96];
  snprintf(payload, sizeof(payload), "{\"wh_total\":%.2f}", totalWh);
  client.publish(topic, payload);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Example: {"on": true}
  char cmdTopic[96];
  snprintf(cmdTopic, sizeof(cmdTopic), "home/%s/cmd/%s/set", homeId, deviceId);
  if (strcmp(topic, cmdTopic) == 0) {
    Serial.print("Command: ");
    for (unsigned int i = 0; i < length; i++) Serial.print((char)payload[i]);
    Serial.println();
    // TODO: parse JSON and drive a relay if attached
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("MQTT connect...");
    if (client.connect(deviceId)) {
      Serial.println("ok");
      char cmdTopic[96];
      snprintf(cmdTopic, sizeof(cmdTopic), "home/%s/cmd/%s/set", homeId, deviceId);
      client.subscribe(cmdTopic);
    } else {
      Serial.print("rc="); Serial.print(client.state());
      Serial.println(" retry in 5s");
      delay(5000);
    }
  }
}
```

## Installation Steps

1. Install Arduino IDE and ESP32 board support.
2. Install libraries: PubSubClient (Nick O'Leary), Adafruit INA219, Wire.
3. Configure the sketch: Wi‑Fi credentials, `mqtt_server`, unique `deviceId`, and `homeId`.
4. Upload to the ESP32 and monitor the serial output.

## Verify MQTT

On the broker host:

```bash
# Subscribe to all home topics
mosquitto_sub -h localhost -t 'home/#' -v

# Expected (examples):
# home/home1/sensor/device_001/power {"watts":123.45,"voltage":229.80,"current":0.537}
# home/home1/sensor/device_001/energy {"wh_total":12.34}
```

To simulate a command from the app (or test without the app):

```bash
mosquitto_pub -h localhost -t 'home/home1/cmd/device_001/set' -m '{"on":false}'
```

## Connect the Web App

- Start the app in dev mode: `npm run dev` and open `http://localhost:8080`.
- On first run you'll see onboarding at `/onboarding`.
  - Enter the broker WebSocket URL. Common values:
    - Direct Mosquitto WS: `ws://<broker-host>:9001` (path is `/` by default)
    - Behind Nginx: `ws(s)://<your-domain>/mqtt` (when `/mqtt` proxies to Mosquitto)
  - Note: The app's default is `ws://localhost:9001/mqtt`. If your broker exposes WS at root `/`, remove `/mqtt`.
- After connecting, you'll land on the Dashboard. Devices appear automatically as they publish.

## App Thresholds, Auto-off and Essential Devices

- Each device has a Threshold (W) and Auto-off (minutes). When a device stays below threshold for the configured minutes while ON, the app can auto-send OFF (Standby Kill).
- Mark “Essential device” in the device edit form to keep it ON when activating Away/Sleep/Workday scenes.
- Edit these in Device Detail (Edit button) or in-place numeric fields.

## Tips and Pitfalls

- Timestamps: If you send `ts`, use epoch milliseconds. Otherwise omit `ts` and let the app timestamp.
- Home ID: Must match on the device and in app Settings (`homeId`).
- Retained data: To clear retained power/energy topics, use Settings -> Clear All Data or the helper script `npm run mqtt:clear`.
- WebSockets path: Ensure your WS URL path matches your broker/proxy (root `/` vs `/mqtt`).
- Thresholds and scenes: Adjust device threshold W and automations in the app to test command flows.
- Home ID: Ensure your device topics and the app’s Settings → Home ID match (default `home1`).

## What’s Next

- Devices tab: add/edit devices; open a device to view live power chart and settings.
- Automations: test built‑in scenes (Away/Sleep/Workday/Weekend) and custom scenes or rules.
- Settings: set currency/tariff, change broker URL, export/import data.
