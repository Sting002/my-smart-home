# ESP32 Firmware

This directory contains firmware for ESP32 devices used in the smart home energy monitoring system.

## esp32_relay_controller.ino

A relay control firmware that connects to your WiFi network and MQTT broker to control a relay module via MQTT commands.

### Features

- WiFi connectivity with automatic connection
- MQTT command subscription for remote relay control
- Real-time power state publishing
- Automatic MQTT reconnection on connection loss
- Serial debugging output

### Hardware Requirements

- ESP32 development board
- Relay module connected to GPIO 23
- WiFi network access

### Configuration

Before uploading, update these constants in the code:

```cpp
const char* WIFI_SSID = "your_wifi_ssid";
const char* WIFI_PASSWORD = "your_wifi_password";
const char* MQTT_BROKER = "192.168.x.x";  // Your MQTT broker IP
const int MQTT_PORT = 1884;               // Your MQTT broker port
const char* DEVICE_ID = "living_room_bulb"; // Unique device identifier
```

### MQTT Topics

The firmware subscribes to and publishes on these topics:

- **Command (subscribe)**: `home/{homeId}/cmd/{deviceId}/set`
  - Expected JSON: `{"on": true}` or `{"on": false}`
  
- **Power (publish)**: `home/{homeId}/sensor/{deviceId}/power`
  - Published JSON: `{"ts": 12345, "watts": 100, "voltage": 230, "current": 0.26}`

### Dependencies

Install these libraries via Arduino IDE Library Manager:

1. **WiFi** (built-in with ESP32 core)
2. **PubSubClient** by Nick O'Leary
3. **ArduinoJson** by Benoit Blanchon (v6.x)

### Upload Instructions

1. Install the ESP32 board support in Arduino IDE:
   - Go to File > Preferences
   - Add `https://dl.espressif.com/dl/package_esp32_index.json` to Additional Board Manager URLs
   - Go to Tools > Board > Boards Manager
   - Search for "ESP32" and install

2. Connect your ESP32 via USB

3. Select your board:
   - Tools > Board > ESP32 Arduino > ESP32 Dev Module (or your specific board)
   - Tools > Port > Select your COM port

4. Configure the firmware settings (see Configuration section above)

5. Click Upload

6. Open Serial Monitor (115200 baud) to view debug output

### Testing

After uploading, the ESP32 will:

1. Connect to WiFi (watch Serial Monitor for connection status)
2. Connect to MQTT broker
3. Subscribe to command topic
4. Publish initial power state (0W, OFF)

Test by publishing to the command topic using mosquitto_pub:

```bash
# Turn relay ON
mosquitto_pub -h 192.168.x.x -p 1884 -t "home/home1/cmd/living_room_bulb/set" -m '{"on": true}'

# Turn relay OFF
mosquitto_pub -h 192.168.x.x -p 1884 -t "home/home1/cmd/living_room_bulb/set" -m '{"on": false}'
```

Or use the web dashboard at http://localhost:8080 after the device appears in the device list.

### Troubleshooting

**WiFi connection fails:**
- Verify SSID and password
- Ensure ESP32 is within WiFi range
- Check if network uses 2.4GHz (ESP32 doesn't support 5GHz)

**MQTT connection fails:**
- Verify broker IP and port
- Ensure broker allows anonymous connections or configure authentication
- Check firewall rules allow port 1884
- Test broker with: `mosquitto_sub -h 192.168.x.x -p 1884 -t "#" -v`

**Relay doesn't switch:**
- Verify relay module wiring (GPIO 23, VCC, GND)
- Check relay logic (some modules are active HIGH, this code uses active LOW)
- Adjust `digitalWrite(RELAY_PIN, newState ? LOW : HIGH);` if needed

**Device not appearing in dashboard:**
- Ensure `HOME_ID` matches your app's home ID (default: "home1")
- Check MQTT topics in Serial Monitor
- Subscribe to `home/#` on your broker to verify messages are being published
