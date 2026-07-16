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

 Feeding schedule (ML)
   ├─ learnSchedule: k-means clusters feeding times into daily slots
   ├─ predictNext: next expected feeding / overdue detection (in-app banner)
   └─ /api/schedule/check ◄── external cron ──► Telegram "overdue" alert
```

## Stack

- **frontend/** — Next.js 14 (App Router), Supabase JS, no chart lib (inline SVG).
- **esp32/** — Arduino sketch: two buttons, an SSD1306 OLED, posts feedings.
- **apps-script/** — Google Apps Script bound to the "Cat Food Tracker" sheet.

## Setup

1. **Supabase** — run the SQL files in `frontend/sql/`:
   `weights.sql` → `weights_whisker.sql`, plus `feeding_alerts.sql` and
   `restocks.sql`.
2. **Env** (`frontend/.env.local`, see `frontend/.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `WHISKER_EMAIL`, `WHISKER_PASSWORD` (your Litter-Robot / Whisker login)
   - `RESTOCK_PASSWORD` (gate for the raw-food Restock button)
3. **Run** — `cd frontend && npm install && npm run dev`.
4. **Weight sync** — click "Sync from Litter-Robot" on the site, or let the daily
   Vercel cron (`frontend/vercel.json`) hit `/api/whisker/sync`. Set the same
   `WHISKER_*` env vars in Vercel for the cron.
5. **Google Sheet** — paste `apps-script/updateWeights.gs` into the sheet's Apps
   Script project, set the anon key, and add a daily trigger for `updateWeights`.

## Feeding schedule + overdue alerts (Telegram)

The app learns the cats' feeding rhythm (k-means on time-of-day) and shows a live
"next feeding / overdue" banner. To also get a **free Telegram text** when they're
overdue:

1. **Create a bot** — message [@BotFather](https://t.me/BotFather) → `/newbot` →
   copy the token into `TELEGRAM_BOT_TOKEN`.
2. **Get your chat id** — send any message to your new bot, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and read `result[].message.chat.id`
   into `TELEGRAM_CHAT_ID`. (For a group alert to you + Mary, add the bot to a group
   and use the group's negative chat id.)
3. **Run** `frontend/sql/feeding_alerts.sql` in Supabase (de-dupe table).
4. **Set `CRON_SECRET`** to any random string (gates the endpoint).
5. **Schedule the check** — point a free cron at
   `https://<your-app>/api/schedule/check?key=<CRON_SECRET>` every ~30 min
   (e.g. [cron-job.org](https://cron-job.org); or Vercel cron if you're on Pro —
   Hobby only allows daily). It self-suppresses during the overnight lull and texts
   at most once per missed slot.
   - Test the wiring anytime: `/api/schedule/check?key=<CRON_SECRET>&test=1`.

## Raw food inventory

Hit **Restock** (password-gated) to log a bag of raw food. Each raw feeding counts
down **2 oz** (1 oz × 2 cats); the panel shows lb + % remaining. When it drops to
**≤30%**, the schedule-check cron sends a Telegram "restock soon" alert (once per
restock cycle). Restock amount is per-event — enter 20 lb normally, 30 lb for a big
bag. Requires `restocks.sql` + `RESTOCK_PASSWORD`.

## Notes

- Weights are stored in **grams** (canonical); the UI and sheet display **lb**.
- The Whisker API is community-reverse-engineered (via pylitterbot) and unofficial —
  it can break at any time; the app degrades gracefully if a sync fails.
- Weight points are one median value per cat per day; the Litter-Robot doesn't
  always record both cats every day, so gaps are expected.
- Future ideas live in `BACKLOG.md`.
