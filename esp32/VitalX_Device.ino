/**
 * VitalX_Device.ino
 * ESP32 + MAX30102 — Vital X IoT Medical Monitoring Device
 *
 * Spot-check model: patient places thumb on sensor for ~15 seconds.
 * Collects SpO2 and heart rate, then POSTs to the Vital X backend API.
 * The server classifies the reading and triggers alerts if needed.
 *
 * ── Wiring ────────────────────────────────────────────────────────────────────
 *  MAX30102  →  ESP32
 *  VIN       →  3V3
 *  GND       →  GND
 *  SDA       →  GPIO 21
 *  SCL       →  GPIO 22
 *  INT       →  Not connected (polling mode)
 *
 * ── Required Libraries (install via Arduino IDE → Library Manager) ────────────
 *  1. "SparkFun MAX3010x Pulse and Proximity Sensor Library"
 *     by SparkFun Electronics  (search: MAX3010x)
 *  2. "ArduinoJson"
 *     by Benoit Blanchon        (search: ArduinoJson)
 *
 * ── Board ─────────────────────────────────────────────────────────────────────
 *  Install ESP32 boards: Arduino IDE → Boards Manager → search "esp32" →
 *  install "esp32 by Espressif Systems"
 *  Select board: "ESP32 Dev Module" (or your specific ESP32 variant)
 */

// ── Standard ESP32 + networking ───────────────────────────────────────────────
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── MAX30102 sensor ───────────────────────────────────────────────────────────
#include "MAX30105.h"
#include "spo2_algorithm.h"

// =============================================================================
//  CONFIGURATION — edit these values before flashing
// =============================================================================

// ── WiFi ──────────────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_NAME";       // <-- change
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // <-- change

// ── Backend server ────────────────────────────────────────────────────────────
// If running locally: use your PC's local IP address on the same WiFi network.
//   Windows: open cmd → ipconfig → look for "IPv4 Address" under your WiFi adapter
//   Example: "http://192.168.1.105:5000"
// If deployed online: use your full server URL
//   Example: "https://your-server.onrender.com"
const char* SERVER_URL = "http://192.168.1.100:5000";   // <-- change to your PC's IP

// ── Device identity ───────────────────────────────────────────────────────────
// Use a unique name for each physical device (appears in the backend logs)
const char* DEVICE_ID  = "ESP32-001";

// This must match DEVICE_API_KEY in your backend/.env file
const char* DEVICE_API_KEY = "esp32_device_secret_key_2025";

// ── Patient ───────────────────────────────────────────────────────────────────
// The membership ID of the patient this device is assigned to.
// Find this in the Vital X dashboard or from the seed data (e.g. "GH-2025-001")
const char* PATIENT_MEMBERSHIP_ID = "GH-2025-001";    // <-- change per patient

// =============================================================================
//  CONSTANTS
// =============================================================================

// LED pins (GPIO 2 is the built-in LED on most ESP32 dev boards)
#define LED_BUILTIN_PIN   2
#define LED_GREEN_PIN     25    // Optional external green LED
#define LED_RED_PIN       26    // Optional external red LED

// Finger detection threshold — IR value above this means finger is present
#define FINGER_THRESHOLD  50000

// Number of samples to collect per reading (100 @ ~25 sps = ~4 seconds)
// Increase to 200 for more accurate readings (~8 seconds)
#define BUFFER_SIZE       100

// How long to wait between readings (milliseconds) — 30 seconds
#define READING_COOLDOWN  30000

// =============================================================================
//  GLOBAL OBJECTS
// =============================================================================

MAX30105 sensor;

// Raw LED buffers for SpO2 algorithm
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];

// Results from SpO2 algorithm
int32_t  spo2Value;
int8_t   validSPO2;
int32_t  heartRateValue;
int8_t   validHeartRate;

// State machine
enum DeviceState {
  STATE_IDLE,          // Waiting for finger
  STATE_COLLECTING,    // Collecting sensor data
  STATE_SENDING,       // Sending to backend
  STATE_RESULT,        // Showing result
  STATE_COOLDOWN       // Waiting before next reading
};

DeviceState currentState = STATE_IDLE;
unsigned long cooldownStart = 0;

// =============================================================================
//  SETUP
// =============================================================================

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n====================================");
  Serial.println("  Vital X IoT Device — ESP32");
  Serial.println("====================================\n");

  // ── LED pins ────────────────────────────────────────────────────────────────
  pinMode(LED_BUILTIN_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN,   OUTPUT);
  pinMode(LED_RED_PIN,     OUTPUT);
  ledsOff();

  // ── WiFi connection ──────────────────────────────────────────────────────────
  connectWiFi();

  // ── MAX30102 sensor init ────────────────────────────────────────────────────
  initSensor();

  // ── Ping backend to confirm reachability ────────────────────────────────────
  pingServer();

  Serial.println("\n✅  Setup complete.");
  Serial.println("   Place patient's thumb on the sensor to begin.\n");
  blinkGreen(3);
}

// =============================================================================
//  MAIN LOOP
// =============================================================================

void loop() {
  switch (currentState) {

    // ── Waiting for finger ─────────────────────────────────────────────────────
    case STATE_IDLE: {
      long irValue = sensor.getIR();

      if (irValue > FINGER_THRESHOLD) {
        Serial.println("👆  Finger detected — collecting reading...");
        digitalWrite(LED_BUILTIN_PIN, HIGH);
        currentState = STATE_COLLECTING;
        delay(200);  // brief debounce
      } else {
        // Pulse the built-in LED slowly to show device is alive
        static unsigned long lastPulse = 0;
        if (millis() - lastPulse > 1500) {
          digitalWrite(LED_BUILTIN_PIN, !digitalRead(LED_BUILTIN_PIN));
          lastPulse = millis();
        }
      }
      break;
    }

    // ── Collecting sensor samples ──────────────────────────────────────────────
    case STATE_COLLECTING: {
      Serial.print("   Collecting ");
      Serial.print(BUFFER_SIZE);
      Serial.println(" samples...");

      bool fingerLost = false;

      // Fill both red and IR buffers
      for (int i = 0; i < BUFFER_SIZE; i++) {
        // Wait for a new sample to be ready
        while (!sensor.available()) {
          sensor.check();
        }

        redBuffer[i] = sensor.getRed();
        irBuffer[i]  = sensor.getIR();
        sensor.nextSample();

        // Check finger is still on sensor
        if (irBuffer[i] < FINGER_THRESHOLD) {
          Serial.println("⚠️   Finger removed mid-reading — aborting.");
          fingerLost = true;
          break;
        }

        // Print a dot every 10 samples so the user can see progress
        if (i % 10 == 0) Serial.print(".");
      }
      Serial.println();

      if (fingerLost) {
        currentState = STATE_IDLE;
        digitalWrite(LED_BUILTIN_PIN, LOW);
        break;
      }

      // ── Run SpO2 + Heart Rate algorithm ──────────────────────────────────────
      maxim_heart_rate_and_oxygen_saturation(
        irBuffer, BUFFER_SIZE,
        redBuffer,
        &spo2Value, &validSPO2,
        &heartRateValue, &validHeartRate
      );

      // ── Validate results ─────────────────────────────────────────────────────
      if (!validSPO2 || !validHeartRate || spo2Value <= 0 || heartRateValue <= 0) {
        Serial.println("⚠️   Invalid reading — keep finger still and try again.");
        blinkRed(2);
        currentState = STATE_IDLE;
        digitalWrite(LED_BUILTIN_PIN, LOW);
        break;
      }

      // Sanity-check ranges
      if (spo2Value < 70 || spo2Value > 100 || heartRateValue < 30 || heartRateValue > 250) {
        Serial.println("⚠️   Reading out of range — try again.");
        blinkRed(2);
        currentState = STATE_IDLE;
        digitalWrite(LED_BUILTIN_PIN, LOW);
        break;
      }

      Serial.printf("   SpO2: %d%%   Heart Rate: %d bpm\n", spo2Value, heartRateValue);
      currentState = STATE_SENDING;
      break;
    }

    // ── Sending to backend ─────────────────────────────────────────────────────
    case STATE_SENDING: {
      Serial.println("📡  Sending reading to Vital X server...");

      // Reconnect WiFi if dropped
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println("   WiFi disconnected — reconnecting...");
        connectWiFi();
      }

      String result = sendReading(
        (float)spo2Value,
        (float)heartRateValue
      );

      if (result == "NORMAL") {
        Serial.println("✅  STATUS: NORMAL");
        blinkGreen(3);
      } else if (result == "WARNING") {
        Serial.println("⚠️   STATUS: WARNING — clinician notified");
        blinkYellow(5);
      } else if (result == "CRITICAL") {
        Serial.println("🚨  STATUS: CRITICAL — SMS alert sent!");
        blinkRed(10);
      } else {
        Serial.println("❌  Failed to send — check server connection.");
        blinkRed(3);
      }

      currentState  = STATE_COOLDOWN;
      cooldownStart = millis();
      digitalWrite(LED_BUILTIN_PIN, LOW);
      break;
    }

    // ── Cooldown before next reading ───────────────────────────────────────────
    case STATE_COOLDOWN: {
      unsigned long elapsed = millis() - cooldownStart;
      if (elapsed >= READING_COOLDOWN) {
        Serial.println("\n── Ready for next reading ──────────────────");
        Serial.println("   Place patient's thumb on the sensor.\n");
        currentState = STATE_IDLE;
      } else {
        // Print countdown every 5 seconds
        static unsigned long lastPrint = 0;
        if (millis() - lastPrint > 5000) {
          int remaining = (READING_COOLDOWN - elapsed) / 1000;
          Serial.printf("   Next reading in %d seconds...\n", remaining);
          lastPrint = millis();
        }
      }
      break;
    }

    default:
      currentState = STATE_IDLE;
      break;
  }
}

// =============================================================================
//  FUNCTIONS
// =============================================================================

// ── Connect to WiFi ──────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("📶  Connecting to WiFi: %s", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" connected!");
    Serial.printf("   IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println(" FAILED!");
    Serial.println("   Check SSID/password. Restarting in 5s...");
    delay(5000);
    ESP.restart();
  }
}

// ── Initialise MAX30102 sensor ───────────────────────────────────────────────
void initSensor() {
  Serial.print("🔬  Initialising MAX30102 sensor...");

  if (!sensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println(" FAILED!");
    Serial.println("   Check wiring: SDA→GPIO21, SCL→GPIO22, VIN→3V3, GND→GND");
    Serial.println("   Halting — fix wiring and reset.");
    while (true) {
      blinkRed(1);
      delay(500);
    }
  }

  Serial.println(" OK");

  // Sensor configuration — optimised for fingertip SpO2 measurement
  byte ledBrightness = 60;    // 0=off, 255=max. 60 (~12mA) is good for fingertip
  byte sampleAverage = 4;     // Average 4 samples to reduce noise
  byte ledMode       = 2;     // 1=Red only, 2=Red+IR (needed for SpO2)
  byte sampleRate    = 100;   // 100 samples per second
  int  pulseWidth    = 411;   // 411 µs — affects ADC resolution (18-bit)
  int  adcRange      = 4096;  // ADC full scale range

  sensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  sensor.setPulseAmplitudeRed(0x0A);  // low red LED for SpO2 — reduce if too bright
  sensor.setPulseAmplitudeGreen(0);   // turn off green LED — not used for SpO2

  Serial.println("   Config: 100sps, 4x average, 18-bit ADC, Red+IR LEDs");
}

// ── Ping backend health endpoint ────────────────────────────────────────────
void pingServer() {
  Serial.print("🌐  Checking backend connection...");

  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/ping";
  http.begin(url);
  int code = http.GET();

  if (code == 200) {
    Serial.println(" reachable ✅");
    Serial.printf("   Server: %s\n", SERVER_URL);
  } else if (code < 0) {
    Serial.println(" UNREACHABLE ❌");
    Serial.printf("   URL: %s\n", url.c_str());
    Serial.println("   Is the backend running? Check SERVER_URL in the sketch.");
  } else {
    Serial.printf(" HTTP %d\n", code);
  }

  http.end();
}

// ── Send a reading to the backend ───────────────────────────────────────────
// Returns "NORMAL", "WARNING", "CRITICAL", or "" on failure
String sendReading(float spo2, float heartRate) {
  HTTPClient http;
  String url = String(SERVER_URL) + "/api/device/reading";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", DEVICE_API_KEY);

  // Build JSON body using ArduinoJson
  StaticJsonDocument<256> doc;
  doc["deviceId"]     = DEVICE_ID;
  doc["membershipId"] = PATIENT_MEMBERSHIP_ID;  // backend looks up patient by this
  doc["spo2"]         = spo2;
  doc["heartRate"]    = heartRate;
  // Omit timestamp — server will use its own clock (more reliable than ESP32 clock)

  String body;
  serializeJson(doc, body);

  Serial.printf("   POST %s\n   Body: %s\n", url.c_str(), body.c_str());

  int httpCode = http.POST(body);

  if (httpCode == 201) {
    String response = http.getString();
    Serial.printf("   Response: %s\n", response.c_str());

    // Parse status from response JSON
    StaticJsonDocument<512> resp;
    if (deserializeJson(resp, response) == DeserializationError::Ok) {
      String status = resp["status"].as<String>();
      http.end();
      return status;  // "NORMAL", "WARNING", or "CRITICAL"
    }
  } else {
    Serial.printf("   HTTP error: %d\n", httpCode);
    String errResponse = http.getString();
    Serial.printf("   Server said: %s\n", errResponse.c_str());
  }

  http.end();
  return "";  // empty string = failure
}

// =============================================================================
//  LED HELPERS
// =============================================================================

void ledsOff() {
  digitalWrite(LED_BUILTIN_PIN, LOW);
  digitalWrite(LED_GREEN_PIN,   LOW);
  digitalWrite(LED_RED_PIN,     LOW);
}

void blinkGreen(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_GREEN_PIN, HIGH);
    delay(200);
    digitalWrite(LED_GREEN_PIN, LOW);
    delay(200);
  }
}

void blinkRed(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_RED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_RED_PIN, LOW);
    delay(200);
  }
}

void blinkYellow(int times) {
  // Simulate yellow by alternating red + green quickly
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_RED_PIN,   HIGH);
    digitalWrite(LED_GREEN_PIN, HIGH);
    delay(200);
    ledsOff();
    delay(200);
  }
}
