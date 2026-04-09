-- ============================================================
-- fix_needed.sql
-- Auto-fixable issues from the validator's fix_needed list.
-- Run in Supabase SQL Editor.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1: FALSE POSITIVES
-- Validator flagged these but the answer and explanation are
-- already correct. Just mark as validated.
-- (14 questions)
-- ────────────────────────────────────────────────────────────

UPDATE questions
SET validated = true,
    validator_verdict = 'pass'
WHERE id IN (
  '7b53dcd3-7b86-4f52-b9ac-961361e18a3c', -- 2n²+1 at n=4: answer A=33 ✓
  'f6aaf48e-c8a5-424f-9e0c-914432193ed3', -- apple juice cheapest: answer A=£18.96 ✓, 6×£3.32=£19.92 is correct
  '14d6b878-4b7b-4fb2-82e4-04dac6a63297', -- 1/3 of 36 = 12: answer C ✓
  '3ad18507-96af-423f-8255-11757b6590ec', -- 35% off £84 = £54.60: answer C ✓
  '85a1a1e0-954c-4288-a956-287bbaabc680', -- P(red or yellow) = 6/8: answer C ✓
  'c382e4ab-0333-4abe-b965-a4c94fcde0ed', -- sequence 100-8-7-6…: 7th term = 58 = D ✓
  'd7b83894-5ac0-4c53-b4bd-5c5b5aeffa94', -- tally chart Thursday: 20/81 ≈ 25% = A ✓
  '6dd4d1ad-ff1c-4bc5-8761-63fbdaaef27c', -- 1/3 of 120 = 40: answer B ✓
  '073caad5-90cb-40b0-a05a-27abfa9d4e1a', -- March-Feb phones: 30-18=12 = D ✓
  '8f93b5e0-4ec8-41b9-b9a3-db63fa091268', -- 2/8 = 1/4: answer B ✓
  '0df3e659-8245-4612-8443-508b443ba8e1', -- algebraic expressions covered by algebra_sequences topic ✓
  '45ce9af9-bb2c-4fac-9df5-eb05f7a12d3c', -- 3n+7 at n=4: substitution is part of algebra ✓
  'e4006037-cda0-4564-a883-ecc4324e68e3', -- 2n+7 at n=5: substitution is part of algebra ✓
  '9ae2e764-90ae-437b-9c8d-7312ca49f80c'  -- 2p²+q-5 at p=3,q=7: substitution is part of algebra ✓
);


-- ────────────────────────────────────────────────────────────
-- SECTION 2: WRONG ANSWER KEY — correct_answer flips
-- Explanation already shows the right working; only the
-- correct_answer field is wrong.
-- (12 questions — each verified by manual calculation)
-- ────────────────────────────────────────────────────────────

-- Car pupils: 480 - 3/8×480(180) - 40%×480(192) = 108 = E
UPDATE questions
SET correct_answer = 'E',
    validated = true,
    validator_verdict = 'pass'
WHERE id = '6f772cc2-bbc7-4404-80d4-c9f5e63660a8';

-- Fencing: 2×(12.5+8)×£6 = 41×6 = £246 = B
UPDATE questions
SET correct_answer = 'B',
    validated = true,
    validator_verdict = 'pass'
WHERE id = '8f566524-52de-4d8f-a1df-2b8488490faf';

-- Baker flour: (34+28)×125 = 62×125 = 7,750g = C
UPDATE questions
SET correct_answer = 'C',
    validated = true,
    validator_verdict = 'pass'
WHERE id = 'b8303a2f-9138-4f6e-8ede-28bc61b56c53';

-- Prize share: £414÷3=£138, £138-£57=£81 = D
UPDATE questions
SET correct_answer = 'D',
    validated = true,
    validator_verdict = 'pass'
WHERE id = '7a5493f8-c92e-4858-b38b-b1b78a8dda56';

-- School charity: £4,836÷12=£403, £403+£175=£578 = C
UPDATE questions
SET correct_answer = 'C',
    validated = true,
    validator_verdict = 'pass'
WHERE id = '585e8f36-6b50-4ca3-858d-8b581d981b4e';

-- Train total: 476+389+(476×3) = 476+389+1428 = 2293 = D
UPDATE questions
SET correct_answer = 'D',
    validated = true,
    validator_verdict = 'pass'
WHERE id = '994f5678-dc89-46f5-bae1-6ed9775712bb';

-- Closest to 0.72: 13/18≈0.7222 (diff 0.0022) = E
UPDATE questions
SET correct_answer = 'E',
    validated = true,
    validator_verdict = 'pass'
WHERE id = 'a7a93b77-bc4b-4107-9be3-80555fa5ab75';

-- Cuboid surface area: 2(8×5+8×4+5×4)=2×92=184cm² = B
UPDATE questions
SET correct_answer = 'B',
    validated = true,
    validator_verdict = 'pass'
WHERE id = 'a3c56e6f-0a46-4d64-bc6c-50fc51605b2e';

-- Compound shape: 10×6 + ½×6×4 = 60+12 = 72cm² = B
UPDATE questions
SET correct_answer = 'B',
    validated = true,
    validator_verdict = 'pass'
WHERE id = 'e4917d88-4c48-47be-89b6-3a84f9df85be';

-- Cube edges: ∛216=6, 12×6=72cm = E
UPDATE questions
SET correct_answer = 'E',
    validated = true,
    validator_verdict = 'pass'
WHERE id = '889d4c6a-3d1e-4e88-9b7d-c4fff770f6ea';

-- Function machine output=28: 28÷2=14, 14-6=8 = D (explanation had wrong output 26)
UPDATE questions
SET correct_answer = 'D',
    explanation = 'Work backwards from output 28: divide by 2 to get 14, then subtract 6 to get 8. Check: input 8 + 6 = 14, 14 × 2 = 28. ✓',
    validated = true,
    validator_verdict = 'pass'
WHERE id = '1ef79702-1072-44ce-bcbe-eb34d249aca1';

-- 14:35 in 12-hour: 14-12=2, so 2:35 pm = B
UPDATE questions
SET correct_answer = 'B',
    validated = true,
    validator_verdict = 'pass'
WHERE id = 'c80bd1b8-f2fe-4723-b167-c3bae6cd1e77';

-- Median of [150,160,175,185,195,205]: (175+185)÷2=180 = B
UPDATE questions
SET correct_answer = 'B',
    validated = true,
    validator_verdict = 'pass'
WHERE id = '954c240c-5cf6-4601-999f-359f90cd2373';


-- ────────────────────────────────────────────────────────────
-- SECTION 3: WRONG TOPIC TAG — reclassify to arithmetic
-- Question content and answer are correct; topic was mislabelled.
-- (9 questions)
-- ────────────────────────────────────────────────────────────

UPDATE questions
SET topic = 'arithmetic',
    validated = true,
    validator_verdict = 'pass'
WHERE id IN (
  'ff167933-7586-49d5-9acd-9fb841ccc7e3', -- "multiply by 3" — simple arithmetic, not algebra
  '6655b322-6260-49e4-97b4-7e2fb4f9162f', -- "cost of 8 apples" — arithmetic, not measurement
  '6b24b0d6-8c51-47b3-9b06-1fe27a85a52e', -- "change from £30" — arithmetic, not measurement
  '228e9d32-0b90-4a84-aac3-2bd8791574be', -- "multiply input by 3" — arithmetic, not algebra
  '3c6031c6-807a-46ee-9fb4-c787a18f992a', -- "add 3 then ×2" function machine — arithmetic
  'ad00bd80-e8c5-46cb-aa9a-c813c681b3a4', -- "total cost of 3 items" — arithmetic, not measurement
  '698d974c-741f-4801-83ce-46db33ea11e5', -- "£7.35 - £2.48" — arithmetic, not fractions
  '54f7f329-d475-477c-bb15-618d94bad7f3', -- "change from £15" — arithmetic, not measurement
  '07e899e2-5f2c-4caf-a158-54e55771d1dd'  -- "change from £24.50" — arithmetic, not measurement
);


-- ────────────────────────────────────────────────────────────
-- SECTION 4: CANNOT AUTO-FIX — left as FAIL for human review
-- These questions have structural problems (no correct option
-- in the list, contradictory data, ambiguous wording).
-- Do not update these here; delete and reseed instead.
-- ────────────────────────────────────────────────────────────

-- '72360f65' — ordering fractions: correct order not present in any option
-- '5db67418' — charity leftover: answer is £130 but £130 not in options A-E
-- '0de2154f' — pizza fractions: 3/8+0.35+30% = 1.025, exceeds whole pizza
-- '4ac7cb32' — sequence "start at 4, add n+1": ambiguous rule, no option matches
-- 'b7160227' — sequence "add 2, add 4, add 6": 5th term=23 not in options
-- '4bed41cf' — pie chart leisure: 27% of 320=86.4, not in options
-- 'b2b9f3fb' — two sequences equal 47: second sequence never reaches 47
-- 'cb6cec96' — substitution a=3,b=5: 2a+3b-4=17, not in options A-E
-- '4c09dbfb' — substitution p=2,q=5: 4p+2q-3=15, not in options A-E
-- '106c4d03' — pictogram: question states Friday=8 symbols, explanation uses 6
