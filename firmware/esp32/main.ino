#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_INA219.h>

/* ===================== USER SETTINGS ===================== */
// WiFi
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// MQTT (TCP, not WebSocket)
const char* MQTT_HOST = "192.168.1.100";  // Broker host/IP running Mosquitto
const int   MQTT_PORT = 1883;             // TCP listener

// Identity (MUST match your frontend Settings → Home ID, & Device IDs used there)
const char* HOME_ID   = "home1";
const char* DEVICE_ID = "device_001";

// Optional device metadata (used by Discover UI + consistency in app)
const char* DEVICE_NAME   = "Refrigerator";
const char* DEVICE_ROOM   = "Kitchen";
const char* DEVICE_TYPE   = "fridge"; // "fridge" | "washer" | "ac" | "heater" | "water" | "microwave" | "default"
const int   THRESHOLD_W   = 1000;
const int   AUTO_OFF_MINS = 0;

// Relay pin (controls a load). Active HIGH:
#define PIN_RELAY 27

// Publish periods
const uint32_t POWER_INTERVAL_MS  = 1000;   // live power every 1s
const uint32_t ENERGY_INTERVAL_MS = 10000;  // energy batch every 10s
const uint32_t META_INTERVAL_MS   = 60000;  // refresh retained meta every 60s

/* ===================== INTERNAL STATE ===================== */
WiFiClient      wifiClient;
PubSubClient    mqtt(wifiClient);
Adafruit_INA219 ina219;

bool     relayOn = false;
double   wh_total = 0.0;
uint32_t lastLoopMs     = 0;
uint32_t lastPowerMs    = 0;
uint32_t lastEnergyMs   = 0;
uint32_t lastMetaMs     = 0;

// Simple smoothing for noisy sensors (EMA)
bool   emaInit = false;
float  wattsEMA = 0.0f;
const  float EMA_ALPHA = 0.25f; // 0..1 (higher = faster follow)

/* ===================== TOPICS (helpers) ===================== */
String topicPower()  { return String("home/") + HOME_ID + "/sensor/" + DEVICE_ID + "/power"; }
String topicEnergy() { return String("home/") + HOME_ID + "/sensor/" + DEVICE_ID + "/energy"; }
String topicMeta()   { return String("home/") + HOME_ID + "/device/" + DEVICE_ID + "/meta"; }
String topicIndex()  { return String("home/") + HOME_ID + "/devices"; }
String topicCmd()    { return String("home/") + HOME_ID + "/cmd/" + DEVICE_ID + "/set"; }
String topicLWT()    { return String("home/") + HOME_ID + "/device/" + DEVICE_ID + "/status"; }

/* ===================== TIME UTILS ===================== */
// For prototypes we’ll use millis() as our timestamp source.
// If you need true epoch, add NTP and replace this function.
uint64_t nowUnixMs() { return (uint64_t)millis(); }

/* ===================== RELAY ===================== */
void setRelay(bool on) {
  relayOn = on;
  digitalWrite(PIN_RELAY, on ? HIGH : LOW);
}

/* ===================== WIFI ===================== */
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi: connecting");
  int spins = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (++spins % 40 == 0) Serial.println();
  }
  Serial.println();
  Serial.print("WiFi OK: "); Serial.println(WiFi.localIP());
}

/* ===================== MQTT: PUBLISH HELPERS ===================== */
void publishMeta(bool force = false) {
  uint32_t now = millis();
  if (!force && (now - lastMetaMs) < META_INTERVAL_MS) return;
  lastMetaMs = now;

  // Retained metadata document (used by discovery/consistency in UI)
  String meta = String("{\"id\":\"") + DEVICE_ID +
    "\",\"name\":\"" + DEVICE_NAME +
    "\",\"room\":\"" + DEVICE_ROOM +
    "\",\"type\":\"" + DEVICE_TYPE +
    "\",\"thresholdW\":" + THRESHOLD_W +
    ",\"autoOffMins\":" + AUTO_OFF_MINS +
    "}";

  mqtt.publish(topicMeta().c_str(), meta.c_str(), true);

  // Minimal retained index (handy if you ever enable the Discover page again)
  String idx = String("{\"ids\":[\"") + DEVICE_ID + "\"],\"ts\":" + nowUnixMs() + "}";
  mqtt.publish(topicIndex().c_str(), idx.c_str(), true);
}

void publishPower(float watts, float volts, float amps) {
  String json = String("{\"ts\":") + nowUnixMs() +
                ",\"watts\":"  + String(watts, 2) +
                ",\"voltage\":" + String(volts, 2) +
                ",\"current\":" + String(amps, 3) + "}";
  mqtt.publish(topicPower().c_str(), json.c_str());
}

void publishEnergy() {
  String json = String("{\"ts\":") + nowUnixMs() +
                ",\"wh_total\":" + String(wh_total, 2) + "}";
  mqtt.publish(topicEnergy().c_str(), json.c_str());
}

/* ===================== SENSOR READ ===================== */
float readPowerWatts(float& outVolts, float& outAmps) {
  // INA219 returns:
  // - Bus Voltage (V)
  // - Current (mA)
  outVolts = ina219.getBusVoltage_V();
  outAmps  = ina219.getCurrent_mA() / 1000.0f;
  float watts = outVolts * outAmps;
  if (watts < 0) watts = 0; // clamp
  // EMA smoothing
  if (!emaInit) { wattsEMA = watts; emaInit = true; }
  else          { wattsEMA = EMA_ALPHA * watts + (1.0f - EMA_ALPHA) * wattsEMA; }
  return wattsEMA;
}

/* ===================== ENERGY INTEGRATION ===================== */
// Add Wh using elapsed time (dtMs) since last loop
void integrateEnergy(float watts, uint32_t dtMs) {
  if (dtMs == 0) return;
  double wh = (double)watts * ((double)dtMs / 1000.0) / 3600.0;
  if (wh > 0) wh_total += wh;
}

/* ===================== MQTT CALLBACK ===================== */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (String(topic) != topicCmd()) return;

  // Parse tiny JSON: {"on":true} or {"on":false}
  char buf[256];
  unsigned int n = (length < sizeof(buf)-1) ? length : sizeof(buf)-1;
  memcpy(buf, payload, n);
  buf[n] = '\0';
  String s(buf);
  s.toLowerCase();

  bool on = relayOn;
  if (s.indexOf("\"on\":true")  >= 0) on = true;
  if (s.indexOf("\"on\":false") >= 0) on = false;

  setRelay(on);
  Serial.print("CMD relay -> "); Serial.println(on ? "ON" : "OFF");
}

/* ===================== MQTT CONNECT ===================== */
void ensureMqtt() {
  while (!mqtt.connected()) {
    String clientId = String("esp32-") + DEVICE_ID + "-" + String(random(0xffff), HEX);

    // Last Will & Testament: "offline"
    bool ok = mqtt.connect(
      clientId.c_str(),
      NULL, NULL,
      topicLWT().c_str(), 1, true, "offline"
    );

    if (ok) {
      // Mark online (retained)
      mqtt.publish(topicLWT().c_str(), "online", true);
      // Subscribe to commands
      mqtt.subscribe(topicCmd().c_str());
      // Publish retained metadata & index
      publishMeta(true);
      Serial.println("MQTT connected.");
    } else {
      Serial.print("MQTT failed, rc="); Serial.println(mqtt.state());
      delay(1000);
    }
  }
}

/* ===================== SETUP / LOOP ===================== */
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(PIN_RELAY, OUTPUT);
  setRelay(false);

  // INA219 init (gain/range can be tuned if needed)
  if (!ina219.begin()) {
    Serial.println("ERROR: INA219 not found");
    while (1) { delay(100); }
  }

  connectWiFi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  ensureMqtt();

  uint32_t now = millis();
  lastLoopMs   = now;
  lastPowerMs  = now;
  lastEnergyMs = now;
  lastMetaMs   = 0; // force initial meta publish
}

void loop() {
  // Keep links alive
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqtt.connected()) ensureMqtt();
  mqtt.loop();

  // Timing
  uint32_t now  = millis();
  uint32_t dtMs = now - lastLoopMs;
  lastLoopMs = now;

  // Read & integrate
  float V=0, I=0;
  float watts = readPowerWatts(V, I);
  integrateEnergy(watts, dtMs);

  // Periodic publishes
  if (now - lastPowerMs >= POWER_INTERVAL_MS) {
    lastPowerMs = now;
    publishPower(watts, V, I);
  }
  if (now - lastEnergyMs >= ENERGY_INTERVAL_MS) {
    lastEnergyMs = now;
    publishEnergy();
  }

  // Periodic retained meta refresh
  publishMeta(false);
}
