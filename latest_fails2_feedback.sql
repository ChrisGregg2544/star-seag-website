INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason)
VALUES
  (
    'b354c737-f5c5-4cf5-b965-d6d781045c5b',
    'FAIL',
    ARRAY['WRONG_ANSWER'],
    'FAIL',
    'Correct answer "pollen sacs" is not a compound word — it is two separate words. Question is factually flawed and should be rejected.'
  ),
  (
    '661504e4-7bf3-4d36-80fa-01fc94b1a04a',
    'FAIL',
    ARRAY['WRONG_ANSWER'],
    'FAIL',
    'Correct answer "winter" is not a compound word. Explanation mentions "inside" as the real compound word but marks "winter" as correct. Internally contradictory — reject.'
  ),
  (
    '619e9725-adf8-4d32-813b-eb6aaa07d27a',
    'FAIL',
    ARRAY['WRONG_ANSWER'],
    'FAIL',
    '"Unshakeable" is a prefixed word (un + shakeable), not a compound word. Compound words join two independent words (e.g. sunflower, football). This is a linguistic error — reject.'
  ),
  (
    'a1b92580-7b1e-4076-9a17-1eea300f8e8e',
    'FAIL',
    ARRAY['DIFFICULTY'],
    'FAIL',
    'Second-difference sequence (quadratic) is beyond P6 SEAG standard. P6 algebra_sequences should only use simple arithmetic (constant difference) sequences. Reject and re-seed at appropriate level.'
  ),
  (
    '796fc93d-aaa3-4842-aaf3-879170793479',
    'FAIL',
    ARRAY['DIFFICULTY'],
    'FAIL',
    'nth term formula (5n + 2) is a P7/GCSE concept, not appropriate for P6. SEAG P6 sequences should involve spotting patterns, not substituting into algebraic formulae. Reject.'
  ),
  (
    'edc5b42b-cbd0-4a80-bc81-ec53ffb2a37f',
    'FAIL',
    ARRAY['DIFFICULTY'],
    'FAIL',
    'Geometric (multiply-by-3) sequence is too advanced for P6. P6 sequences should use addition/subtraction patterns only. Reject.'
  ),
  (
    '3dd1f2cd-fac1-423e-ae20-48d63027d9b9',
    'FAIL',
    ARRAY['WRONG_ANSWER', 'EXPLANATION_ERROR'],
    'FAIL',
    'Explanation calculates 216 − 125 = 91, giving answer A, but marked answer is D (111). The explanation contradicts the correct_answer field. Calculation confirms answer is A (91). Reject — wrong correct_answer stored.'
  ),
  (
    '42af7aed-16f3-438c-b84d-7ba0b3a0f172',
    'FAIL',
    ARRAY['WRONG_ANSWER', 'EXPLANATION_ERROR'],
    'FAIL',
    'Explanation solves correctly (n = 17, answer A) but correct_answer field says D (23). The stored correct_answer is wrong. Reject — correct_answer field does not match the working shown.'
  ),
  (
    '059c4c18-308c-40bf-88ae-8c611585d083',
    'FAIL',
    ARRAY['WRONG_ANSWER', 'CALCULATION_ERROR'],
    'FAIL',
    'North section = 284 × 47 = 13,348. South = 6,674. East = 3,726. Total = 23,748. No answer option matches 23,748 — the question itself is broken. Reject and re-seed with corrected figures.'
  ),
  (
    '191d9000-0157-4625-9602-9189efd57997',
    'FAIL',
    ARRAY['WRONG_ANSWER', 'CALCULATION_ERROR'],
    'FAIL',
    '348 × 5 × 26 × 12 = 45,240 × 12 = £542,880, which is option A. Correct answer field says C (£543,360) but working clearly gives A. Reject — stored correct_answer is wrong.'
  );
