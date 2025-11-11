# ESP32 to MQTT Broker Setup (with MQTT Explorer)

Use this guide when you want a tooling-driven workflow for validating new ESP32 devices with Mosquitto and MQTT Explorer before onboarding them into the Smart Home Energy Monitor UI. It mirrors the logic in `SETUP_GUIDE.md` but highlights MQTT Explorer at every step so you can see payloads in real time.

---

## 1. Prerequisites

### Hardware
- ESP32 DevKit (any Arduino-compatible variant)
- Current/voltage sensor such as INA219, ACS712, or HLW8012
- Optional relay + driver if you want to react to `cmd` topics
- Stable 5 V USB supply and jumper wires

### Software
- Arduino IDE (or PlatformIO) with ESP32 board support
- Arduino libraries: `PubSubClient`, `Wire`, and the appropriate sensor driver (`Adafruit INA219` in this example)
- Mosquitto broker with both TCP (1883) and WebSocket (9001) listeners
- MQTT Explorer desktop client
- Smart Home web app (`npm run dev` -> http://localhost:8080)

Tip: While prototyping, keep the ESP32, Mosquitto, MQTT Explorer, and the web app on the same machine or LAN to avoid firewall surprises. Later you can move the broker and simply update the URLs.

---

## 2. Configure Mosquitto (TCP + WebSocket)

Create or update your Mosquitto config (`/etc/mosquitto/conf.d/smarthome.conf` on Linux/macOS or `mosquitto.conf` next to `mosquitto.exe` on Windows):

```conf
persistence true

# ESP32 + MQTT Explorer (raw MQTT)
listener 1883
protocol mqtt

# Smart Home web app (Browser -> WebSocket)
listener 9001
protocol websockets
http_dir .
```

Restart Mosquitto and confirm both ports are open (`netstat -an | findstr 1883` and `... 9001`). If you front Mosquitto with Nginx/Traefik, ensure `Upgrade` and `Connection` headers are forwarded so WebSockets work.

---

## 3. MQTT Explorer Connection Profile

1. Launch MQTT Explorer and click **Connections -> +**.
2. Fill in:
   - Hostname: broker IP or hostname (e.g., `localhost`).
   - Port: `1883`.
   - Client ID: something unique like `mqtt-explorer`.
3. Under **Advanced**, keep MQTT 3.1.1 and Clean Session enabled. Add username/password or TLS certs if your broker enforces auth.
4. Save and connect. Add a subscription filter `home/#`. You should see an empty tree waiting for the ESP32 to publish.

Keep this window open throughout; it is your source of truth while debugging payloads, retained messages, and commands.

---

## 4. Wire and Flash the ESP32

Wiring (INA219 example):
```
ESP32          INA219
-------------------------
3.3V   --->    VCC
GND    --->    GND
GPIO21 --->    SDA
GPIO22 --->    SCL
```

Firmware snippet (trimmed to highlight the MQTT pieces):

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

const char* ssid = "YOUR_WIFI";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_host = "192.168.1.50";
const int   mqtt_port = 1883;
const char* homeId = "home1";
const char* deviceId = "device_001";

WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_INA219 ina219;

void setup() {
  Serial.begin(115200);
  ina219.begin();
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print('.'); }
  client.setServer(mqtt_host, mqtt_port);
  client.setCallback(onMessage);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();
  publishPowerAndEnergy();
}
```

Update Wi-Fi credentials, broker host, `homeId`, and a unique `deviceId` per device. The full sketch (with power + energy publishing and command handling) lives in `SETUP_GUIDE.md`.

Upload the firmware and leave the Serial Monitor open so you can see Wi-Fi IPs and MQTT connection attempts.

---

## 5. Watch Telemetry in MQTT Explorer

1. With the ESP32 powered, MQTT Explorer should start filling the tree with:
   - `home/home1/sensor/<deviceId>/power`
   - `home/home1/sensor/<deviceId>/energy`
2. Click a topic to inspect JSON payloads. The chart tab shows whether values are changing over time.
3. Publish a command from MQTT Explorer to see the ESP32 react:
   - Topic: `home/home1/cmd/<deviceId>/set`
   - Payload: `{"on":false}`
   - The Serial Monitor should print the payload. If you wired a relay, toggle it here.

If nothing appears:
- Recheck Wi-Fi credentials and ensure the ESP32 can reach the broker IP.
- Confirm the connection list in MQTT Explorer shows the ESP32 client.
- Ensure firewalls are not blocking TCP/1883.
- Make sure each ESP32 uses a unique `deviceId` (client IDs must be unique per connection).

---

## 6. Point the Smart Home App at the Broker

1. Run the frontend locally:
   ```bash
   npm install
   npm run dev
   ```
   Visit `http://localhost:8080`.

2. Complete the onboarding flow at `/onboarding`:
   - **Broker URL**: enter the WebSocket endpoint (`ws://<broker-ip>:9001/mqtt` unless your WS listener sits at `/`). This value becomes `localStorage.brokerUrl` and drives `useMqttLifecycle`.
   - **Home ID**: must match the firmware (`home1` unless you changed it). Stored in `localStorage.homeId`.

3. After onboarding succeeds, the dashboard should display your device as soon as MQTT Explorer shows incoming payloads. If you ever need to change URLs later, open **Settings -> MQTT Connection**. That page uses `mqttService.connectAndWait` to validate the new broker before persisting it.

---

## 7. Validate the Full Chain

| Step | Tool | Expected result |
| --- | --- | --- |
| Firmware boot | Serial Monitor | Wi-Fi IP + `MQTT connect... ok` |
| Payload view | MQTT Explorer | Topics `home/<homeId>/sensor/<deviceId>/*` updating |
| UI | `/dashboard` | Device card, gauges, last-seen timestamps |
| Command | Web UI toggle or MQTT Explorer publish | ESP32 logs payload; relay toggles if connected |

If MQTT Explorer shows data but the UI does not, double-check `localStorage.brokerUrl`, `localStorage.homeId`, and the connection toast shown by `useMqttLifecycle`. If MQTT Explorer is empty, focus on the ESP32 or broker configuration first.

---

## 8. Troubleshooting Checklist

- **WebSocket errors in the browser**: ensure Mosquitto's WS listener on 9001 is running and that any reverse proxy forwards `Upgrade`/`Connection` headers.
- **ESP32 reconnect loop**: use unique `deviceId`/client IDs, verify 2.4 GHz Wi-Fi signal, and confirm broker credentials.
- **Retained ghost data**: clear using `npm run mqtt:clear` or publish a zero-length retained payload from MQTT Explorer.
- **Authentication/TLS**: provide the same credentials or certificates in both the ESP32 sketch and the MQTT Explorer profile.
- **Multiple homes/tenants**: use distinct `homeId` values (`home/houseA/#`, `home/houseB/#`) and align them with the app's Settings page.
- **Simulators**: If hardware is offline, run `npm run sim` to publish realistic data; MQTT Explorer will show it exactly like the real devices.

Once these steps are green, keep your Mosquitto config, MQTT Explorer profile, and ESP32 firmware committed so onboarding the next device is repeatable.