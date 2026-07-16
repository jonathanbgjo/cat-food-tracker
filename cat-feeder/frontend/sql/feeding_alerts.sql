-- Run in the Supabase SQL editor. Tracks which "overdue" slots have already been
-- texted, so the schedule-check cron never sends a duplicate alert for the same
-- missed feeding. slot_key looks like "20281-630" (tz-day number @ minutes-of-day).

create table if not exists feeding_alerts (
  id       uuid primary key default gen_random_uuid(),
  slot_key text not null unique,
  sent_at  timestamptz not null default now()
);

alter table feeding_alerts enable row level security;

create policy "alerts read"   on feeding_alerts for select using (true);
create policy "alerts insert" on feeding_alerts for insert with check (true);
