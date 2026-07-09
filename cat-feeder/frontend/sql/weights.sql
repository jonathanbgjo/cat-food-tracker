-- Run this once in the Supabase SQL editor to create the weights table.
-- Tracks weekly weigh-ins for each cat (Umi + Ebi).

create table if not exists weights (
  id         uuid primary key default gen_random_uuid(),
  cat        text not null check (cat in ('umi', 'ebi')),
  grams      integer not null check (grams > 0),
  weighed_at timestamptz not null default now()
);

create index if not exists weights_cat_weighed_at_idx
  on weights (cat, weighed_at desc);

-- Allow the anon key to read + insert (same trust model as feedings).
alter table weights enable row level security;

create policy "weights read"  on weights for select using (true);
create policy "weights insert" on weights for insert with check (true);
