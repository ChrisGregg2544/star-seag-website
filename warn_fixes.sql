-- warn_fixes.sql
-- Generated 2026-04-11 from warn_questions.json
-- Apply in Supabase SQL Editor

-- ── APPROVE ──────────────────────────────────────────────────────────────────
-- Arithmetic diff:5 (valid P7 top-end difficulty)
-- Punctuation with two errors (primary error is correct answer)

UPDATE questions
SET validated = true,
    validator_verdict = 'pass'
WHERE id IN (
  '5105f0e6-6da7-41ff-b57d-aca70978d059',  -- arithmetic P7: train 216+347+189 km
  'a4e96440-5aad-49d8-a3d2-fa6599a49c6e',  -- arithmetic P7: lorry diesel cost
  '51bba24c-eb90-441b-b39f-f5c3343884d7',  -- punctuation P6: belfast/friday (two errors)
  '8be2d90d-c1fb-4fbe-a40d-6547c518ab9d',  -- arithmetic P7: train 264km × 32 days
  'bc22aeec-bc2d-43a9-b41b-ee675a42948e',  -- arithmetic P7: factory 364 widgets/hr
  '48aadd3f-e921-4344-a7cc-efdcf87e97be',  -- punctuation P6: belfast/tuesday (two errors)
  '1c83120d-5f27-4218-a324-344d3f69065f'   -- punctuation P7: hasnt/december (two errors)
);

-- ── REJECT ───────────────────────────────────────────────────────────────────
-- Vocabulary too advanced for P7
-- Duplicate answer options

UPDATE questions
SET source = 'rejected',
    validator_verdict = 'fail',
    validated = false
WHERE id IN (
  '0a4d72c6-c450-48ee-a39b-a764b8949636',  -- vocabulary P7: abstruse
  'b862b18f-e8c4-4444-800e-3b56ed0d01e1',  -- vocabulary P7: pellucid/distil
  '0f3857b4-d1bd-45e5-945b-3a2e8b43f3c7',  -- vocabulary P7: obfuscation
  '5ef2dc7a-7b9f-4c0e-92b9-c383e2159d2f'   -- arithmetic P7: options B and C identical
);
