# ESP32 MQTT Relay Switch Guide

## 1. Overview
Use an ESP32 development board and an SRD-05VDC-SL-C relay module to toggle a mains appliance via MQTT. A button or dashboard on your system publishes `ON`, `OFF`, or `TOGGLE` commands to the broker; the ESP32 listens, drives the relay, and publishes the resulting state so the UI always reflects reality.

## 2. Bill of Materials
- ESP32 DevKit (ESP32-WROOM or similar, 3.3 V logic).
- SRD-05VDC-SL-C relay board with transistor/optocoupler input stage.
- 5 V supply for the relay board plus USB power for the ESP32 and a shared ground.
- MQTT broker (e.g., Mosquitto) reachable on the same network.
- USB cable, jumper wires, enclosure, fuse, and the load/device to be switched.

## 3. Wiring (Text Description)
1. Power: ESP32 `5V` (VIN) -> relay `VCC`; ESP32 `GND` -> relay `GND`. If the relay has an external 5 V supply, keep grounds common.
2. Control: ESP32 `GPIO23` -> relay `IN`. Update the pin number in firmware if you rewire.
3. Load: Run mains live through the relay COM/NO terminals so the device only energizes when NO closes.
4. Confirm whether the relay input is active-low or active-high. Default firmware assumes active-low modules (most opto-isolated SRD boards).
5. Keep mains wiring isolated from low-voltage logic; mount the board in an enclosure and add strain relief.

## 4. MQTT Topics & Payloads
- Command topic: `smarthome/relay1/cmd`
- Status topic: `smarthome/relay1/status`
- Payloads: `ON`, `OFF`, `TOGGLE`; invalid payloads trigger an `ERR:UNKNOWN_CMD` status so you can debug UI buttons.
- Retain status messages if you want late subscribers to know the last state.

## 5. System Flow
1. ESP32 boots, connects to Wi-Fi, then to the MQTT broker.
2. It subscribes to the command topic and waits for button events published by your system.
3. When a valid payload arrives, it drives the relay pin and publishes the updated state.
4. Heartbeat depends on broker connection: the loop reconnects automatically if Wi-Fi or MQTT drops.

## 6. MQTT Broker Setup
1. Install Mosquitto (or reuse an existing broker) and start it with `mosquitto -v -c mosquitto.conf`.
2. Ensure TCP port `1883` is reachable from the ESP32 (open firewall rules as needed).
3. Optional: enable username/password or TLS, then copy credentials/paths into the firmware constants.
4. Create or reuse a dashboard button that publishes the desired payloads to `smarthome/relay1/cmd`.

## 7. Test Procedure
1. Power the ESP32 and relay board; watch the serial monitor (115200 baud) to confirm Wi-Fi/MQTT connections.
2. From your system, click the UI button or run `mosquitto_pub -h <broker_ip> -t smarthome/relay1/cmd -m ON`.
3. Listen for the relay click and verify the controlled device switches; check status feedback with `mosquitto_sub -t smarthome/relay1/status`.
4. Repeat for `OFF` and `TOGGLE` to validate all command paths.

## 8. Safety Notes
- Mains voltage is dangerous: enclose relay boards, keep low/high voltage wiring separated, and never touch live terminals.
- Use proper gauge wires, fuses, and strain relief; add MOV/snubbers for inductive loads.
- Disconnect power before rewiring and comply with local electrical codes.

## 9. Troubleshooting
- **Wi-Fi fails**: verify SSID/password and ensure you are on 2.4 GHz.
- **MQTT fails**: confirm broker IP/port/credentials; test with `mosquitto_pub`/`mosquitto_sub` from a PC.
- **Relay inverted**: change `RELAY_ACTIVE_LOW` to `false` if your board is high-level trigger.
- **Relay chatters**: ensure ESP32 and relay grounds are tied together and the 5 V rail is stable.

## 10. Next Steps
- Integrate with Home Assistant, Node-RED, or a custom dashboard for richer automation.
- Duplicate topics/pins to control multiple relays with the same sketch structure.
- Add TLS certificates or per-device credentials for hardened deployments.

## 11. Configuration Checklist (Completed)
1. **Replace placeholders in the sketch**  
   - Open the firmware below and set `WIFI_SSID`/`WIFI_PASSWORD` to your 2.4 GHz network credentials.  
   - Point `MQTT_HOST` (and `MQTT_PORT`, `MQTT_USER`, `MQTT_PASS` if required) to your broker instance.  
   - Confirm `RELAY_PIN` matches the GPIO you wired to `IN`, and set `RELAY_ACTIVE_LOW` to `false` if your relay expects a high signal to switch on.
2. **Upload from Arduino IDE**  
   - Tools -> Board: select the correct ESP32 dev board and COM port.  
   - Compile and upload; monitor Serial at 115200 baud to confirm Wi-Fi/MQTT connections and state updates.

## 12. UI Button Integration & Testing
1. **Hook your system button to MQTT**  
   - Configure the button/dash widget to publish `ON`, `OFF`, or `TOGGLE` to `smarthome/relay1/cmd`.  
   - If the UI supports retained payloads, disable retention for the command topic to avoid stale toggles.
2. **Manual verification with Mosquitto tools**  
   - Send commands directly: `mosquitto_pub -h <broker_ip> -t smarthome/relay1/cmd -m ON` (repeat for `OFF`/`TOGGLE`).  
   - Observe feedback: `mosquitto_sub -h <broker_ip> -t smarthome/relay1/status` should report `ON`/`OFF` immediately after each button press.  
   - Confirm the relay clicks and the connected appliance follows the UI state; troubleshoot wiring or credentials if the status topic does not update.

## ESP32 Firmware (Arduino IDE)
Install the "ESP32 by Espressif Systems" core via the Arduino Boards Manager and the `PubSubClient` library via Library Manager. Update the `constexpr` fields for your Wi-Fi, MQTT broker, credentials, and desired relay pin.

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

constexpr char WIFI_SSID[]     = "YOUR_WIFI";
constexpr char WIFI_PASSWORD[] = "YOUR_PASSWORD";

constexpr char MQTT_HOST[] = "192.168.1.10";   // Broker IP or hostname
constexpr uint16_t MQTT_PORT = 1883;
constexpr char MQTT_CLIENT_ID[] = "esp32-relay-1";
constexpr char MQTT_USER[] = "";               // Optional
constexpr char MQTT_PASS[] = "";               // Optional

constexpr char MQTT_CMD_TOPIC[]    = "smarthome/relay1/cmd";
constexpr char MQTT_STATUS_TOPIC[] = "smarthome/relay1/status";

constexpr uint8_t RELAY_PIN = 23;               // Adjust to your wiring
constexpr bool RELAY_ACTIVE_LOW = true;         // Set false for high-level trigger boards

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
bool relayOn = false;

void publishState() {
  mqttClient.publish(MQTT_STATUS_TOPIC, relayOn ? "ON" : "OFF", true);
}

void driveRelay() {
  const bool level = relayOn ? !RELAY_ACTIVE_LOW : RELAY_ACTIVE_LOW;
  digitalWrite(RELAY_PIN, level);
  publishState();
}

void handleCommand(char* topic, byte* payload, unsigned int length) {
  String cmd;
  cmd.reserve(length);
  for (unsigned int i = 0; i < length; ++i) cmd += static_cast<char>(payload[i]);
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "ON") {
    relayOn = true;
    driveRelay();
  } else if (cmd == "OFF") {
    relayOn = false;
    driveRelay();
  } else if (cmd == "TOGGLE") {
    relayOn = !relayOn;
    driveRelay();
  } else {
    mqttClient.publish(MQTT_STATUS_TOPIC, "ERR:UNKNOWN_CMD");
  }
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void ensureMqtt() {
  while (!mqttClient.connected()) {
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS)) {
      mqttClient.subscribe(MQTT_CMD_TOPIC);
      publishState();
    } else {
      delay(2000);
    }
  }
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW); // start OFF
  ensureWifi();
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(handleCommand);
}

void loop() {
  ensureWifi();
  ensureMqtt();
  mqttClient.loop();
}
```

Upload the sketch, open the Serial Monitor at 115200 baud to confirm connections, and use your UI button (or `mosquitto_pub`) to send `ON`/`OFF` commands. The relay module will track the button state instantly, and the feedback topic keeps the UI synchronized.

