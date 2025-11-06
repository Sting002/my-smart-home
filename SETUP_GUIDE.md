# ESP32 Setup Guide for Energy Monitoring

## Hardware Requirements

- ESP32 development board
- Current/voltage sensor (INA219, ACS712, or HLW8012)
- Relay module (optional, for device control)
- Power supply (5V)
- Jumper wires

## Wiring Diagram

### INA219 Sensor
```
ESP32          INA219
--------------------------
3.3V    --->   VCC
GND     --->   GND
GPIO21  --->   SDA
GPIO22  --->   SCL
```

### Relay Module (Optional)
```
ESP32          Relay
--------------------------
GPIO23  --->   IN
5V      --->   VCC
GND     --->   GND
```

## ESP32 Firmware (Arduino)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT Broker
const char* mqtt_server = "192.168.1.100";  // Your PC's IP
const int mqtt_port = 1883;

// Device config
const char* homeId = "home1";
const char* deviceId = "device_001";

WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_INA219 ina219;

unsigned long lastPublish = 0;
float totalWh = 0;
unsigned long lastEnergyUpdate = 0;

void setup() {
  Serial.begin(115200);
  
  // Initialize INA219
  if (!ina219.begin()) {
    Serial.println("Failed to find INA219 chip");
    while (1) { delay(10); }
  }
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  // Setup MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(mqttCallback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Publish power readings every second
  if (millis() - lastPublish > 1000) {
    publishPowerData();
    lastPublish = millis();
  }
  
  // Update energy total every 10 seconds
  if (millis() - lastEnergyUpdate > 10000) {
    publishEnergyData();
    lastEnergyUpdate = millis();
  }
}

void publishPowerData() {
  float voltage = ina219.getBusVoltage_V();
  float current = ina219.getCurrent_mA() / 1000.0;
  float power = voltage * current;
  
  // Accumulate energy (Wh)
  totalWh += (power * 1.0) / 3600.0;  // 1 second interval
  
  char topic[100];
  sprintf(topic, "home/%s/sensor/%s/power", homeId, deviceId);
  
  char payload[200];
  sprintf(payload, "{\"ts\":%lu,\"watts\":%.2f,\"voltage\":%.2f,\"current\":%.3f}", 
          millis(), power, voltage, current);
  
  client.publish(topic, payload);
  Serial.println(payload);
}

void publishEnergyData() {
  char topic[100];
  sprintf(topic, "home/%s/sensor/%s/energy", homeId, deviceId);
  
  char payload[100];
  sprintf(payload, "{\"ts\":%lu,\"wh_total\":%.2f}", millis(), totalWh);
  
  client.publish(topic, payload);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Handle control commands
  char cmdTopic[100];
  sprintf(cmdTopic, "home/%s/cmd/%s/set", homeId, deviceId);
  
  if (strcmp(topic, cmdTopic) == 0) {
    // Parse JSON and control relay
    // Example: {"on": true}
    Serial.print("Command received: ");
    for (int i = 0; i < length; i++) {
      Serial.print((char)payload[i]);
    }
    Serial.println();
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(deviceId)) {
      Serial.println("connected");
      
      // Subscribe to command topic
      char cmdTopic[100];
      sprintf(cmdTopic, "home/%s/cmd/%s/set", homeId, deviceId);
      client.subscribe(cmdTopic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");
      delay(5000);
    }
  }
}
```

## Installation Steps

1. **Install Arduino IDE** and ESP32 board support
2. **Install Libraries**:
   - PubSubClient (by Nick O'Leary)
   - Adafruit INA219
   - WiFi (built-in)

3. **Configure the code**:
   - Update WiFi credentials
   - Set your PC's IP address as mqtt_server
   - Change deviceId to unique identifier

4. **Upload to ESP32**

5. **Test MQTT Messages**:
```bash
# Subscribe to all topics
mosquitto_sub -h localhost -t 'home/#' -v

# You should see:
# home/home1/sensor/device_001/power {"ts":1234,"watts":150.23,...}
```

## Troubleshooting

**ESP32 not connecting to WiFi**
- Check SSID and password
- Ensure 2.4GHz WiFi (ESP32 doesn't support 5GHz)

**No MQTT messages**
- Verify broker is running: `mosquitto -v`
- Check firewall allows port 1883
- Confirm ESP32 and PC are on same network

**Sensor readings are zero**
- Check I2C wiring (SDA/SCL)
- Verify sensor power (3.3V)
- Try I2C scanner sketch to detect sensor

## Next Steps

Once data is flowing:
1. Open the web app (http://localhost:5173)
2. Complete onboarding with broker URL: `ws://localhost:9001`
3. Device should auto-appear in Devices tab
4. View real-time power charts in Device Detail page
