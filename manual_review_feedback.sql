-- ============================================================
-- manual_review_feedback.sql
-- Insert validator_feedback rows for manual review decisions.
-- Teaches the AI validator from human overrides.
-- Run in Supabase SQL Editor AFTER manual_review_fixes.sql.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- SECTION 1: Sequences topic fix (FAIL → PASS)
-- ────────────────────────────────────────────────────────────

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('9ac1cffb-d551-4cfe-9eaf-a1965c46aecd', 'FAIL', ARRAY['wrong_topic'], 'PASS', 'Geometric/exponential sequences should be tagged topic=''sequences'' not ''algebra'''),
  ('b9b4e997-3a7d-4626-8d9d-253b149be1ef', 'FAIL', ARRAY['wrong_topic'], 'PASS', 'Geometric/exponential sequences should be tagged topic=''sequences'' not ''algebra'''),
  ('4da23e37-b8a0-43cd-b417-f9b899367591', 'FAIL', ARRAY['wrong_topic'], 'PASS', 'Geometric/exponential sequences should be tagged topic=''sequences'' not ''algebra'''),
  ('029ae473-c78a-48bb-81b0-2101227d6127', 'FAIL', ARRAY['wrong_topic'], 'PASS', 'Geometric/exponential sequences should be tagged topic=''sequences'' not ''algebra'''),
  ('c168dd62-d41d-43f0-8bfe-f4e8117482d6', 'FAIL', ARRAY['wrong_topic'], 'PASS', 'Geometric/exponential sequences should be tagged topic=''sequences'' not ''algebra''');


-- ────────────────────────────────────────────────────────────
-- SECTION 2: False positives (FAIL → PASS)
-- ────────────────────────────────────────────────────────────

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('959f1ffa-4b22-46b4-985f-60adebb1c0f3', 'FAIL', ARRAY['wrong_explanation'], 'PASS', 'Validator too strict — question and answer are correct'),
  ('f17069f8-25c9-42b2-85c2-aacfdac852a2', 'FAIL', ARRAY['topic_mismatch'], 'PASS', 'Validator too strict — question and answer are correct'),
  ('681671a2-291f-43ec-b6b6-43d6c93a9dfb', 'FAIL', ARRAY['wrong_explanation'], 'PASS', 'Validator too strict — question and answer are correct'),
  ('94f04de2-2620-40a3-a061-c4b9cd60c2cb', 'FAIL', ARRAY['wrong_explanation'], 'PASS', 'Validator too strict — question and answer are correct'),
  ('4bfe19a4-d285-40c1-aa0c-b7d59a63eece', 'FAIL', ARRAY['difficulty_mismatch'], 'PASS', 'Validator too strict — question and answer are correct'),
  ('4ad68be8-8690-49fb-b364-97b0a9f5afa3', 'FAIL', ARRAY['wrong_answer'], 'PASS', 'Validator too strict — question and answer are correct');


-- ────────────────────────────────────────────────────────────
-- SECTION 3: Difficulty OK (FAIL → PASS)
-- ────────────────────────────────────────────────────────────

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('e51b9846-18cb-4177-996d-095611d7f7d6', 'FAIL', ARRAY['difficulty_mismatch'], 'PASS', 'Simple questions are valid for difficulty 1-2 range, do not flag as too easy'),
  ('bc28cc25-e444-42c0-b60c-1ab029775529', 'FAIL', ARRAY['difficulty_mismatch'], 'PASS', 'Simple questions are valid for difficulty 1-2 range, do not flag as too easy'),
  ('5e45a99c-a89d-4bc4-8fdd-d55e58c1b77f', 'FAIL', ARRAY['difficulty_mismatch'], 'PASS', 'Simple questions are valid for difficulty 1-2 range, do not flag as too easy'),
  ('61cdce36-19d4-43a9-9c8d-d3b6fdbf0495', 'FAIL', ARRAY['difficulty_mismatch'], 'PASS', 'Simple questions are valid for difficulty 1-2 range, do not flag as too easy'),
  ('fabc7d5c-8e01-4e85-beee-1ec8227f802b', 'FAIL', ARRAY['difficulty_mismatch'], 'PASS', 'Simple questions are valid for difficulty 1-2 range, do not flag as too easy');


-- ────────────────────────────────────────────────────────────
-- SECTION 4: Rejected — compound word answer wrong (FAIL kept)
-- ────────────────────────────────────────────────────────────

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('efd919cd-0960-48da-92c6-9706630d50a0', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('72c00276-942b-4e06-a79f-db74a0a78882', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('0b2769e8-b856-480b-875a-3ff819ddbb5b', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('c818f517-3970-47a0-8bd3-5bac9f5dd775', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('d027ecdb-1ff7-4831-a362-480d1bcf5247', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('7208e7f4-fb84-49f9-bb96-dae7bfa76fc7', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('630adddf-c90a-4550-ba51-c584c994401a', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('88764492-505f-45a9-ba8f-77f8d0de1897', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('b2ea4cc4-c995-41d2-b601-15b530a02cd1', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word'),
  ('8aee357f-06fd-4484-badc-bf2c9be0ed7b', 'FAIL', ARRAY['wrong_answer','wrong_explanation'], 'FAIL', 'Only reject compound word questions if the answer is genuinely not a compound word');


-- ────────────────────────────────────────────────────────────
-- SECTION 5: Rejected — passage mismatch (FAIL kept)
-- ────────────────────────────────────────────────────────────

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('a4952989-2841-499c-b4e4-67e636e808ea', 'FAIL', ARRAY['passage_mismatch'], 'FAIL', 'Reject if answer references text not found in the passage'),
  ('3a8ad661-b5d2-4d43-bc65-69f3d83c3849', 'FAIL', ARRAY['passage_mismatch'], 'FAIL', 'Reject if answer references text not found in the passage'),
  ('3a253bea-ee43-46f4-87cf-66b3834dc3c3', 'FAIL', ARRAY['passage_mismatch'], 'FAIL', 'Reject if answer references text not found in the passage'),
  ('b4245b58-9849-4cab-86e2-f82bd6c73ac6', 'FAIL', ARRAY['passage_mismatch'], 'FAIL', 'Reject if answer references text not found in the passage'),
  ('4d808a89-35b2-4be8-8db5-4e2c26679a1a', 'FAIL', ARRAY['missing_question_stem'], 'FAIL', 'Reject if answer references text not found in the passage');


-- ────────────────────────────────────────────────────────────
-- SECTION 6: Rejected — contradictory data / answer not in options (FAIL kept)
-- ────────────────────────────────────────────────────────────

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('83db6e91-843a-4894-afae-b50756031320', 'FAIL', ARRAY['answer_not_in_options'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('50521a24-5eba-470b-8df6-21aa04632e02', 'FAIL', ARRAY['contradictory_data'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('c8c4aabc-3370-4727-bfbf-82052e17891f', 'FAIL', ARRAY['contradictory_data'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('2f37b874-6a12-49ff-b608-93aa01434c3f', 'FAIL', ARRAY['answer_not_in_options'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('85e9b051-f19f-494b-94eb-7933bf7d684b', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('ab98550b-251a-472c-b19f-3458ab5e4b5b', 'FAIL', ARRAY['wrong_answer','answer_not_in_options'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('678ca46a-11f5-434e-a4cb-c7dc93f97c4e', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('c4caa9d5-fd00-4f47-bd67-eb2e1cc1942d', 'FAIL', ARRAY['answer_not_in_options'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('30f4bdcb-4b67-4f8a-a71c-f16d7bdf99f7', 'FAIL', ARRAY['multiple_correct_answers'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('898f2b87-ec65-4675-a3b2-562d85177847', 'FAIL', ARRAY['wrong_answer','wrong_explanation'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options');


-- ────────────────────────────────────────────────────────────
-- SECTION 7: Rejected — wrong answer key (FAIL kept)
-- ────────────────────────────────────────────────────────────

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('ce4b1e46-e478-4c17-bff4-fb350f3aab8d', 'FAIL', ARRAY['wrong_explanation'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('180a1342-b258-47fe-8ba3-363fc3decb7b', 'FAIL', ARRAY['wrong_explanation'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('d745480d-8738-4122-9069-e47f77edc0d5', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('ceb49471-0a51-485e-b219-97daaae563ca', 'FAIL', ARRAY['wrong_answer','wrong_explanation'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('d4c0c6fc-2278-451c-90e2-0f9636dae554', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('c119d87d-39a1-4fff-a50d-8f3248fe86a2', 'FAIL', ARRAY['wrong_explanation'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer');


-- ────────────────────────────────────────────────────────────
-- SECTION 8: Rejected — other structural/content problems (FAIL kept)
-- ────────────────────────────────────────────────────────────

INSERT INTO validator_feedback (question_id, original_result, original_flags, your_decision, reason) VALUES
  ('e08a5914-a060-466b-ad6f-b8cc873a1a5d', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Reject if answer references text not found in the passage'),
  ('ac773207-1468-4490-b1ef-d3f16328fa2f', 'FAIL', ARRAY['ambiguous_question'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('0fdc55d8-de5d-46aa-998b-44d93a68a475', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('6509f2e8-390f-49ba-97e1-fb84d2332db9', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('51f1263e-6e7e-4824-91bd-b769c26987b6', 'FAIL', ARRAY['ambiguous_question'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options'),
  ('8cfebd09-382d-4e04-871a-a0b700e7ed64', 'FAIL', ARRAY['typo_in_question'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('ed2d9fe2-2e0c-4d87-bfe2-bd7a5168385a', 'FAIL', ARRAY['difficulty_mismatch'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('0bca5274-4720-490b-bf9b-0ca08d5853ef', 'FAIL', ARRAY['difficulty_mismatch'], 'FAIL', 'Reject if correct_answer field does not match the calculated answer'),
  ('880e86fb-fb56-44f3-bcc2-0b3661172133', 'FAIL', ARRAY['wrong_answer'], 'FAIL', 'Reject if answer references text not found in the passage'),
  ('d1cd5637-0d71-4d2d-913d-2fc1d81d9c87', 'FAIL', ARRAY['ambiguous_question','wrong_explanation'], 'FAIL', 'Reject if question data is internally inconsistent or answer not in options');
