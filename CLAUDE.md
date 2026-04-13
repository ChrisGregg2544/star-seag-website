# STAR AI Tutor — CLAUDE.md Master Handover
Last updated: April 2026
Project: SEAG Transfer Test prep platform for Northern Ireland P6/P7 pupils (ages 10-11)
URL: https://star-seag-website.vercel.app
Repo: ChrisGregg2544/star-seag-website
Stack: Plain HTML/JS, Vercel serverless, Anthropic API, Supabase, Stripe

---

## CREDENTIALS & CONFIG
- Supabase URL: https://iutcgogmxhaqgaxkznxu.supabase.co
- Supabase anon key: in .env as SUPABASE_ANON_KEY
- Supabase service role key: in .env as SUPABASE_SERVICE_ROLE_KEY
- Anthropic API key: in .env as ANTHROPIC_API_KEY (model: claude-sonnet-4-20250514)
- GA4: G-JK4ZG1FSY7
- Support email: staraitutor.support@gmail.com
- Stripe keys: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET in Vercel dashboard
- Google OAuth Client ID: 1097186900806-6ldsruf3aeqo8ebvrqm9c5mgcselcpsr.apps.googleusercontent.com
- Supabase callback URL: https://iutcgogmxhaqgaxkznxu.supabase.co/auth/v1/callback
- Test accounts: andrewsandgregg@gmail.com, bigfishholidayhomes@gmail.com
- Facebook: https://www.facebook.com/share/1DGKfvGo9b/

CRITICAL: Never paste API keys in Claude Code chat — only in terminal with ! prefix.
Keys have been rotated multiple times due to accidental exposure.
Supabase JS CDN pinned to 2.39.3 — do not upgrade without testing.

---

## ARCHITECTURE

### Core Principle
All questions are pre-seeded in Supabase. There is NO live AI question 
generation during student sessions. This was a deliberate decision to 
eliminate Vercel 60s timeouts, Anthropic rate limits, and per-mock costs.

### Key Pattern: Server-Side Supabase Writes
Direct Supabase writes from the browser are blocked by RLS even with 
the anon key. ALL Supabase UPDATE/INSERT operations go through Vercel 
serverless functions:
- /api/update-verdict.js — updates validator_verdict, validated, source on questions table
- /api/save-feedback.js — inserts rows into validator_feedback table
Both use SUPABASE_SERVICE_KEY from Vercel env vars.

### Supabase JS Client in Browser
- Use anon key for all reads
- Never use service role key in browser (Supabase blocks it silently — returns 204 but writes nothing)
- All writes go through /api/ serverless functions

### AI Marking
Only written answer questions use live AI. /api/mark-written.js calls 
claude-haiku-4-5 (fast/cheap). MC questions use client-side matching.

---

## DATABASE SCHEMA

### questions table
```sql
id uuid primary key
subject text          -- 'english' or 'maths'
topic text            -- lowercase, see topics list below
year_group text       -- 'P6' or 'P7'
difficulty int        -- 1-5
question_type text    -- 'Multiple_Choice' or 'written'
question_text text
options jsonb         -- {"A":"...","B":"...","C":"...","D":"...","E":"..."} or null
                      -- punctuation/spelling use N not E as 5th key
correct_answer text   -- single letter A/B/C/D/E/N
explanation text
validated boolean     -- true = approved for student use
source text           -- 'ai_generated', 'catapult_test', 'rejected'
passage text          -- full sentence for punctuation; reading passage for comprehension
passage_id uuid       -- links to passages table for comprehension sets
diagram text          -- inline SVG string or null
times_used int        -- incremented when served to student
validator_verdict text -- 'pass', 'warn', 'fail', or null
validator_reason text
created_at timestamptz
```

### passages table
Comprehension passages. Each passage links to exactly 7 MC + 6 written questions.
20 passages total: 10 P6, 10 P7.

### validator_feedback table
Stores human review decisions to train future validator runs.
```sql
id uuid
question_id uuid
original_result text   -- AI's verdict: PASS/WARN/FAIL
original_flags text[]
your_decision text     -- human override: PASS/WARN/FAIL
reason text            -- human explanation (feeds back into validator prompt)
created_at timestamptz
```

### profiles table
User accounts. Key columns:
id, name, year_group, subscription_status, stripe_customer_id, 
stripe_subscription_id, trial_end, sessions_per_week, exam_year, 
onboarded, onboarding_tour_complete, free_sprints_used, study_phase,
weeks_to_exam, created_at, updated_at

### Other tables
- student_question_history — tracks questions seen per student
- sessions — completed mock/sprint sessions (session_type: 'full_mock' or 'topic_sprint')
- question_results — per-question results per session; includes question_id (uuid, references questions)
- progress_summary — latest score/topics per student

### RLS Policies (questions table)
- "Public can read validated questions" — SELECT WHERE validated=true
- "Anon can read all questions" — SELECT (unrestricted)
- "Anon can update validator fields" — UPDATE TO anon (for times_used)
- "Service role full access" — ALL
- GRANT UPDATE, INSERT on validator_feedback TO anon (applied)

---

## FILE INVENTORY

### Student-facing pages
| File | Purpose | Status |
|------|---------|--------|
| index.html | Landing page | ✅ Live |
| login.html | Auth — routes to onboarding or dashboard | ✅ Live |
| onboarding.html | 5-step new user setup | ✅ Live |
| dashboard.html | Student home — mock + study buttons | ✅ Live |
| mock.html | Full 56-question SEAG mock from DB | ✅ Live |
| study.html | Topic-based study mode from DB | ✅ Live |
| topic-sprint.html | Topic picker (redirects to study.html) | ✅ Live |
| pricing.html | Stripe paywall | ✅ Live |
| signup.html | Registration with Supabase auth | ✅ Live |
| parent.html | Parent portal | ⚠️ Incomplete |
| privacy.html | Privacy policy | ✅ Live |
| terms.html | Terms of service | ✅ Live |

### Admin/tooling pages (not linked from nav)
| File | Purpose |
|------|---------|
| validate.html | AI auto-validator for question bank |
| review.html | Manual review of WARN/FAIL questions |
| test-diagrams.html | Visual test for diagram-generator.js |

### Serverless functions (/api/)
| File | Purpose |
|------|---------|
| generate-questions.js | Legacy live generation — not used for mocks anymore |
| mark-written.js | AI marking for written answers (haiku) |
| update-verdict.js | Server-side question verdict update |
| save-feedback.js | Server-side validator feedback insert |
| create-checkout.js | Stripe checkout session |
| stripe-webhook.js | Stripe subscription status handler |

### Scripts (run locally, not deployed)
| File | Purpose |
|------|---------|
| seed-questions.js | Batch generate + insert questions to Supabase |
| reseed-diagrams.js | Regenerate SVG diagrams for existing questions |
| find-duplicates.js | Detects and removes duplicate questions from the validated bank. Run after every seed run. Use --delete flag to remove duplicates automatically. Compares: passage field for punctuation/spelling, question_text+passage_id for comprehension, first 80 chars of question_text for all other topics. |
| insert-catapult-test.mjs | Insert real Catapult Papers questions (validator training) |
| test-mock-assembly.mjs | Test full paper assembly without inserting |

### Key JS files
| File | Purpose |
|------|---------|
| diagram-generator.js | Generates inline SVG diagrams |
| cookie-consent.js | GDPR cookie consent (gates GA4) |
| tour.js | Onboarding overlay |

---

## MOCK PAPER FORMAT (56 questions)
| Section | Topic | Count | Notes |
|---------|-------|-------|-------|
| Q1–5 | Punctuation | 5 | Options A/B/C/D/N — find mistake in segment |
| Q6–10 | Grammar | 5 | Options A/B/C/D/E — choose best word |
| Q11–15 | Spelling | 5 | Options A/B/C/D/N — find misspelled word |
| Q16–22 | Comprehension MC | 7 | Same passage, options A/B/C/D/E |
| Q23–28 | Comprehension Written | 6 | Same passage, free text, AI marked |
| Q29–35 | Arithmetic | 7 | MC |
| Q36–42 | Geometry | 7 | MC, diagrams |
| Q43–48 | Fractions/Decimals | 6 | MC |
| Q49–52 | Measurement | 4 | MC |
| Q53–54 | Statistics | 2 | MC, diagrams |
| Q55–56 | Algebra/Sequences | 2 | MC |

Plus 10 practice questions before main paper (excluded from main pool).

CRITICAL: Punctuation/spelling use N (not E) as 5th option key.
This must be enforced at seed, validate, and display layers.

---

## DIAGRAM SYSTEM

### diagram-generator.js
generateDiagram(type, options) returns inline SVG string (280×180px).
Supported types: triangle, shape, angle, net, fraction-grid, bar-chart, 
line-graph, pictogram, number-line, measurement-scale, coordinate-grid,
cuboid, pie-chart

### Shape subtypes
- triangle: scalene, equilateral, isosceles, right-angled
- shape: rectangle, square, parallelogram, rhombus, trapezium, pentagon, hexagon, octagon
- angle: single, straight-line, around-point
- measurement-scale: ruler, thermometer, weighing-dial

### Measurement extraction
seed-questions.js uses extractMeasurements() and extractAngles() helpers 
to pull dimensions from question text and pass to generateDiagram().
reseed-diagrams.js regenerates SVGs for existing questions.

### Style
- Shape fill: #EEF4FF (blue tint)
- Shape stroke: #2563EB
- Labels/annotations: #DB2777 (pink)
- Purple accents: #7C3AED

---

## VALIDATOR SYSTEM

### validate.html
- Connects via form: Supabase URL + anon key + Anthropic API key
- Fetches unvalidated questions (validator_verdict IS NULL)
- Sends each question to Claude for PASS/WARN/FAIL verdict
- PASS → api/update-verdict (validated=true, verdict=pass)
- WARN → api/update-verdict (verdict=warn, stays unvalidated)
- FAIL → api/update-verdict (source=rejected, verdict=fail)
- Auto-run mode: 2 second delay between questions

### Validator feedback learning
- review.html captures human decisions + reasons → api/save-feedback
- validate.html fetches last 20 labelled feedback rows before each session
- Feedback injected into Claude prompt as few-shot examples
- This improves validator calibration over time

### review.html
- Shows all questions with validator_verdict = warn or fail
- Keyboard shortcuts: A (approve), R (reject), S (skip)
- Approve/reject calls api/update-verdict server-side
- Feedback form slides in after each decision (optional reason)

---

## CURRENT QUESTION BANK STATE (April 2026)
- Total validated: 1,156
- All topics healthy (35–79 per topic per year group)
- Catapult questions removed from DB and repo
- find-duplicates.js added as maintenance tool (run after every seed)
- Duplicate prevention prompts added to seed-questions.js

Topics covered: punctuation, grammar, spelling, vocabulary, 
comprehension_mc, comprehension_written, arithmetic, geometry,
fractions_decimals, measurement, statistics, algebra_sequences

---

## COMPLETED THIS SESSION (April 2026)

- ✅ Diagram measurements not showing — FIXED (extractMeasurements/extractAngles added to seed-questions.js, reseed-diagrams.js run against all 32 validated questions with diagrams)
- ✅ Cuboid diagram type — DONE (diagram-generator.js, isometric projection with dashed hidden edges, pink labels)
- ✅ Pie-chart diagram type — DONE (diagram-generator.js, proportional segments, % labels, legend)
- ✅ Validator auto-run — DONE (938 approved, 85 rejected, 0 pending)
- ✅ Manual WARN/FAIL review — DONE (all 131 FAILs processed: bulk_reject.sql, fix_needed.sql, manual_review_fixes.sql applied)
- ✅ Validator feedback system — DONE (see section below)

---

## VALIDATOR FEEDBACK SYSTEM (built April 2026)

- validator_feedback table created in Supabase (migration: 20260408000000_add_validator_feedback.sql)
- api/save-feedback.js — routes validator_feedback INSERT server-side (bypasses RLS)
- api/update-verdict.js — routes questions UPDATE server-side (bypasses RLS)
- review.html approve/reject now calls api/update-verdict (not direct Supabase)
- validate.html fetches last 20 labelled feedback rows and injects into Claude prompt as few-shot examples
- manual_review_feedback.sql inserted 57 human-reviewed decisions as training data

---

## LAUNCH PLAN (all items required before go-live)

### Phase 1 — Data Foundation
- [x] 1. Top up thin P7/P6 topics via seed run (see thin topics below)
- [x] 2. Remove Catapult questions (DELETE WHERE source='catapult_test')
- [x] 3. Save study/mock results to Supabase (question_results + progress_summary)
- [ ] 4. Stripe end-to-end test — confirm profiles table updates on payment

### Phase 2 — Student Experience  
- [x] 5. Personalised recommendations on dashboard (weak topics from history)
- [x] 6. Remove Anthropic/Claude branding from all pages
- [ ] 7. Parent section (child progress, weak topics, recent sessions)
- [x] 8. Google OAuth — publish app in Google Cloud Console
- [ ] 9. Results history page
- [ ] 10. Function machine question type + SVG diagram
- [ ] 11. STAR Chat — SEAG-restricted help chatbot (Anthropic API, strict system prompt limiting to SEAG topics only)

### Phase 3 — Pre-Launch
- [ ] 12. Real Life Test (printable 56-question paper)
- [ ] 13. Full end-to-end user journey test (signup → onboarding → mock → study → payment)
- [ ] 14. Full website QA walkthrough (every page, every button, every user journey tested)
- [ ] 15. Privacy Policy review — ensure accurate, GDPR compliant, reflects current architecture
- [ ] 16. Terms of Service review — check all terms are appropriate for a children's educational product
- [ ] 17. Cookie policy check — confirm cookie consent banner is working
- [ ] 18. Check all footer links work (Privacy, Terms, Support, Facebook)
- [ ] 19. Check all email templates in Supabase match STAR branding
- [ ] 20. Mobile testing on real devices (iOS and Android)
- [ ] 21. Cross-browser testing (Chrome, Safari, Firefox, Edge)
- [ ] 22. Favicon added (currently 404)
- [ ] 23. Check staraitutor.co.uk domain points to the correct site
- [ ] 24. Stripe switch to live keys
- [ ] 25. SMTP email configured via Resend.com for staraitutor.co.uk
- [ ] 26. Confirm email enabled in Supabase Auth after SMTP verified
- [ ] 27. CLAUDE.md final update

### Post Launch
- [ ] GCSE expansion (2027)

---

## THIN TOPICS — need top-up before removing Catapult

### P7 (priority — thinner than P6)
| Topic | Current | Target | Need |
|-------|---------|--------|------|
| arithmetic | 25 | 40 | +15 |
| fractions_decimals | 23 | 40 | +17 |
| geometry | 22 | 40 | +18 |
| grammar | 23 | 40 | +17 |
| spelling | 23 | 40 | +17 |

### P6 (borderline)
| Topic | Current | Target | Need |
|-------|---------|--------|------|
| grammar | 25 | 40 | +15 |
| punctuation | 25 | 40 | +15 |
| spelling | 24 | 40 | +16 |
| vocabulary | 21 | 40 | +19 |

---

## KEY DECISIONS (do not reverse without good reason)

1. Pre-seeded question bank — never go back to live generation for mocks
2. Server-side writes via /api/ functions — browser cannot write to Supabase directly
3. Supabase JS 2.39.3 pinned — later versions had silent update failures in browser
4. Comprehension as passage sets — always pull all 13 questions from same passage per mock
5. N option for punctuation/spelling (not E) — matches real SEAG format exactly
6. Validator: FORMAT + DIFFICULTY + TOPIC checks only — does NOT re-derive maths answers
7. AI marking only for written answers — MC is always client-side string match
8. No back button during mock — matches real SEAG exam conditions
9. Diagrams stored as SVG strings in DB at seed time — never generated at runtime during student sessions

---

## COMMON GOTCHAS

- Supabase service role key silently fails from browser (returns 204, writes nothing) — always use /api/ functions
- Supabase JS must stay at 2.39.3
- validate.html and review.html require manual key entry on each visit (no session persistence)
- seed-questions.js reads SUPABASE_SERVICE_ROLE_KEY not SUPABASE_SERVICE_KEY
- Vercel env vars must be set separately from .env — CC reads .env locally, Vercel needs dashboard config
- Anthropic API key has been rotated multiple times — always use latest from console.anthropic.com
- N option: stored as key "N" in options jsonb, displayed as "N. No mistake" — never "E. No mistake"
