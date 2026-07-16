# Backlog

Future ideas, not yet built.

## Email alerts (in addition to Telegram)
Overdue-feeding and low-stock alerts currently go to Telegram only. To add email:
add a `sendEmail()` helper (Resend REST API is dependency-free — `POST
https://api.resend.com/emails` with `RESEND_API_KEY`; free tier can email your own
signup address from `onboarding@resend.dev`) and call it alongside `sendTelegram()`
in `app/api/schedule/check/route.ts`. Env: `RESEND_API_KEY`, `ALERT_EMAIL`.

## Lock down write access
All tables allow anon insert (matches the ESP32's trust model), so the Restock
password only gates the *button*, not direct Supabase writes. For real protection,
move writes behind a service-role key and deny anon insert in RLS.

## Weight-change alert (Telegram)
Notify when a cat's weight changes by more than a threshold (e.g. **>3%**). Reuse
the Telegram alert path already built for overdue feedings.

- **Trigger:** at the end of the Whisker sync (`app/api/whisker/sync/route.ts`),
  after the upsert — compare each cat's new latest daily point against the prior
  comparison point (reuse the "most recent reading ≥6 days earlier, else previous"
  logic from the UI `trendFor`).
- **Condition:** `abs(pct change) > THRESHOLD` (env-configurable, default 3%). Only
  alert once per new data point (a `weight_alerts` table keyed on `(cat, day)`, same
  pattern as `feeding_alerts`).
- **Send:** `lib/telegram.ts` `sendTelegram()` — no new credentials needed. Message
  e.g. `"⚠️ Ebi is up 3.4% (7.0 → 7.2 lb) since last week."`
- **Note:** loss probably matters more than gain for cat health — could use
  asymmetric thresholds.
