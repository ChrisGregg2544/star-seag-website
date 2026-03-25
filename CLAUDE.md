# STAR AI Tutor — Project Briefing for Claude Code

## SEAG Reference Papers
Official SEAG practice papers are in the root of the repo.
Read these to understand the exact exam format before building any question-related features.
The Specification.pdf and The_Format.pdf are the most important.

## What this is
An AI-powered tutoring platform for Northern Ireland P6/P7 students 
preparing for the SEAG Transfer Test (grammar school entrance exam, November).
Live at: star-seag-website.vercel.app

## Tech stack
- Plain HTML/CSS/JS — no framework
- Hosted on Vercel (Hobby plan — 10 second function timeout)
- Anthropic API (claude-sonnet-4-6) for question generation
- Supabase for auth and database
- Stripe for payments

## Current Supabase credentials
URL: https://iutcgogmxhaqgaxkznxu.supabase.co
(anon key is in every HTML file already)

## Pricing
- Standard: £14.99/month
- Premium: £24.99/month (not yet built)
- 7-day free trial

## What's already built
- Mini Sprint (study.html) — 10 questions, instant feedback
- Topic Sprint (topic-sprint.html)
- Full Coached Mock (mock.html) — 10 practice + 28 English + 28 Maths
- Smart Onboarding (onboarding.html)
- Onboarding Tour overlay (tour.js, wired into dashboard.html)
- Dashboard (dashboard.html) — score ring, skills map, topics to review
- Parent Portal (parent.html) — PIN gated, localStorage based
- Login/Signup (login.html, signup.html)
- Pricing page (pricing.html)
- Stripe payments — create-checkout.js, stripe-webhook.js
- Question generator API (api/generate-questions.js)

## SEAG exam format (critical — matches real papers)
Each paper has 3 sections:
1. Practice Test — 5 English + 5 Maths warm-up, NOT marked
2. English Main Test — 28 questions:
   - Q1-5: Punctuation (segments A/B/C/D, answer A/B/C/D/N)
   - Q6-10: Grammar (sentence with _____ gap, 5 word options A-E)
   - Q11-15: Spelling (segments A/B/C/D, answer A/B/C/D/N)
   - Q16-22: Comprehension multiple choice A/B/C/D/E
   - Q23-28: Comprehension free response (written answers)
3. Maths Main Test — 28 questions:
   - Q29-50: Multiple choice A/B/C/D/E
   - Q51-56: Free response (written answers)
Students can choose to start with English or Maths.
Total time: 60 minutes for the 56 main test questions.

## Key API modes (generate-questions.js)
- mini_sprint — 10 mixed questions
- topic_sprint — 10 questions on one topic
- mock_practice — 10 warm-up questions
- mock_english — 28 English questions (exact SEAG format above)
- mock_maths — 28 Maths questions

## Critical rules for question generation
- Punctuation/Spelling: 5th option ALWAYS "N. No mistake" never "E. No mistake"
- Answer for no-mistake: ALWAYS "N" never "E"
- All 4 server-side validation layers must stay in generate-questions.js
- UK English spelling only
- No comma-placement errors in punctuation questions
- Correct maths answer MUST appear in the A/B/C/D/E options

## Vercel timeout workaround
Hobby plan = 10 second timeout. mock.html uses background pre-fetch:
- Practice questions fetched first (fast)
- English + Maths kicked off as background promises immediately
- Awaited at section transitions (student takes 10-20 mins per section)
- DO NOT change this pattern — it's the workaround for the timeout

## Database tables (Supabase)
- profiles — user profile, onboarding data, subscription status
- sessions — completed sprint/mock sessions
- question_results — per-question results for each session
- progress_summary — latest score summary per user

## Profiles table columns needed
id, parent_email, name, year_group, sessions_per_week, exam_year,
onboarded (boolean), onboarding_tour_complete (boolean),
subscription_status, subject (default 'SEAG'), updated_at

## What needs building next (Phase 1 remaining)
See build plan below.

## What NOT to do
- Do not use localStorage for important data — use Supabase
- Do not change the background pre-fetch pattern in mock.html
- Do not remove the 4 validation layers from generate-questions.js
- Do not build Stage 2 features before Stage 1 is complete
- Do not add complexity that isn't needed yet

- ## What needs building next (Phase 1)
1. Comprehension passage display in mock.html — when student reaches Q16, show the reading passage in a scrollable panel above the questions for Q16-28
2. Redesigned dashboard — weekly schedule cards, sessions completed this week vs target, today's recommended session as main CTA
3. Parent section — migrate from localStorage to Supabase so data persists properly
4. End-to-end flow audit — test full signup → onboarding → sprint → dashboard flow with a fresh account and fix anything broken

## What NOT to build yet (Stage 2)
STAR Chat, Premium tier, Real Life Test printable papers, Progress Report, AI Study Strategy Engine.
Do not start these until Stage 1 is fully working and tested.
