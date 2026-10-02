-- Run in the Supabase SQL editor. Lets the PetLibro (Polar wet feeder) sync log
-- auto-feeds into feedings. `source` marks where a row came from; `external_id`
-- is unique so the same feeder event can never be logged twice.

alter table feedings add column if not exists source text;
alter table feedings add column if not exists external_id text unique;
