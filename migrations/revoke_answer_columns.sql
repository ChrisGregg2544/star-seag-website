-- ═══════════════════════════════════════════════════════════════════════════
-- A2 Part 2c — hide correct_answer and explanation from the browser.
--
-- Run this in the Supabase SQL editor ONLY AFTER the 2b deploy is verified
-- (study.html, mock.html, real-life-test.html, validate.html, review.html all
--  working). It removes column-level SELECT on correct_answer/explanation from
-- the anon and authenticated roles. Server endpoints use the service_role key,
-- which is unaffected, so answer-checking and the admin tools keep working.
--
-- RLS row policies are untouched — this is column-level only.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- Drop the blanket table-level SELECT...
REVOKE SELECT ON public.questions FROM anon, authenticated;

-- ...and grant it back on every column EXCEPT correct_answer and explanation.
GRANT SELECT (
  id, subject, topic, year_group, difficulty, question_type, question_text,
  options, validated, source, created_at, passage, times_used, passage_id,
  validator_verdict, validator_reason, diagram, v1_score, v1_reason,
  v4_score, v4_reason, combined_score, revalidated_at, active
) ON public.questions TO anon, authenticated;

COMMIT;

-- ── Verify (should list the granted columns, WITHOUT correct_answer/explanation) ──
-- select grantee, column_name
-- from information_schema.role_column_grants
-- where table_name = 'questions' and grantee in ('anon','authenticated')
-- order by grantee, column_name;

-- ── ROLLBACK (re-expose the columns) if anything regresses ──
-- GRANT SELECT ON public.questions TO anon, authenticated;
