-- ═══════════════════════════════════════════════════════════════════════════
-- API usage rate limiting for the AI endpoints (star-chat, mark-written).
-- Run this ONCE in the Supabase SQL editor before the 200/day cap takes effect.
-- Until it is run, the endpoints still work and JWT auth is still enforced —
-- only the daily cap is inactive (the endpoints fail open on a missing table).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.api_usage (
  user_id uuid not null,
  day     date not null default (now() at time zone 'utc')::date,
  count   integer not null default 0,
  primary key (user_id, day)
);

-- Atomic increment: bumps today's counter for a user and returns the new count.
-- SECURITY DEFINER so it runs with the owner's rights (callers use the service key).
create or replace function public.increment_api_usage(uid uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
  today date := (now() at time zone 'utc')::date;
begin
  insert into public.api_usage (user_id, day, count)
    values (uid, today, 1)
  on conflict (user_id, day)
    do update set count = api_usage.count + 1
  returning count into new_count;
  return new_count;
end;
$$;

-- Optional housekeeping: drop rows older than 30 days (run manually or via cron).
-- delete from public.api_usage where day < (now() at time zone 'utc')::date - 30;
