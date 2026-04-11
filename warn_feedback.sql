-- warn_feedback.sql
-- Generated 2026-04-11 from warn_questions.json
-- Apply in Supabase SQL Editor after warn_fixes.sql

-- ── Approved: arithmetic diff:5 ──────────────────────────────────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('5105f0e6-6da7-41ff-b57d-aca70978d059', 'WARN', ARRAY['difficulty'], 'PASS', 'Difficulty 5/5 arithmetic is valid for P7 top end, do not flag as too hard'),
  ('a4e96440-5aad-49d8-a3d2-fa6599a49c6e', 'WARN', ARRAY['difficulty'], 'PASS', 'Difficulty 5/5 arithmetic is valid for P7 top end, do not flag as too hard'),
  ('8be2d90d-c1fb-4fbe-a40d-6547c518ab9d', 'WARN', ARRAY['difficulty'], 'PASS', 'Difficulty 5/5 arithmetic is valid for P7 top end, do not flag as too hard'),
  ('bc22aeec-bc2d-43a9-b41b-ee675a42948e', 'WARN', ARRAY['difficulty'], 'PASS', 'Difficulty 5/5 arithmetic is valid for P7 top end, do not flag as too hard');

-- ── Approved: punctuation with two errors ────────────────────────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('51bba24c-eb90-441b-b39f-f5c3343884d7', 'WARN', ARRAY['multiple_errors'], 'PASS', 'Two errors in same question is acceptable SEAG format, one error is the primary answer'),
  ('48aadd3f-e921-4344-a7cc-efdcf87e97be', 'WARN', ARRAY['multiple_errors'], 'PASS', 'Two errors in same question is acceptable SEAG format, one error is the primary answer'),
  ('1c83120d-5f27-4218-a324-344d3f69065f', 'WARN', ARRAY['multiple_errors'], 'PASS', 'Two errors in same question is acceptable SEAG format, one error is the primary answer');

-- ── Rejected: vocabulary too advanced ────────────────────────────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('0a4d72c6-c450-48ee-a39b-a764b8949636', 'WARN', ARRAY['difficulty', 'vocabulary'], 'FAIL', 'Reject vocabulary questions using words too advanced for P7 (abstruse, obfuscation)'),
  ('b862b18f-e8c4-4444-800e-3b56ed0d01e1', 'WARN', ARRAY['difficulty', 'vocabulary'], 'FAIL', 'Reject vocabulary questions using words too advanced for P7 (abstruse, obfuscation)'),
  ('0f3857b4-d1bd-45e5-945b-3a2e8b43f3c7', 'WARN', ARRAY['difficulty', 'vocabulary'], 'FAIL', 'Reject vocabulary questions using words too advanced for P7 (abstruse, obfuscation)');

-- ── Rejected: duplicate answer options ───────────────────────────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('5ef2dc7a-7b9f-4c0e-92b9-c383e2159d2f', 'WARN', ARRAY['duplicate_options'], 'FAIL', 'Reject any question with identical answer options');
