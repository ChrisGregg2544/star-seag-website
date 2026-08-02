# STAR Improvement Plan — ordered, self-contained tasks
Each task is independent and small enough for the stated model to execute. After each task: test, commit, push.

## EXECUTION ORDER — complete, do in THIS order (not document order)
Details for each task ID are in the phase sections below.

| Step | Task | Model | Notes |
|------|------|-------|-------|
| 1 | F2 — Anthropic spend cap + alert | **Human** (5 min, no code) | console.anthropic.com → budget limit. Do TODAY: bounds worst-case bill while endpoints are still open |
| 2 | F1 — question bank backup script | Sonnet writes; Human/Haiku runs weekly | Your core asset currently has no backup |
| 3 | E5 — lint gate in all seeding scripts | Sonnet | Makes bank corruption impossible to reintroduce |
| 4 | A1 — auth + rate-limit star-chat & mark-written | Sonnet | Stops credit-draining abuse |
| 5 | A2 — stop exposing correct answers to browser | **Opus/frontier** | Touches RLS + core answer loop; highest breakage risk — test a full mock after |
| 6 | A3 — server-side admin page auth | Sonnet | Remove hardcoded STAR2026admin |
| 7 | E4 — regenerate comprehension bank | Sonnet operates pipeline | Do before launch: comprehension is the thin spot (~130 sprint questions per year group) |
| 8 | E1 — rewrite ~700 segment-style grammar | Sonnet | Proven script pattern, adapt + run |
| 9 | E2 — re-segment overlapping spelling/punctuation | Sonnet | Proven reconstruct+verify pattern |
| 10 | E3 — fix duplicate/gap options (~100) | Sonnet | Small script, self-verifies via linter |
| 11 | B1 — trial Haiku for star-chat | Human judges | ~12x cost saving if quality holds |
| 12 | B2 — cache written-answer marking | Sonnet | Table + hash lookup |
| 13 | C1 — results history page | Sonnet | Read-only page from sessions table |
| 14 | C2 — error/timeout polish on all fetches | Sonnet | Mechanical audit |
| 15 | F3 — client error logging endpoint | Sonnet | See real-world breakage before users report it |
| 16 | C3 — mobile + cross-browser QA | **Human** | Real devices: iPhone Safari, Android Chrome, Firefox, Edge |
| 17 | F4 — full dress rehearsal as a real family | **Human** | Fresh account on a phone: pay (test card) → add child → onboard → sprint → mock → parent email |
| 18 | F5 — launch switches | **Human** | Stripe live keys, confirm-email on, final branding sweep |
| 19 | E6 — weekly maintenance loop | Haiku (ongoing) | lint + duplicates + monthly AI validation |

Rule of thumb: **Haiku** = run existing scripts, report numbers. **Sonnet** = write/adapt code against a spec in this file. **Opus/frontier** = anything touching RLS, auth, payment, or answer-checking. **Human** = devices, judgement calls, money, and anything in the Anthropic/Stripe dashboards.

## PHASE A — Security (do before launch)

### A1. Protect star-chat and mark-written (CRITICAL)
Files: `api/star-chat.js`, `api/mark-written.js`
1. Require a Supabase JWT: read `Authorization: Bearer <token>` header, verify with `https://iutcgogmxhaqgaxkznxu.supabase.co/auth/v1/user` (pass the token + anon key). Reject 401 if invalid.
2. Update callers (`star-chat.html`, `study.html`, `mock.html`) to send the session token: `(await sb.auth.getSession()).data.session.access_token`.
3. Replace CORS `*` with `https://staraitutor.co.uk` and the vercel.app domain.
4. Add a simple per-user daily cap: count today's calls in a `api_usage` table (user_id, date, count); reject over 200/day with a friendly message.

### A2. Stop exposing correct answers to the browser (CRITICAL)
**Part 1 — DONE (commit b0f6a2e).** api/check-answer.js created; api/mark-written.js now looks the answer up server-side by question_id; study.html + mock.html no longer SELECT correct_answer/explanation and check via the endpoints on submit. Answers are out of the client data flow and localStorage.
**Part 2 — PENDING, do AFTER A3.** The base-table columns are still readable via the anon key. Steps:
  1. **First** convert validate.html + review.html off the anon key: add admin-cookie server endpoints (service role) for their question reads, and for validate.html's direct `validated=true`/`source=rejected` writes (currently anon via the "Anon can update validator fields" RLS policy). Then those pages no longer depend on anon column access. (This was scoped out of A3 core.)
  2. Convert `real-life-test.html` (a printable answer-key generator): move answer-key rendering to a service-role endpoint gated to the paper's owner, since it deliberately displays answers and cannot use the check-answer pattern.
  3. **Then** revoke: `REVOKE SELECT (correct_answer, explanation) ON public.questions FROM anon, authenticated;` (keep SELECT on all other columns). Also review the "Anon can update validator fields" RLS policy — tighten or drop once validate.html writes go server-side.
  4. Re-test every question-fetch page after the revoke (study, mock, real-life-test, review, validate) — a stray SELECT of the revoked columns will error.

### A3. Lock admin pages
**CORE — DONE (commit 086f050).** api/admin-login.js added (ADMIN_PASSWORD + httpOnly HMAC-signed cookie via ADMIN_SECRET). api/admin.js: admin actions require the cookie, save-report requires a student JWT, CORS locked. validate.html/review.html/admin/reports.html use the server login; hardcoded STAR2026admin removed everywhere. study.html Report button sends its token.
  - **Requires Vercel env vars: `ADMIN_PASSWORD` (new value, NOT STAR2026admin) and `ADMIN_SECRET` (long random string).** Until set, admin login returns 500 (fail-safe).
**Still open (moved into A2 Part 2):** validate.html and review.html still read questions with the pasted anon key, and validate.html still writes validated/rejected directly via the anon RLS policy. These must move to admin-cookie server endpoints (service role) as part of A2 Part 2, before the anon column REVOKE.

## PHASE B — Cost

### B1. star-chat model decision
Switch `api/star-chat.js` model to `claude-haiku-4-5-20251001` and test 10 real student questions. If quality is acceptable, keep Haiku (~12x cheaper). If not, keep Sonnet but rely on A1's daily cap.

### B2. Cache written-answer marking
In `api/mark-written.js`: before calling the API, hash `question_id + normalised(studentAnswer)`; look up a `marking_cache` table; return cached verdict if present, else call AI and store.

## PHASE C — Student/parent experience

### C1. Results history page
New `history.html`: list past sessions from `sessions` table (date, type, score, topics), linked from dashboard + parent dashboard. Read-only, no AI.

### C2. Reliability polish
- Every fetch in `study.html`/`mock.html`/`dashboard.html` gets a visible error state with a Retry button (several already exist — audit for gaps).
- Add a 15s timeout to ALL fetch calls to /api/ (mark-written already has one).

### C3. Mobile + cross-browser pass
Manual: iPhone Safari, Android Chrome, Firefox, Edge. Test: login → sprint → mock → results → parent dashboard. Log bugs in this file under "Findings".

## PHASE D — Content quality (ongoing)
- D1. Re-run `scripts/validate-all-ai.js` monthly (DRY_RUN first).
- D2. Review the 32 un-validated punctuation questions (validated=false) — hand-fix or delete.
- D3. Weekly `find-duplicates.js` run after any seeding.

## PHASE E — Question bank repair (post-quarantine, July 2026)
State: 12,401 validated questions are 100% contract-clean (scripts/question-contract.mjs).
2,405 quarantined: validated=false, validator_reason='lint-quarantine'. Details per question in scripts/lint-report.json (regenerate it any time with `node scripts/lint-questions.mjs`).
Every task below: run on 5 first, eyeball output, then full batch. After ANY repair batch, re-run `node scripts/lint-questions.mjs` — repaired questions must show 0 violations before setting validated=true.

### E1. Rewrite segment-style grammar — DONE (commit 2121988)
419 quarantined grammar questions rewritten to word-choice via
scripts/rewrite-grammar-questions.mjs; 419/419, 0 failures. Grammar quarantine now 0.

### E2. Re-segment overlapping spelling/punctuation — DONE (commit 9d58b7f)
scripts/resegment-punctuation.mjs adapted for both topics (topic-aware prompt +
independent verifier + re-lint). 94 quarantined segment questions → 75 revalidated,
19 left quarantined, 0 errors (~80% recovery).

### E3. Fix duplicate/empty/gap options — DONE (commit 79f5f10)
scripts/fix-option-questions.mjs: fixes A-E MC (maths+vocab) with a duplicate/blank/
gap option, keeping question+answer; structural re-lint + independent semantic
verifier (catches near-synonym distractors). 13 targets → 12 revalidated, 1 left
quarantined. Segment-style option issues were E2's; comprehension is E4.

### E4. Comprehension quarantine — IN PROGRESS
**Deterministic repair — DONE (commit 9ea89bd).** scripts/repair-comprehension-passages.mjs:
325 quarantined comprehension had a valid passage_id but no passage TEXT on the row.
Copied passage.content from the linked passages row, re-linted, set validated=true.
Result: 175 repaired (150 skipped — also empty-correct-answer), 0 AI cost.
comprehension_mc: P6 70→154, P7 70→161.

**Two follow-up decisions — DONE.**
1. DELETE the ~1,653 quarantined comprehension — 1,562 deleted (backed up to scratchpad
   deleted-comprehension-quarantine-backup.json first). 91 could NOT be deleted: referenced
   by student_question_history / question_results (FK). They stay validated=false (never
   served). To physically remove them, delete their history/results rows first — STILL HELD.
2. GENERATE fresh volume — DONE (commits 302647f, 3617a71). Added 10 fresh passages
   (5 P6 + 5 P7) via scripts/generate-passages.mjs (varied styles/domains, dedup guard),
   then 130 questions (7 MC + 6 written each) via generate-passage-questions.mjs.
   BUG FOUND + FIXED: generate-passage-questions.mjs set correct_answer=null on written
   questions (model answer only in explanation) — every written comprehension it ever made
   was unmarkable and gate-rejected. Now sets correct_answer = model answer.

**E4 net result:** comprehension_mc P6 70→189, P7 70→196; comprehension_written P6 58→88,
P7 59→89. Passages 25→35. Bank: 13,212 validated, 0 contract violations.
Note: the applied passages are a fresh generation (equivalent variety), not the exact
preview — the generator does not persist previews.

## PHASE E COMPLETE (E1-E5 done; E6 = ongoing weekly maintenance).
Still-quarantined residue (~110): 91 FK-held comprehension + ~19 segment/option questions
the verifiers could not confirm. All validated=false (never served). Optional cleanup.

### E5. Close the gate — DONE (commit pending)
lintQuestion() is now imported and enforced before every `questions`-table insert:
- seed-questions.js (insertQuestions pre-insert filter)
- api/question-builder.js (save-generated — the API path all generator scripts call; skips violators, returns a `skipped` count). Note: its save-comprehension-set writes to `reference_questions` (different table), so it is NOT gated.
- scripts/fill-questions.mjs (insertQuestions)
- generate-passage-questions.mjs (also FIXED to store `passage` text, not just passage_id — that omission was the original missing-passage bug)
- scripts/fix-db-questions.mjs (sbInsert)
bulk-generate.js inserts via the question-builder API, so it is covered automatically.
Behaviour: violating questions are logged with their reasons and skipped, never inserted.
KNOWN EFFECT: comprehension generated the old way (passage embedded in question_text, no passage_id) is now rejected by save-generated — use the passage-linked flow (seed-questions.js seedComprehension / generate-passage-questions.mjs).

### E6. Weekly maintenance (any model, 5 minutes)
1. `node scripts/lint-questions.mjs` — must stay at 0 violations.
2. `node find-duplicates.js` after any seeding.
3. Monthly: `DRY_RUN=1 node scripts/validate-all-ai.js` (semantic check, Haiku).

## PHASE F — Launch-readiness extras (owner + any model)
- F1. **Back up the question bank** (your core asset): weekly export of the questions + passages tables to a local file. `node -e` script with service key → JSON dump, keep 4 rotations. (Sonnet writes it once; Haiku/human runs it.)
- F2. **Anthropic spend alert**: set a monthly budget limit + email alert in console.anthropic.com. (Human, 5 min — no code.)
- F3. **Error visibility**: add a tiny `api/log-error.js` that client pages POST uncaught errors to, writing to a Supabase `client_errors` table; check weekly. (Sonnet.)
- F4. **Full dress rehearsal**: create a brand-new parent account on a phone, pay with Stripe test card, add child, run onboarding → sprint → full mock → parent dashboard → weekly email. Fix everything that snags. (Human.)
- F5. Existing CLAUDE.md launch items still open: Stripe live keys, Supabase confirm-email after SMTP verify, remaining Anthropic branding sweep.

## Notes for whoever executes this
- Never put service-role or Anthropic keys in client code.
- Supabase JS is pinned to 2.39.3 — do not upgrade.
- All DB writes go via /api/ functions.
- Test accounts: andrewsandgregg@gmail.com, bigfishholidayhomes@gmail.com.
