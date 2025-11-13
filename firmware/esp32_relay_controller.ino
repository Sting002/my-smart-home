/*
 * ESP32 Relay Controller - Final Version
 * Connects to WiFi and MQTT broker to control a relay via MQTT commands.
 * Publishes relay state updates to a specified MQTT topic.
 * 
 * Hardware:
 * - ESP32 Development Board
 * - Relay Module connected to GPIO 23
 *
 * Libraries Required:
 * - WiFi.h
 * - PubSubClient.h
 * - ArduinoJson.h
 */

// Include required libraries for WiFi, MQTT, and JSON handling
//#include <WiFi.h>          // ESP32 WiFi library for network connectivity
#include <PubSubClient.h>  // MQTT client library for pub/sub messaging
#include <ArduinoJson.h>   // JSON parsing and serialization library

// === HOTSPOT CONFIGURATION ===
// WiFi network credentials - update these to match your network
const char* WIFI_SSID = "hastings";      // Your WiFi network name (SSID)
const char* WIFI_PASSWORD = "Copylead88"; // Your WiFi password

// MQTT broker connection settings
const char* MQTT_BROKER = "192.168.243.82";  // IP address of your MQTT broker (computer running Mosquitto)
const int MQTT_PORT = 1884;                  // MQTT broker port (default: 1883, WebSocket: 9001)
const char* MQTT_CLIENT_ID = "esp32_relay_1"; // Unique identifier for this MQTT client

// Device identification for MQTT topic structure
const char* HOME_ID = "home1";                   // Home identifier (must match your dashboard's homeId)
const char* DEVICE_ID = "living_room_bulb";      // Unique device identifier (must match dashboard device)

// Hardware pin configuration
const int RELAY_PIN = 23;  // GPIO pin connected to relay module control pin

// MQTT topic strings - will be populated in setupTopics()
char cmdTopic[100];    // Command topic: home/{homeId}/cmd/{deviceId}/set
char powerTopic[100];  // Power status topic: home/{homeId}/sensor/{deviceId}/power

// Network and MQTT client instances
WiFiClient wifiClient;              // WiFi client for network connection
PubSubClient mqttClient(wifiClient); // MQTT client using the WiFi connection

// Global state tracking
bool relayState = false;  // Current state of the relay (false = OFF, true = ON)

/**
 * setupTopics() - Constructs MQTT topic strings using HOME_ID and DEVICE_ID
 * 
 * Builds two topic strings:
 * - cmdTopic: Topic to subscribe for receiving ON/OFF commands from dashboard
 * - powerTopic: Topic to publish current power/state information to dashboard
 * 
 * Format: home/{homeId}/cmd/{deviceId}/set and home/{homeId}/sensor/{deviceId}/power
 */
void setupTopics() {
  // Build command topic string: home/home1/cmd/living_room_bulb/set
  snprintf(cmdTopic, sizeof(cmdTopic), "home/%s/cmd/%s/set", HOME_ID, DEVICE_ID);
  
  // Build power status topic string: home/home1/sensor/living_room_bulb/power
  snprintf(powerTopic, sizeof(powerTopic), "home/%s/sensor/%s/power", HOME_ID, DEVICE_ID);
}

/**
 * setup() - Arduino initialization function, runs once at startup
 * 
 * Performs the following initialization steps:
 * 1. Initialize serial communication for debugging
 * 2. Configure relay GPIO pin as output
 * 3. Build MQTT topic strings
 * 4. Connect to WiFi network
 * 5. Configure and connect to MQTT broker
 * 6. Subscribe to command topic
 * 7. Publish initial device state
 */
void setup() {
  // Initialize serial port for debugging at 115200 baud rate
  Serial.begin(115200);
  delay(3000);  // Wait 3 seconds for serial monitor to initialize
  
  // Print startup banner to serial monitor
  Serial.println();
  Serial.println("🚀 ESP32 RELAY CONTROLLER - FINAL");
  Serial.println("=================================");
  
  // === RELAY SETUP ===
  // Configure relay pin as OUTPUT and initialize to OFF state
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // LOW = relay OFF (adjust if your relay is active-high)
  Serial.println("✅ Relay initialized (OFF)");
  
  // === MQTT TOPIC SETUP ===
  // Build topic strings using HOME_ID and DEVICE_ID
  setupTopics();
  Serial.print("📡 Command topic: ");
  Serial.println(cmdTopic);   // Will print: home/home1/cmd/living_room_bulb/set
  Serial.print("📡 Power topic: ");
  Serial.println(powerTopic); // Will print: home/home1/sensor/living_room_bulb/power
  
  // === WIFI CONNECTION ===
  Serial.println();
  Serial.println("📶 Connecting to WiFi...");
  Serial.print("Network: ");
  Serial.println(WIFI_SSID);
  
  // Begin WiFi connection with credentials
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Wait for WiFi connection (max 20 seconds)
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);        // Wait 1 second between attempts
    Serial.print(".");  // Print dot for each attempt
    attempts++;
  }
  
  // Check if WiFi connection was successful
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("✅ WiFi CONNECTED!");
    Serial.print("📱 ESP32 IP: ");
    Serial.println(WiFi.localIP());  // Print the assigned IP address
    
    // === MQTT SETUP ===
    // Configure MQTT broker address and port
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    
    // Set callback function to handle incoming MQTT messages
    // Using lambda function for inline callback definition
    mqttClient.setCallback([](char* topic, byte* payload, unsigned int length) {
      // This function is called whenever a message arrives on a subscribed topic
      
      Serial.println();
      Serial.println("🎯 MQTT COMMAND RECEIVED!");
      Serial.print("Topic: ");
      Serial.println(topic);  // Print which topic the message arrived on
      
      // Print the raw message payload for debugging
      Serial.print("Message: ");
      for (int i = 0; i < length; i++) {
        Serial.print((char)payload[i]);
      }
      Serial.println();
      
      // === JSON PARSING ===
      // Parse the JSON payload to extract the "on" command
      StaticJsonDocument<200> doc;  // Allocate JSON document (200 bytes max)
      DeserializationError error = deserializeJson(doc, payload, length);
      
      // Check if JSON parsing was successful and "on" field exists
      if (!error && doc.containsKey("on")) {
        // Extract the boolean value from "on" field
        bool newState = doc["on"];
        
        // Control the relay based on command
        // NOTE: Using inverted logic (LOW=ON, HIGH=OFF) - adjust if your relay differs
        digitalWrite(RELAY_PIN, newState ? LOW : HIGH);
        relayState = newState;  // Update global state variable
        
        // Print relay state change
        Serial.print("💡 RELAY: ");
        Serial.println(newState ? "ON 🟢" : "OFF 🔴");
        
        // === PUBLISH STATE UPDATE ===
        // Create JSON document with power state information
        StaticJsonDocument<200> stateDoc;
        stateDoc["ts"] = millis();                          // Timestamp in milliseconds since boot
        stateDoc["watts"] = relayState ? 100 : 0;           // Power consumption: 100W when ON, 0W when OFF
        stateDoc["voltage"] = 230;                          // Voltage (hardcoded, add sensor for real measurement)
        stateDoc["current"] = relayState ? 0.26 : 0.0;      // Current: 0.26A when ON (calculated from 100W/230V)
        
        // Serialize JSON to string
        String jsonString;
        serializeJson(stateDoc, jsonString);
        
        // Publish state update to power topic
        mqttClient.publish(powerTopic, jsonString.c_str());
        
        Serial.println("📤 Published state update");
      }
    });
    
    // === MQTT CONNECTION ===
    Serial.println();
    Serial.println("🔌 Connecting to MQTT Broker...");
    Serial.print("Broker: ");
    Serial.print(MQTT_BROKER);
    Serial.print(":");
    Serial.println(MQTT_PORT);
    
    // Attempt to connect to MQTT broker
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println("✅ MQTT CONNECTED!");
      
      // Subscribe to command topic to receive ON/OFF commands
      mqttClient.subscribe(cmdTopic);
      Serial.println("✅ Subscribed to command topic");
      
      // === PUBLISH INITIAL STATE ===
      // Send initial device state to dashboard (OFF state on startup)
      StaticJsonDocument<200> doc;
      doc["ts"] = millis();      // Current timestamp
      doc["watts"] = 0;          // Power: 0W (device is OFF)
      doc["voltage"] = 230;      // Voltage
      doc["current"] = 0.0;      // Current: 0A
      
      // Serialize and publish initial state
      String jsonString;
      serializeJson(doc, jsonString);
      mqttClient.publish(powerTopic, jsonString.c_str());
      Serial.println("📤 Published initial state");
      
      // Print success message and usage instructions
      Serial.println();
      Serial.println("🎉 SYSTEM FULLY OPERATIONAL!");
      Serial.println("Test commands:");
      Serial.print("Topic: ");
      Serial.println(cmdTopic);
      Serial.println("Message: {\"on\": true}  or  {\"on\": false}");
      
    } else {
      // MQTT connection failed
      Serial.println("❌ MQTT connection failed");
      Serial.print("Error code: ");
      Serial.println(mqttClient.state());  // Print error code for debugging
    }
    
  } else {
    // WiFi connection failed
    Serial.println();
    Serial.println("❌ WiFi connection failed");
  }
}

/**
 * loop() - Arduino main loop function, runs continuously after setup()
 * 
 * Responsibilities:
 * 1. Monitor WiFi connection status
 * 2. Maintain MQTT connection (reconnect if disconnected)
 * 3. Process incoming MQTT messages
 * 
 * This function keeps the ESP32 connected and responsive to commands
 */
void loop() {
  // Check if WiFi is still connected
  if (WiFi.status() == WL_CONNECTED) {
    
    // Check if MQTT client is disconnected
    if (!mqttClient.connected()) {
      // === MQTT RECONNECTION LOGIC ===
      // Attempt reconnection every 10 seconds to avoid spamming the broker
      static unsigned long lastReconnect = 0;  // Track last reconnection attempt
      
      // Check if 10 seconds have passed since last attempt
      if (millis() - lastReconnect > 10000) {
        lastReconnect = millis();  // Update reconnection timestamp
        
        Serial.println("🔄 Attempting MQTT reconnection...");
        
        // Try to reconnect to MQTT broker
        if (mqttClient.connect(MQTT_CLIENT_ID)) {
          // Reconnection successful
          mqttClient.subscribe(cmdTopic);  // Re-subscribe to command topic
          Serial.println("✅ MQTT reconnected!");
        }
        // If reconnection fails, it will retry in another 10 seconds
      }
      
    } else {
      // === MQTT MESSAGE PROCESSING ===
      // MQTT is connected, process any incoming messages
      // This calls the callback function when messages arrive on subscribed topics
      mqttClient.loop();
    }
  }
  // If WiFi is disconnected, the ESP32 will need to be reset or implement WiFi reconnection logic
  
  // Small delay to prevent excessive CPU usage
  delay(1000);  // Wait 1 second before next loop iteration
}

