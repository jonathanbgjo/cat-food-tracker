-- Run in the Supabase SQL editor. Tracks raw-food restocks so the app can count
-- down remaining stock (each raw feeding = 2 oz) and alert when low.
-- Each RESTOCK press inserts a row; the latest row is the current baseline.

create table if not exists restocks (
  id             uuid primary key default gen_random_uuid(),
  amount_oz      integer not null check (amount_oz > 0),
  restocked_at   timestamptz not null default now(),
  low_alert_sent boolean not null default false,
  note           text
);

create index if not exists restocks_restocked_at_idx on restocks (restocked_at desc);

alter table restocks enable row level security;

create policy "restocks read"   on restocks for select using (true);
create policy "restocks insert" on restocks for insert with check (true);
create policy "restocks update" on restocks for update using (true) with check (true);
