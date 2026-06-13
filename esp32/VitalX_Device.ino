/**
 * VitalX_Device.ino
 * ESP32 + MAX30102 — Vital X IoT Medical Monitoring
 *
 * Adapted from the original ESP8266/Firebase project.
 * Same sensor logic — Firebase replaced with HTTP POST to the Vital X backend.
 *
 * ── Wiring (unchanged from your previous project) ────────────────────────────
 *  MAX30102  →  ESP32
 *  VIN       →  3V3
 *  GND       →  GND
 *  SDA       →  GPIO 21  (ESP32 default)
 *  SCL       →  GPIO 22  (ESP32 default)
 *
 * ── Libraries needed (Tools → Manage Libraries) ──────────────────────────────
 *  Already have: "SparkFun MAX3010x Pulse and Proximity Sensor Library"
 *  Add new:      "ArduinoJson" by Benoit Blanchon
 *
 * ── Board ─────────────────────────────────────────────────────────────────────
 *  Tools → Board → "ESP32 Dev Module"
 *  (ESP8266WiFi.h is replaced with WiFi.h for ESP32)
 */

// ── Changed: ESP32 WiFi + HTTP instead of ESP8266 + Firebase ─────────────────
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Unchanged: sensor libraries ───────────────────────────────────────────────
#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"

// =============================================================================
//  CONFIGURATION — only these need editing
// =============================================================================

// ── WiFi (same as before) ─────────────────────────────────────────────────────
#define WIFI_SSID     "Braniax"
#define WIFI_PASSWORD "aaaaaaaa"

// ── Vital X backend ───────────────────────────────────────────────────────────
// Your PC's local IP address on the same WiFi network.
// Windows: open cmd → type  ipconfig  → look for "IPv4 Address" under WiFi
// Example: "http://192.168.1.105:5000"
#define SERVER_URL "http://192.168.1.100:5000"   // <-- change to your PC's IP

// Must match DEVICE_API_KEY in backend/.env
#define DEVICE_API_KEY "esp32_device_secret_key_2025"

// Unique name for this device (shows in backend logs)
#define DEVICE_ID "ESP32-001"

// Patient membership ID from the Vital X dashboard
// e.g. "GH-2025-001" — the backend looks up the patient automatically
#define PATIENT_MEMBERSHIP_ID "GH-2025-001"      // <-- change per patient

// =============================================================================
//  SENSOR SETUP (identical to your original code)
// =============================================================================

MAX30105 particleSensor;

#define OUR_BUFFER_SIZE 50

uint32_t irBuffer[OUR_BUFFER_SIZE];
uint32_t redBuffer[OUR_BUFFER_SIZE];

// =============================================================================
//  SETUP
// =============================================================================

void setup() {
  Serial.begin(115200);
  Wire.begin();   // ESP32: defaults to SDA=GPIO21, SCL=GPIO22

  // ── WiFi ────────────────────────────────────────────────────────────────────
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("🔌 Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected.");
  Serial.print("   IP: ");
  Serial.println(WiFi.localIP());

  // ── MAX30102 sensor (same config as your original) ───────────────────────────
  if (!particleSensor.begin(Wire, I2C_SPEED_STANDARD)) {
    Serial.println("❌ MAX30102 not found. Check wiring.");
    while (1);
  }

  // Identical to your original settings
  particleSensor.setup(60, 4, 2, 100, 411, 4096);
  particleSensor.setPulseAmplitudeRed(0x1F);
  particleSensor.setPulseAmplitudeIR(0x1F);

  // ── Check backend is reachable ────────────────────────────────────────────────
  pingServer();

  Serial.println("🟢 Device ready. Place finger on the sensor.");
}

// =============================================================================
//  MAIN LOOP
// =============================================================================

void loop() {

  // ── Wait for finger contact (same threshold as your original) ────────────────
  long ir = particleSensor.getIR();
  if (ir < 50000) {
    Serial.println("🟡 Waiting for stable finger contact...");
    delay(500);
    return;
  }

  // ── Collect samples (identical to your original) ─────────────────────────────
  Serial.println("📊 Collecting samples...");
  for (byte i = 0; i < OUR_BUFFER_SIZE; i++) {
    while (!particleSensor.available()) particleSensor.check();
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i]  = particleSensor.getIR();
    particleSensor.nextSample();
  }

  // ── Run SpO2 + Heart Rate algorithm (identical) ───────────────────────────────
  int32_t spo2;
  int8_t  validSPO2;
  int32_t heartRate;
  int8_t  validHeartRate;

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, OUR_BUFFER_SIZE, redBuffer,
    &spo2, &validSPO2, &heartRate, &validHeartRate
  );

  // ── Validation (identical to your original) ────────────────────────────────
  if (heartRate < 30 || heartRate > 220 || !validHeartRate) {
    Serial.println("⚠️ Invalid heart rate detected. Skipping upload.");
    return;
  }
  if (spo2 < 70 || spo2 > 100 || !validSPO2) {
    Serial.println("⚠️ Invalid SpO₂ detected. Skipping upload.");
    return;
  }

  Serial.print("❤ Heart Rate (BPM): ");
  Serial.println(heartRate);
  Serial.print("🫁 SpO₂ (%): ");
  Serial.println(spo2);

  // ── Changed: POST to Vital X backend instead of Firebase ─────────────────────
  String status = sendToVitalX(spo2, heartRate);

  if (status == "NORMAL") {
    Serial.println("✅ STATUS: NORMAL — reading saved.");
  } else if (status == "WARNING") {
    Serial.println("⚠️ STATUS: WARNING — clinician notified in app.");
  } else if (status == "CRITICAL") {
    Serial.println("🚨 STATUS: CRITICAL — SMS alert sent to emergency contacts!");
  } else {
    Serial.println("❌ Upload failed — check SERVER_URL and that backend is running.");
  }

  // ── Wait for finger removal before allowing next reading ──────────────────────
  Serial.println("   Remove finger to take another reading.\n");
  while (particleSensor.getIR() > 50000) {
    delay(200);
  }
  delay(1000);
}

// =============================================================================
//  FUNCTIONS
// =============================================================================

/**
 * sendToVitalX
 * Replaces Firebase.pushJSON() from your original code.
 * POSTs SpO2 and heartRate to the Vital X backend.
 * Returns "NORMAL", "WARNING", "CRITICAL", or "" on error.
 */
String sendToVitalX(int32_t spo2, int32_t heartRate) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("   WiFi lost — reconnecting...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    int tries = 0;
    while (WiFi.status() != WL_CONNECTED && tries < 20) {
      delay(500);
      Serial.print(".");
      tries++;
    }
    Serial.println();
    if (WiFi.status() != WL_CONNECTED) return "";
  }

  HTTPClient http;
  http.begin(String(SERVER_URL) + "/api/device/reading");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  // Build JSON — ArduinoJson replaces FirebaseJson from your original
  StaticJsonDocument<200> doc;
  doc["deviceId"]     = DEVICE_ID;
  doc["membershipId"] = PATIENT_MEMBERSHIP_ID;
  doc["spo2"]         = (float)spo2;
  doc["heartRate"]    = (float)heartRate;

  String body;
  serializeJson(doc, body);

  Serial.println("   Sending: " + body);

  int code = http.POST(body);

  if (code == 201) {
    String response = http.getString();
    Serial.println("   Server: " + response);

    StaticJsonDocument<512> resp;
    if (deserializeJson(resp, response) == DeserializationError::Ok) {
      http.end();
      return resp["status"].as<String>();
    }
  } else {
    Serial.print("   HTTP error: ");
    Serial.println(code);
    Serial.println("   " + http.getString());
  }

  http.end();
  return "";
}

/**
 * pingServer
 * Quick check that the backend is reachable on startup.
 * Same idea as Firebase.ready() in your original.
 */
void pingServer() {
  Serial.print("🌐 Checking backend connection...");
  HTTPClient http;
  http.begin(String(SERVER_URL) + "/api/device/ping");
  int code = http.GET();
  http.end();

  if (code == 200) {
    Serial.println(" ✅ reachable");
    Serial.println("   Server: " SERVER_URL);
  } else {
    Serial.println(" ❌ UNREACHABLE");
    Serial.println("   Fix SERVER_URL — must be your PC's local IP on the same WiFi.");
    Serial.println("   Run  ipconfig  in cmd to find it.");
  }
}
