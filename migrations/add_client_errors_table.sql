-- Client-side error log. User-facing pages POST uncaught exceptions and failed
-- /api/ fetches to /api/save-session?action=log-error, which inserts here via
-- the service role. Rows are individual occurrences (one per event). The Sunday
-- cron (api/send-weekly-emails.js) groups them by page+message and emails a
-- summary to the admin if any occurred in the past 7 days.
--
-- Safe to run anytime. The log-error endpoint self-heals if this table is
-- absent (insert fails → swallowed → still returns 200), so nothing breaks
-- before it is created.

create table if not exists client_errors (
  id          uuid primary key default gen_random_uuid(),
  message     text,
  page        text,
  url         text,
  user_id     uuid,
  user_agent  text,
  stack       text,
  created_at  timestamptz not null default now()
);

-- Handy index for the weekly 7-day lookback.
create index if not exists client_errors_created_at_idx on client_errors (created_at desc);

-- No policies → no anon/authenticated access. Writes come only from the
-- service role (via /api/save-session), which bypasses RLS.
alter table client_errors enable row level security;
