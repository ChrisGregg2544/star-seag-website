-- latest_fails_feedback.sql
-- Generated 2026-04-11 from latest_fails.json
-- Apply in Supabase SQL Editor after latest_fails_reject.sql

-- ── Wrong answer key (explanation contradicts correct_answer) ─────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '02e245bf-d610-4de3-8bf5-08413b304e7b'::uuid,
  'fail',
  ARRAY['wrong_answer']::text[],
  'fail',
  'Reject if explanation contradicts the correct_answer field'
);

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  'b2e9c1d5-c233-4cea-8313-9990cfa8a2c8'::uuid,
  'fail',
  ARRAY['wrong_answer']::text[],
  'fail',
  'Reject if explanation contradicts the correct_answer field'
);

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '1bc58d33-0eb6-46a7-bd66-e4322e4af8dd'::uuid,
  'fail',
  ARRAY['wrong_answer']::text[],
  'fail',
  'Reject if explanation contradicts the correct_answer field'
);

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '6c9c0671-9a49-4f05-810c-0d23d4572c4d'::uuid,
  'fail',
  ARRAY['wrong_answer']::text[],
  'fail',
  'Reject if explanation contradicts the correct_answer field'
);

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '6ef11c2a-1249-420d-b506-f0144c27c974'::uuid,
  'fail',
  ARRAY['wrong_answer']::text[],
  'fail',
  'Reject if explanation contradicts the correct_answer field'
);

-- ── Answer not in options ─────────────────────────────────────────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '4204ce24-d15c-4e26-9ccf-3eeff128a0b0'::uuid,
  'fail',
  ARRAY['answer_not_in_options']::text[],
  'fail',
  'Reject if correct answer value does not appear in any of the A-E options'
);

-- ── Compound word wrong ───────────────────────────────────────────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  'b644bcb6-f17e-4aa1-a568-0fb6da71cf0f'::uuid,
  'fail',
  ARRAY['wrong_answer']::text[],
  'fail',
  'Reject compound word questions where the answer is not a genuine compound word'
);

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '11809be9-168a-4e50-902e-ada7c3ea359f'::uuid,
  'fail',
  ARRAY['wrong_answer']::text[],
  'fail',
  'Reject compound word questions where the answer is not a genuine compound word'
);

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  'ed33fab9-1b83-4749-b09d-5da45bf82802'::uuid,
  'fail',
  ARRAY['wrong_answer']::text[],
  'fail',
  'Reject compound word questions where the answer is not a genuine compound word'
);

-- ── Punctuation ambiguity (plural vs possessive) ──────────────────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '28b0fb71-04d4-4f0f-bcf5-67d3f962a73d'::uuid,
  'fail',
  ARRAY['ambiguous']::text[],
  'fail',
  'Reject punctuation questions where plural vs possessive is ambiguous'
);

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '93837dd0-a223-446b-8b19-aafc7ea66133'::uuid,
  'fail',
  ARRAY['ambiguous']::text[],
  'fail',
  'Reject punctuation questions where plural vs possessive is ambiguous'
);

-- ── Punctuation ambiguity (two capitalisation errors) ────────────────────────
INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES (
  '45169c86-2ab4-4a4b-896c-46d199e1de8d'::uuid,
  'fail',
  ARRAY['ambiguous']::text[],
  'fail',
  'Reject punctuation questions where the passage contains two capitalisation errors in different sections — creates ambiguity about which section is the correct answer'
);
