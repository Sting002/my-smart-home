# ESP32 Setup Guide and App Integration

This guide walks through the end-to-end flow for bringing a physical ESP32 energy sensor into the Smart Home Energy Monitor stack. It covers firmware, broker configuration, and the React/Vite frontend so everything reflects the current code base (Vite dev server on port 8080, onboarding wizard, MQTT over WebSockets, and the latest topic schema).

---

## 1. System Overview

```
ESP32 (sensors)  -->  Mosquitto (MQTT 1883 + WS 9001)  -->  Smart Home web app
                                              |
                                              +-- Optional tools (MQTT Explorer, mosquitto_sub)
```

- ESP32 devices publish sensor payloads over plain MQTT (TCP/1883).
- The web UI runs in the browser and uses MQTT over WebSockets (default `ws://localhost:9001/mqtt`) via `mqttService`.
- Device metadata, automations, and alerts live in localStorage and (optionally) the backend API exposed under `/api`.

For a tooling-first setup that uses MQTT Explorer, see `docs/esp32-mqtt-explorer-setup.md`.

---

## 2. Hardware and Software Requirements

| Component | Notes |
| --- | --- |
| ESP32 dev board | Any Arduino-compatible board (DevKit V1, WROOM, etc.). |
| Sensor | INA219 (I2C), ACS712 (analog), HLW8012, or any watt-measuring setup. INA219 wiring is shown below. |
| Optional relay | Useful if you plan to act on `cmd` topics. Drive it through a transistor if needed. |
| Power + cabling | Stable 5 V USB supply and jumpers. |
| Development tools | Arduino IDE >= 2.x (or PlatformIO) with ESP32 board support. |
| Arduino libraries | `PubSubClient`, `Wire`, and the sensor library (e.g., `Adafruit INA219`). |
| MQTT broker | Mosquitto or another broker you can configure with both TCP and WebSocket listeners. |
| Debug tools | `mosquitto_sub`, MQTT Explorer, or the repo's simulator (`npm run sim`). |

---

## 3. Wiring (INA219 reference)

```
ESP32          INA219
-------------------------
3.3V   --->    VCC
GND    --->    GND
GPIO21 --->    SDA
GPIO22 --->    SCL
```

Optional relay for command testing:
```
GPIO23 ---> IN   (use a transistor if the relay needs more current)
5V     ---> VCC
GND    ---> GND
```

---

## 4. MQTT Topics and Payloads

| Direction | Topic | Payload |
| --- | --- | --- |
| Sensor -> App (power) | `home/{homeId}/sensor/{deviceId}/power` | `{ watts: number, voltage?: number, current?: number, ts?: number }` |
| Sensor -> App (energy) | `home/{homeId}/sensor/{deviceId}/energy` | `{ wh_total: number, ts?: number }` |
| App -> Device (command) | `home/{homeId}/cmd/{deviceId}/set` | `{ on: boolean }` |

Key rules enforced by the app:
- Devices are considered ON when `watts > 5`.
- If you omit `ts`, the UI timestamps readings on receipt (safer unless your MCU clock is accurate).
- `homeId` must match the value stored in the app (`localStorage.homeId`, default `home1`).

---

## 5. ESP32 Firmware (Arduino)

The sketch below publishes power every second and cumulative energy every 10 seconds.

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

const char* mqtt_host = "192.168.1.100";
const int   mqtt_port = 1883;

const char* homeId = "home1";
const char* deviceId = "device_001";

WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_INA219 ina219;

unsigned long lastPublish = 0;
unsigned long lastEnergyUpdate = 0;
float totalWh = 0.0f;

void setup() {
  Serial.begin(115200);
  if (!ina219.begin()) {
    Serial.println("INA219 not found");
    while (true) { delay(10); }
  }

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println("\nWi-Fi connected");

  client.setServer(mqtt_host, mqtt_port);
  client.setCallback(mqttCallback);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  const unsigned long now = millis();

  if (now - lastPublish >= 1000) {
    publishPowerData();
    lastPublish = now;
  }

  if (now - lastEnergyUpdate >= 10000) {
    publishEnergyData();
    lastEnergyUpdate = now;
  }
}

void publishPowerData() {
  const float voltage = ina219.getBusVoltage_V();
  const float current = ina219.getCurrent_mA() / 1000.0f;
  const float power = voltage * current;

  totalWh += (power * 1.0f) / 3600.0f;

  char topic[96];
  snprintf(topic, sizeof(topic), "home/%s/sensor/%s/power", homeId, deviceId);

  char payload[160];
  snprintf(payload, sizeof(payload),
           "{\"watts\":%.2f,\"voltage\":%.2f,\"current\":%.3f}",
           power, voltage, current);
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

> Add username/password parameters to `client.connect` if your broker enforces authentication. For TLS, use `WiFiClientSecure` and load your CA certificates.

---

## 6. Install and Flash

1. **Arduino IDE**: install the ESP32 core via Boards Manager (`https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`).
2. **Libraries**: install `PubSubClient`, `Adafruit INA219`, and `Wire`.
3. **Configure**: edit Wi-Fi credentials, `mqtt_host`, and assign a unique `deviceId` per physical device.
4. **Upload**: flash the board and keep the Serial Monitor open for Wi-Fi/MQTT logs.

---

## 7. Broker Verification

Use CLI tools:

```bash
# Subscribe to every Smart Home topic
mosquitto_sub -h localhost -t 'home/#' -v

# Publish a command to the device
mosquitto_pub -h localhost -t 'home/home1/cmd/device_001/set' -m '{"on":false}'
```

Or use MQTT Explorer (see the dedicated guide) to visualize payloads and retained messages.

---

## 8. Connect the Web App

1. Install dependencies and start Vite:
   ```bash
   npm install
   npm run dev
   ```
   The app runs on `http://localhost:8080`.

2. Complete onboarding at `/onboarding`:
   - **Broker URL**: enter the WebSocket endpoint (e.g., `ws://localhost:9001/mqtt`). This value lands in `localStorage.brokerUrl` and powers `useMqttLifecycle`.
   - **Home ID**: match the firmware (`home1` by default). Stored in `localStorage.homeId`.
   - The onboarding flow marks `localStorage.onboarded = true`, allowing ProtectedRoute to let you into `/dashboard`.

3. Later adjustments happen in **Settings -> MQTT Connection**:
   - Updating the Broker URL triggers `mqttService.connectAndWait` with keepalive and reconnect options before persisting the value.
   - The same page covers tariff, currency, monthly budget, TOU pricing, and JSON export/import.

---

## 9. App Features That Affect Devices

- **Threshold & Auto-off**: set per-device watt thresholds and idle timers to enable Standby Kill logic.
- **Essential flag**: keep critical loads powered when Away/Sleep/Workday scenes run.
- **Scenes & automations**: the `/automations` page lets you script rules that publish MQTT commands based on time, budget, or sensor state.
- **Budget alerts**: toast notifications fire at 75/90/100% of the computed daily budget (see `useBudgetAlerts`).

---

## 10. Tips and Pitfalls

- Prefer omitting `ts` so the frontend timestamps each reading.
- Keep `homeId` consistent between firmware, topics, and the Settings page.
- Use Settings -> Clear All Data or `npm run mqtt:clear` to wipe retained topics between tests.
- Ensure your broker exposes a WebSocket listener (e.g., Mosquitto `listener 9001` + `protocol websockets`). If you proxy through Nginx, forward `Upgrade`/`Connection` headers.
- `npm run sim` is handy for validating UI flows when hardware is offline.
- If MQTT Explorer shows readings but the UI is empty, double-check the broker URL in localStorage and watch the connection toast in the UI (`useMqttLifecycle`).

---

## 11. Next Steps

- Add more ESP32 devices (unique `deviceId` per board) and mark essential loads.
- Expand automations for Away/Sleep scenes and standby kill behavior.
- Wire up the optional backend (`Backend/server.cjs`) so `/api` routes persist devices/settings beyond localStorage.