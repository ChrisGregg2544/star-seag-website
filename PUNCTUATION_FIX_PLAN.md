PUNCTUATION/SPELLING/GRAMMAR FIX - ACTION PLAN

## RESTORATION COMPLETE (April 30, 2026)
Successfully restored after reference_questions table deletion:
✅ Re-extracted all 1,120 questions from 20 Catapult papers
✅ Segmented 311 English questions with A/B/C/D/N options
✅ Extracted 446 Maths MC questions with A/B/C/D/E options
✅ Verified 80% pass rate for punctuation and arithmetic
✅ Marked 1,362 old questions as inactive
✅ Frontend filtering by active status
Ready for bulk generation to build new question bank.
✅ PHASE 1 COMPLETE - 200 questions segmented with proper A/B/C/D/N options

PHASE 1: Fix Reference Questions (Foundation)
Task 1.1: Build script to add A/B/C/D segment markers to existing punctuation reference questions

Use Claude Sonnet to intelligently segment each question
Input: question_text from reference_questions WHERE category IN ('punctuation','spelling')
Output: proper options JSON with A/B/C/D segments + N
Save segmented questions back to reference_questions

Task 1.2: Review and verify segmented questions

Spot-check 10-15 segmented questions for accuracy
Adjust segmentation logic if needed
Re-run on full dataset once verified

Task 1.3: Verify reference data quality

Run SQL to confirm all punctuation/spelling questions have proper options
Check P6 vs P7 distribution (should be ~50 each)
Verify difficulty spread (mix of easy/medium/hard)


PHASE 2: Template-Based Generator
Task 2.1: Update generate-questions.js for template mode

When category = punctuation/spelling, switch to template mode
Fetch reference question as template
Prompt: "Create 5 variations of this question keeping the EXACT SAME error type and segment structure, only changing vocabulary"
Example: Template has missing comma in segment B → variations must have missing comma in segment B

Task 2.2: Add template validation rules

Each variation must have same number of segments as template
Error must be in same segment position
Error type must match (missing comma vs apostrophe vs full stop etc.)
All other segments must be error-free


PHASE 3: Specialist Punctuation Validator
Task 3.1: Create 4th validator (Sonnet-powered)

/api/question-builder.js → add validatePunctuation() function
Uses claude-sonnet-4-6 (smarter, more expensive)
Only runs on punctuation/spelling categories
Deep checks:

Exactly ONE error in stated segment?
Error type matches claim?
All other segments error-free?
Unambiguous for P6/P7 level?



Task 3.2: Update run-validators routing

If category = punctuation/spelling:

Run Validator 1 (Accuracy) - Haiku
Run Validator 4 (Punctuation Specialist) - Sonnet
Skip Validator 2 (Difficulty) and 3 (Quality) - not relevant for format questions


Scoring: Both must score 7+ for PASS

Task 3.3: Update validation_results table

Add v4_score, v4_reason, v4_verdict columns
Update save logic to store 4th validator results


PHASE 4: Learning Loop Enhancement
Task 4.1: Template library growth

Passing variations become new templates
After each batch, add high-scoring questions to template pool
Track template usage (avoid over-using same template)

Task 4.2: Error pattern tracking

Log which error types pass/fail most often
Adjust template selection to favor reliable patterns
Flag problematic error types for manual review


PHASE 5: Quality Control
Task 5.1: Manual review workflow

Build simple review page for REWRITE/FAIL questions
Quick approve/reject/edit interface
Approved questions get added to template library

Task 5.2: Metrics tracking

Pass rate per error type (missing comma, apostrophe, etc.)
Pass rate per difficulty level
Pass rate over time (should improve with learning)


PHASE 6: Apply Same System to Spelling & Grammar
Task 6.1: Segment spelling reference questions (same as Task 1.1)
Task 6.2: Segment grammar reference questions (same as Task 1.1)
Task 6.3: Apply template-based generation to all 3 categories
Task 6.4: Specialist validator works for all 3 categories

SUCCESS CRITERIA

✅ 80%+ pass rate for punctuation P6/P7
✅ 80%+ pass rate for spelling P6/P7
✅ 80%+ pass rate for grammar P6/P7
✅ All questions have proper A/B/C/D/N options
✅ Format matches Catapult reference examples exactly
✅ System ready to transfer to GCSE English later


CURRENT STATUS

✅ Phase 1 COMPLETE - 200 punctuation/spelling reference questions segmented with A/B/C/D/N options
❌ Phase 2 not started
❌ Phase 3 not started
❌ Phase 4 not started
❌ Phase 5 not started
❌ Phase 6 not started

NEXT ACTION: Start Phase 2 - template-based generator