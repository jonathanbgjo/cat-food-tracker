-- Run in the Supabase SQL editor. Tracks when the ESP32 was last heard from, so
-- the schedule-check cron can alert if the feeder goes offline. The device's
-- existing /api/summary poll (every ~60s) doubles as the heartbeat — no firmware
-- change needed.

create table if not exists device_status (
  id                 text primary key,
  last_seen          timestamptz not null default now(),
  offline_alert_sent boolean not null default false
);

alter table device_status enable row level security;

create policy "device read"   on device_status for select using (true);
create policy "device insert" on device_status for insert with check (true);
create policy "device update" on device_status for update using (true) with check (true);
