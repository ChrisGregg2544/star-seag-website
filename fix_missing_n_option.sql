-- fix_missing_n_option.sql
-- Generated 2026-04-12
-- Adds "N": "No mistakes" to the options JSONB for all punctuation and spelling
-- questions that are missing the N key.
-- Apply in Supabase SQL Editor.

UPDATE questions
SET options = options || '{"N": "No mistakes"}'::jsonb
WHERE topic IN ('punctuation', 'spelling')
  AND validated = true
  AND (options -> 'N') IS NULL;
