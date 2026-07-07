#pragma once

// WiFi credentials
#define WIFI_SSID     "jj"
#define WIFI_PASSWORD "teamyejinni"

// Your Vercel deployment URL (ESP32 posts here, not directly to Supabase)
#define API_URL "https://cat-food-tracker-one.vercel.app/api/feedings"

// GPIO pins for buttons
#define BUTTON_RAW_PIN 19
#define BUTTON_WET_PIN 18

// Debounce delay in ms
#define DEBOUNCE_MS 300
