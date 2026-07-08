#pragma once

// WiFi credentials
#define WIFI_SSID     "jj"
#define WIFI_PASSWORD "teamyejinni"

// POST feedings here (writes a row)
#define API_URL     "https://cat-food-tracker-one.vercel.app/api/feedings"

// GET the display summary here { last_fed_at, today_count }
#define SUMMARY_URL "https://cat-food-tracker-one.vercel.app/api/summary"

// GPIO pins for buttons
#define BUTTON_RAW_PIN 19
#define BUTTON_WET_PIN 18

// Debounce delay in ms
#define DEBOUNCE_MS 300
