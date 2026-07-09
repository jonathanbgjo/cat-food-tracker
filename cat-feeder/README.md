# 🐱 Cat Feeder

Track when Umi & Ebi were fed and how their weight is trending. A physical ESP32
button box logs feedings; a Next.js site shows the log, last-fed status, and weight
trends; cat weights sync automatically from a Litter-Robot; and a Google Sheet
mirrors everything.

## How it fits together

```
 ESP32 (buttons + OLED)
   │  POST /api/feedings          (log raw/wet)
   │  GET  /api/summary           (show "last fed" + today count on the OLED)
   ▼
 Next.js app  ──────────────►  Supabase (Postgres)
   ▲   │                          ├─ feedings (id, fed_at, meal_type)
   │   │                          └─ weights  (cat, grams, day, source)
   │   │  GET /api/weights
   │   ▼
   │  Whisker sync  ◄── daily Vercel cron ── POST/GET /api/whisker/sync
   │    └─ logs into Litter-Robot (Cognito), pulls per-cat weights,
   │       stores one median point per cat per day (grams)
   │
 Google Apps Script
   ├─ doPost: Supabase webhook appends each feeding row (+ EST time)
   └─ updateWeights: daily trigger fills "Umi/Ebi weight" columns (lb)
```

## Stack

- **frontend/** — Next.js 14 (App Router), Supabase JS, no chart lib (inline SVG).
- **esp32/** — Arduino sketch: two buttons, an SSD1306 OLED, posts feedings.
- **apps-script/** — Google Apps Script bound to the "Cat Food Tracker" sheet.

## Setup

1. **Supabase** — run the SQL in `frontend/sql/` in order:
   `weights.sql` → `weights_whisker.sql`.
2. **Env** (`frontend/.env.local`, see `frontend/.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `WHISKER_EMAIL`, `WHISKER_PASSWORD` (your Litter-Robot / Whisker login)
3. **Run** — `cd frontend && npm install && npm run dev`.
4. **Weight sync** — click "Sync from Litter-Robot" on the site, or let the daily
   Vercel cron (`frontend/vercel.json`) hit `/api/whisker/sync`. Set the same
   `WHISKER_*` env vars in Vercel for the cron.
5. **Google Sheet** — paste `apps-script/updateWeights.gs` into the sheet's Apps
   Script project, set the anon key, and add a daily trigger for `updateWeights`.

## Notes

- Weights are stored in **grams** (canonical); the UI and sheet display **lb**.
- The Whisker API is community-reverse-engineered (via pylitterbot) and unofficial —
  it can break at any time; the app degrades gracefully if a sync fails.
- Weight points are one median value per cat per day; the Litter-Robot doesn't
  always record both cats every day, so gaps are expected.
- Future ideas live in `BACKLOG.md`.
