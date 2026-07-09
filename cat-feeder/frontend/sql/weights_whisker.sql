-- Run this AFTER weights.sql. Adds support for automatic Whisker (Litter-Robot)
-- syncing: one clean weight point per cat per day, upsertable/idempotent.

alter table weights
  add column if not exists source text not null default 'manual',
  add column if not exists day date;

-- Backfill day for any existing rows (bucket by UTC date).
update weights set day = (weighed_at at time zone 'UTC')::date where day is null;

alter table weights alter column day set not null;

-- One row per cat per day so re-syncing overwrites instead of duplicating.
create unique index if not exists weights_cat_day_uidx on weights (cat, day);

-- Syncing upserts (INSERT ... ON CONFLICT DO UPDATE), which needs an UPDATE
-- policy in addition to the insert/select policies from weights.sql.
drop policy if exists "weights update" on weights;
create policy "weights update" on weights for update using (true) with check (true);
