# Backlog

Future ideas, not yet built.

## Twilio weight-change alert
Send an SMS when a cat's weight changes by more than a threshold (e.g. **>3%**).

- **Trigger:** run the check at the end of the Whisker sync (`app/api/whisker/sync/route.ts`), after the upsert — compare each cat's new latest daily point against the prior comparison point (reuse the same "most recent reading ≥6 days earlier, else previous" logic as the UI `trendFor`).
- **Condition:** `abs(pct change) > THRESHOLD` (env-configurable, default 3%). Only alert once per new data point (dedupe on `(cat, day)` so a re-sync doesn't re-text).
- **Send:** Twilio Messages API. Needs env vars: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ALERT_TO_NUMBER`. Message e.g. `"⚠️ Ebi is up 3.4% (7.0 → 7.2 lb) since last week."`
- **Notes:**
  - Consider a `weight_alerts` table (or a `alerted_at` column on `weights`) to record what's already been notified, so cron re-runs don't duplicate texts.
  - Weights are stored in grams; display + message in **lb** (`grams / 453.59237`).
  - Threshold direction: probably alert on both gain and loss, but loss may matter more for cat health — could weight the thresholds differently.
