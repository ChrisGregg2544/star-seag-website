-- latest_fails_reject.sql
-- Generated 2026-04-11 from latest_fails.json
-- Apply in Supabase SQL Editor

UPDATE questions
SET source = 'rejected',
    validator_verdict = 'fail',
    validated = false
WHERE id IN (
  'b644bcb6-f17e-4aa1-a568-0fb6da71cf0f',  -- comprehension_written P6: compound word (honeybees)
  '02e245bf-d610-4de3-8bf5-08413b304e7b',  -- arithmetic P7: wrong answer key (should be B)
  'b2e9c1d5-c233-4cea-8313-9990cfa8a2c8',  -- measurement P7: wrong answer key (should be A)
  '1bc58d33-0eb6-46a7-bd66-e4322e4af8dd',  -- measurement P7: wrong answer key (should be E)
  '6c9c0671-9a49-4f05-810c-0d23d4572c4d',  -- measurement P7: wrong answer key (should be C)
  '11809be9-168a-4e50-902e-ada7c3ea359f',  -- comprehension_written P6: compound word (winter months)
  'ed33fab9-1b83-4749-b09d-5da45bf82802',  -- comprehension_written P7: compound word (unshakeable)
  '45169c86-2ab4-4a4b-896c-46d199e1de8d',  -- punctuation P6: tuesday ambiguity
  '28b0fb71-04d4-4f0f-bcf5-67d3f962a73d',  -- punctuation P7: plural vs possessive (dolphins)
  '93837dd0-a223-446b-8b19-aafc7ea66133',  -- punctuation P7: plural vs possessive (teams)
  '4204ce24-d15c-4e26-9ccf-3eeff128a0b0',  -- arithmetic P7: answer not in options (£319.00)
  '6ef11c2a-1249-420d-b506-f0144c27c974'   -- measurement P7: explanation contradicts answer
);
