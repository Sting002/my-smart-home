# MQTT Explorer Control Guide for ESP32 Relay + Light Bulb

## 1. Goal
Bring an ESP32 + SRD-05VDC-SL-C relay + light bulb online through MQTT, then use MQTT Explorer 0.4.0-beta.6 to monitor topics and toggle the relay.

## 2. Prerequisites
- **Hardware**: ESP32 DevKit, SRD-05VDC-SL-C relay module, breadboard, jumper wires, 5 V supply (or ESP32 VIN), and the target light bulb wired through the relay contacts.
- **Software**: Mosquitto MQTT broker (or another broker reachable on your LAN), MQTT Explorer 0.4.0-beta.6, Arduino IDE with ESP32 core + PubSubClient library.
- **Network**: 2.4 GHz Wi-Fi that both your ESP32 and computer can access.

## 3. Step-by-Step Setup
### Step 1: Install and Start Mosquitto (Broker)
1. Download the latest Mosquitto Windows installer from `https://mosquitto.org/download/` and complete the installation (check the "Service" option if available).
2. Copy `C:\Program Files\mosquitto\mosquitto.conf.example` to `mosquitto.conf` and edit:
   ```
   listener 1883 0.0.0.0
   allow_anonymous true        # or configure password_file for security
   persistence true
   ```
3. Start the broker:
   - If installed as a service: open *Services*, find **Mosquitto Broker**, click **Start**.
   - Otherwise run: `"C:\Program Files\mosquitto\mosquitto.exe" -c "C:\Program Files\mosquitto\mosquitto.conf" -v`
4. Confirm port 1883 is listening: `netstat -ano | find "1883"`.

### Step 2: Wire ESP32, Relay, and Light Bulb on Breadboard
1. **Low-voltage side** (ESP32 ↔ relay):
   - ESP32 `5V`/`VIN` -> relay `VCC` (or external 5 V).  
   - ESP32 `GND` -> relay `GND`.
   - ESP32 GPIO23 -> relay `IN` (adjust later if different).
2. **High-voltage side** (relay ↔ bulb):
   - Break the light bulb's **live** conductor and insert the relay COM and NO contacts in series so NO closes the circuit when energized.
   - Keep neutral directly connected; insulate all mains connections and never touch while powered.
3. Secure relay and ESP32 on the breadboard/enclosure; keep mains wiring away from logic wiring.

### Step 3: Flash the ESP32 Firmware
1. Open `docs/ESP32_MQTT_Relay_Guide.md` and copy the firmware block.
2. Replace placeholders:
   - `WIFI_SSID` / `WIFI_PASSWORD`
   - `MQTT_HOST` = IP of the computer running Mosquitto (e.g., `192.168.1.50`).
   - `MQTT_USER` / `MQTT_PASS` if authentication is enabled.
   - Adjust `RELAY_PIN` if you used a different GPIO.
3. Select **Tools -> Board -> ESP32 Arduino -> ESP32 Dev Module** (or your exact board) and the correct COM port.
4. Upload. Open Serial Monitor at 115200 baud to ensure you see `WiFi connected` and `MQTT connected` style logs.

### Step 4: Configure MQTT Explorer 0.4.0-beta.6
1. Launch MQTT Explorer and click **Add new connection**.
2. Fill in:
   - **Name**: `Local Mosquitto`
   - **Host**: the broker IP (e.g., `192.168.1.50`)
   - **Port**: `1883`
   - **Protocol**: `mqtt://`
   - **Username / Password**: only if you set them in Mosquitto.
3. Expand **Advanced** and ensure:
   - **Client ID** is unique (e.g., `mqtt-explorer-pc`).
   - **Clean session** is enabled.
4. Save and connect. The left tree should eventually show `smarthome` once the ESP32 publishes.

### Step 5: Verify Topics and Control the Relay
1. In MQTT Explorer, watch the topic tree for `smarthome/relay1/status`. It should show `ON` or `OFF` retained values.
2. Publish commands using MQTT Explorer's **Publish** tab:
   - Topic: `smarthome/relay1/cmd`
   - Payload: `ON` (set QoS 0, non-retained) -> click **Publish**.
   - Repeat with `OFF` and `TOGGLE`.
3. The relay should click, the bulb should turn on/off, and `smarthome/relay1/status` should update immediately.
4. If the topic tree does not refresh automatically, click the refresh icon.

## 4. Troubleshooting Checklist
- **Cannot connect from MQTT Explorer**: verify Mosquitto is running, firewall allows TCP 1883, and IP/port match.
- **ESP32 stuck at Wi-Fi**: confirm SSID/password, ensure 2.4 GHz network, and keep the board close to the router.
- **ESP32 connects but no topics**: check that the firmware topics (`smarthome/relay1/...`) match what you're watching; ensure MQTT Explorer is connected with a unique client ID.
- **Relay not switching**: confirm GPIO pin assignment, logic level (`RELAY_ACTIVE_LOW`), wiring continuity, and that the relay module has a solid 5 V supply.
- **Bulb not lighting**: verify mains wiring (live conductor actually routed through COM/NO), the relay module's contact rating, and that the bulb itself works.

## 5. Safety Reminders
- Always disconnect mains power before adjusting wiring on the breadboard.
- Use insulated terminals or a relay module enclosure to prevent accidental contact.
- Add a fuse matched to the bulb's current draw and obey local electrical regulations.

Follow these steps sequentially and you should be able to view MQTT traffic with MQTT Explorer and toggle the relay-driven light bulb reliably.

