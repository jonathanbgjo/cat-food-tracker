#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

unsigned long lastPressRaw = 0;
unsigned long lastPressWet = 0;

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_RAW_PIN, INPUT_PULLUP);
  pinMode(BUTTON_WET_PIN, INPUT_PULLUP);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected: " + WiFi.localIP().toString());
}

void logFeeding(const char* mealType) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, skipping");
    return;
  }

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<64> doc;
  doc["meal_type"] = mealType;
  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  Serial.printf("POST %s -> %d\n", mealType, code);
  http.end();
}

void loop() {
  unsigned long now = millis();

  // Raw button
  if (digitalRead(BUTTON_RAW_PIN) == LOW && now - lastPressRaw > DEBOUNCE_MS) {
    lastPressRaw = now;
    Serial.println("Raw button pressed");
    logFeeding("raw");
  }

  // Wet button
  if (digitalRead(BUTTON_WET_PIN) == LOW && now - lastPressWet > DEBOUNCE_MS) {
    lastPressWet = now;
    Serial.println("Wet button pressed");
    logFeeding("wet");
  }

  delay(50);
}
