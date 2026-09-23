-- Add a `topic` column to sessions so topic sprints record WHICH topic was
-- practised. Previously only `track` (the year group) was stored, so a failed
-- topic sprint could not be traced to a topic after the fact.
--
-- Safe to run anytime. api/save-session.js writes `topic` on every save and
-- self-heals (retries without it) if this column is absent, so running this
-- migration simply switches topic recording on — nothing breaks either way.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS topic text;
