#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <time.h>
#include "config.h"

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

unsigned long lastPressRaw = 0;
unsigned long lastPressWet = 0;
unsigned long lastRefresh = 0;
const unsigned long REFRESH_MS = 60000;

// cached summary from server
time_t lastFedEpoch = 0;   // 0 = never
int todayCount = 0;

void showMessage(const char* l1, const char* l2) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(l1);
  if (l2) { display.setCursor(0, 24); display.println(l2); }
  display.display();
}

// parse "2026-07-07T03:41:39.419223+00:00" as UTC epoch
time_t parseIso8601Utc(const char* s) {
  int Y, Mo, D, H, Mi, S;
  if (sscanf(s, "%d-%d-%dT%d:%d:%d", &Y, &Mo, &D, &H, &Mi, &S) != 6) return 0;
  struct tm tm = {0};
  tm.tm_year = Y - 1900; tm.tm_mon = Mo - 1; tm.tm_mday = D;
  tm.tm_hour = H; tm.tm_min = Mi; tm.tm_sec = S;
  // device runs in UTC (configTime(0,0,...)), so mktime here == UTC epoch
  return mktime(&tm);
}

void agoString(time_t past, char* buf, size_t n) {
  if (past == 0) { snprintf(buf, n, "never"); return; }
  time_t now = time(nullptr);
  long d = (long)(now - past);
  if (d < 0) d = 0;
  long days = d / 86400, hrs = (d % 86400) / 3600, mins = (d % 3600) / 60;
  if (days > 0)      snprintf(buf, n, "%ldd %ldh ago", days, hrs);
  else if (hrs > 0)  snprintf(buf, n, "%ldh %ldm ago", hrs, mins);
  else               snprintf(buf, n, "%ldm ago", mins);
}

void renderStatus() {
  char ago[24];
  agoString(lastFedEpoch, ago, sizeof(ago));

  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Fed");
  display.setTextSize(2);
  display.setCursor(0, 12);
  display.println(ago);

  display.setTextSize(1);
  display.setCursor(0, 40);
  char line[24];
  snprintf(line, sizeof(line), "Today: %d times", todayCount);
  display.println(line);

  display.display();
}

bool postFeeding(const char* mealType) {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  StaticJsonDocument<64> doc;
  doc["meal_type"] = mealType;
  String body; serializeJson(doc, body);
  int code = http.POST(body);
  Serial.printf("POST %s -> %d\n", mealType, code);
  http.end();
  return code >= 200 && code < 300;
}

void refreshSummary() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(API_URL); // GET returns { last_fed_at, today_count }
  int code = http.GET();
  if (code != 200) { Serial.printf("GET -> %d\n", code); http.end(); return; }
  String payload = http.getString();
  http.end();

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, payload)) { Serial.println("parse fail"); return; }

  const char* lastFed = doc["last_fed_at"];
  todayCount = doc["today_count"] | 0;
  lastFedEpoch = (lastFed && strlen(lastFed) > 0) ? parseIso8601Utc(lastFed) : 0;
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(BUTTON_RAW_PIN, INPUT_PULLUP);
  pinMode(BUTTON_WET_PIN, INPUT_PULLUP);

  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println("OLED init failed");
  showMessage("Booting", "WiFi...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 60) { delay(500); Serial.print("."); tries++; }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi: " + WiFi.localIP().toString());
    configTime(0, 0, "pool.ntp.org"); // device clock in UTC
    struct tm ti; int t = 0;
    while (!getLocalTime(&ti) && t < 10) { delay(500); t++; }
    refreshSummary();
    renderStatus();
  } else {
    showMessage("WiFi", "failed");
  }
}

void loop() {
  unsigned long now = millis();

  if (digitalRead(BUTTON_RAW_PIN) == LOW && now - lastPressRaw > 300) {
    lastPressRaw = now;
    showMessage("Logging", "RAW...");
    postFeeding("raw");
    refreshSummary();
    renderStatus();
  }

  if (digitalRead(BUTTON_WET_PIN) == LOW && now - lastPressWet > 300) {
    lastPressWet = now;
    showMessage("Logging", "WET...");
    postFeeding("wet");
    refreshSummary();
    renderStatus();
  }

  if (now - lastRefresh > REFRESH_MS) {
    lastRefresh = now;
    refreshSummary();
    renderStatus();
  }

  delay(50);
}
