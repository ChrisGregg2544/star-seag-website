-- latest_fails2_reject.sql
-- Marks all 10 fail-verdict questions as rejected
-- Run in Supabase SQL Editor

UPDATE questions
SET source = 'rejected', validated = false
WHERE id IN (
  'b354c737-f5c5-4cf5-b965-d6d781045c5b',  -- comprehension_written P6: pollen sacs not compound word
  '661504e4-7bf3-4d36-80fa-01fc94b1a04a',  -- comprehension_written P6: winter not compound word
  '619e9725-adf8-4d32-813b-eb6aaa07d27a',  -- comprehension_written P7: unshakeable is prefix+word
  'a1b92580-7b1e-4076-9a17-1eea300f8e8e',  -- algebra_sequences P6: too difficult
  '796fc93d-aaa3-4842-aaf3-879170793479',  -- algebra_sequences P6: nth term too difficult
  'edc5b42b-cbd0-4a80-bc81-ec53ffb2a37f',  -- algebra_sequences P6: geometric sequence too difficult
  '3dd1f2cd-fac1-423e-ae20-48d63027d9b9',  -- algebra_sequences P7: contradictory explanation
  '42af7aed-16f3-438c-b84d-7ba0b3a0f172',  -- algebra_sequences P7: explanation contradicts correct answer
  '059c4c18-308c-40bf-88ae-8c611585d083',  -- arithmetic P7: calculation error
  '191d9000-0157-4625-9602-9189efd57997'   -- arithmetic P7: correct answer is A not C
);
