-- ============================================================
-- manual_review_fixes.sql
-- Human decisions on the 57 manual_review questions.
-- Run in Supabase SQL Editor.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1: APPROVE WITH TOPIC FIX → sequences
-- Geometric/exponential sequences were tagged as algebra.
-- Reclassify to 'sequences' and approve.
-- (5 questions)
-- ────────────────────────────────────────────────────────────

UPDATE questions
SET topic              = 'sequences',
    validated          = true,
    validator_verdict  = 'pass'
WHERE id IN (
  '9ac1cffb-d551-4cfe-9eaf-a1965c46aecd', -- sum of 6th+7th terms, ×2 geometric
  'b9b4e997-3a7d-4626-8d9d-253b149be1ef', -- 64,32,16,8,? halving sequence
  '4da23e37-b8a0-43cd-b417-f9b899367591', -- 2,4,8,16,?,64 doubling sequence
  '029ae473-c78a-48bb-81b0-2101227d6127', -- 3,6,12,24,48,? ×2 sequence
  'c168dd62-d41d-43f0-8bfe-f4e8117482d6'  -- 2,4,8,16,?,64 with rule explanation
);


-- ────────────────────────────────────────────────────────────
-- SECTION 2: APPROVE — FALSE POSITIVES
-- Validator flagged these but question, answer and explanation
-- are all correct. Approve as-is.
-- (6 questions)
-- ────────────────────────────────────────────────────────────

UPDATE questions
SET validated         = true,
    validator_verdict = 'pass'
WHERE id IN (
  '959f1ffa-4b22-46b4-985f-60adebb1c0f3', -- order fractions 1/8,1/4,1/2: explanation correct
  'f17069f8-25c9-42b2-85c2-aacfdac852a2', -- cuboid surface area 184cm²: correct formula
  '681671a2-291f-43ec-b6b6-43d6c93a9dfb', -- 'tiny' as adjective: correct POS
  '94f04de2-2620-40a3-a061-c4b9cd60c2cb', -- 'predators': definition adequate for P6
  '4bfe19a4-d285-40c1-aa0c-b7d59a63eece', -- 'prescient' passage: vocab question valid
  '4ad68be8-8690-49fb-b364-97b0a9f5afa3'  -- mean increase: answer D=3 acceptable rounding
);


-- ────────────────────────────────────────────────────────────
-- SECTION 3: APPROVE — DIFFICULTY OK
-- Validator flagged as too easy/hard but questions are valid
-- for difficulty bands 1–2 (easy) or 4–5 (hard).
-- (5 questions)
-- ────────────────────────────────────────────────────────────

UPDATE questions
SET validated         = true,
    validator_verdict = 'pass'
WHERE id IN (
  'e51b9846-18cb-4177-996d-095611d7f7d6', -- 7×2=14 function machine: valid difficulty 1
  'bc28cc25-e444-42c0-b60c-1ab029775529', -- 5×2=10 function machine: valid difficulty 1
  '5e45a99c-a89d-4bc4-8fdd-d55e58c1b77f', -- tally chart totals: valid difficulty 2
  '61cdce36-19d4-43a9-9c8d-d3b6fdbf0495', -- £3.45+£1.20: valid difficulty 1
  'fabc7d5c-8e01-4e85-beee-1ec8227f802b'  -- 7.68-3.24: valid difficulty 2
);


-- ────────────────────────────────────────────────────────────
-- SECTION 4: REJECT — STRUCTURAL / CONTENT PROBLEMS
-- Wrong answers, contradictory data, passage mismatches,
-- broken explanations, non-compound-word answers, etc.
-- (41 questions)
-- ────────────────────────────────────────────────────────────

UPDATE questions
SET validated         = false,
    validator_verdict = 'fail',
    source            = 'rejected'
WHERE id IN (
  -- Wrong answer / calculation errors
  'ce4b1e46-e478-4c17-bff4-fb350f3aab8d', -- reflex angle: explanation broken
  '180a1342-b258-47fe-8ba3-363fc3decb7b', -- 348+215: explanation working wrong
  'd745480d-8738-4122-9069-e47f77edc0d5', -- pencil 140mm: need to confirm option B
  'ceb49471-0a51-485e-b219-97daaae563ca', -- function machine: no whole-number solution
  '2f37b874-6a12-49ff-b608-93aa01434c3f', -- train 2293: correct answer not in options
  '85e9b051-f19f-494b-94eb-7933bf7d684b', -- function machine rule: answer A wrong
  'ab98550b-251a-472c-b19f-3458ab5e4b5b', -- bar chart %: 13/35≠25%, explanation admits error
  '678ca46a-11f5-434e-a4cb-c7dc93f97c4e', -- pie chart cars: blue=53.3 non-integer
  'd4c0c6fc-2278-451c-90e2-0f9636dae554', -- cinema totals: £10,927 not £11,097
  'c119d87d-39a1-4fff-a50d-8f3248fe86a2', -- sequence start 4: explanation starts at 7
  '30f4bdcb-4b67-4f8a-a71c-f16d7bdf99f7', -- p=5 expression: multiple options equal 35
  '898f2b87-ec65-4675-a3b2-562d85177847', -- pie chart %: rewrites data to fit answer
  'c4caa9d5-fd00-4f47-bd67-eb2e1cc1942d', -- toy cars: 2149 boxes not in options

  -- Contradictory / impossible data
  '83db6e91-843a-4894-afae-b50756031320', -- path area: 66m² not in options
  '50521a24-5eba-470b-8df6-21aa04632e02', -- Venn diagram: 34 > 28 surveyed
  'c8c4aabc-3370-4727-bfbf-82052e17891f', -- pie chart: salad gives total=81 not 240

  -- Passage mismatch (answer references content not in passage)
  'a4952989-2841-499c-b4e4-67e636e808ea', -- 'vital' not in passage
  '3a8ad661-b5d2-4d43-bc65-69f3d83c3849', -- 'well-oiled machine' not in passage
  '3a253bea-ee43-46f4-87cf-66b3834dc3c3', -- 'reproduce' not in passage
  'b4245b58-9849-4cab-86e2-f82bd6c73ac6', -- question wording doesn't match passage
  '4d808a89-35b2-4be8-8db5-4e2c26679a1a', -- no question in question field, just passage

  -- English: wrong or misleading answers/explanations
  'e08a5914-a060-466b-ad6f-b8cc873a1a5d', -- 'recieving' misspelled but outside underlined options
  'ac773207-1468-4490-b1ef-d3f16328fa2f', -- bimodal data: 10 and 11 both appear 3× — ambiguous
  '0fdc55d8-de5d-46aa-998b-44d93a68a475', -- 'truly vital' is not alliteration
  '6509f2e8-390f-49ba-97e1-fb84d2332db9', -- 'scour' is personification not metaphor
  '51f1263e-6e7e-4824-91bd-b769c26987b6', -- question asks combined but explanation conflates

  -- Compound word questions with wrong answers
  'efd919cd-0960-48da-92c6-9706630d50a0', -- 'wetland' answer valid but 'hardworking' clearer
  '72c00276-942b-4e06-a79f-db74a0a78882', -- phrase answer incomplete
  '0b2769e8-b856-480b-875a-3ff819ddbb5b', -- 'thunderclap' vs beaver's home compound word
  'c818f517-3970-47a0-8bd3-5bac9f5dd775', -- answer incomplete
  'd027ecdb-1ff7-4831-a362-480d1bcf5247', -- 'trunks' not a compound word
  '7208e7f4-fb84-49f9-bb96-dae7bfa76fc7', -- 'staircase' not a compound word
  '630adddf-c90a-4550-ba51-c584c994401a', -- 'surroundings' not a compound word
  '88764492-505f-45a9-ba8f-77f8d0de1897', -- 'streamlined' not a compound word
  'b2ea4cc4-c995-41d2-b601-15b530a02cd1', -- 'unshakeable' = prefix+word not compound
  '8aee357f-06fd-4484-badc-bf2c9be0ed7b', -- compound word explanation confused and wrong

  -- Difficulty/topic mismatch beyond acceptable range
  '8cfebd09-382d-4e04-871a-a0b700e7ed64', -- typo in question stem ('rst 321')
  'ed2d9fe2-2e0c-4d87-bfe2-bd7a5168385a', -- supermarket till totals: difficulty too high P6
  '0bca5274-4720-490b-bf9b-0ca08d5853ef', -- £9.54÷3: difficulty fine but validator flagged
  '880e86fb-fb56-44f3-bcc2-0b3661172133', -- answer doesn't demonstrate bees helping plants
  'd1cd5637-0d71-4d2d-913d-2fc1d81d9c87'  -- question says two operations, sequence has one
);
