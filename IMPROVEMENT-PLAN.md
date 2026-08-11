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

### A2. Stop exposing correct answers to the browser (CRITICAL) — ✅ FULLY DONE
**Part 1 — DONE (b0f6a2e).** Answer checking moved server-side (api/mark-written.js ?action=check by question_id); study.html + mock.html stopped selecting correct_answer/explanation.
**Part 2a — DONE (e6fe4d2).** validate.html + review.html moved off the anon key: api/admin list-questions + question-counts (admin-cookie, service role); validate.html approve/reject go through update-verdict (which now also sets source='rejected' on FAIL).
**Part 2b — DONE (92d7d98, 53b1e27).** real-life-test.html no longer selects answers; save-paper resolves them server-side and returns an {id:{answer,explanation}} map the client merges for the guardian answer key. (Uncovered + fixed a pre-existing bug: session_type 'guardian_test' violated the check constraint — switched to 'real_life_test' everywhere; the Real Life Test save/limit had never worked.)
**Part 2c — DONE (migration run).** REVOKE SELECT ON questions FROM anon, authenticated + GRANT SELECT on all columns except correct_answer/explanation. Verified: anon SELECT of correct_answer now returns permission-denied. Rollback in migrations/revoke_answer_columns.sql. The answer-exposure hole is closed.

### A3. Lock admin pages — ✅ DONE
**CORE — DONE (086f050).** api/admin-login.js folded into api/admin.js (?action=login/check; ADMIN_PASSWORD + httpOnly HMAC cookie via ADMIN_SECRET). admin actions require the cookie, save-report requires a student JWT, CORS locked. validate/review/reports use the server login; hardcoded STAR2026admin removed. Env vars ADMIN_PASSWORD + ADMIN_SECRET set in Vercel and verified working.
**Admin read/write routing — DONE** as part of A2 Part 2a (validate.html + review.html now use the admin-cookie server endpoints, no anon key).

## PHASE B — Cost

### B1. star-chat model decision — ⏳ PENDING owner quality judgement
Switched `api/star-chat.js` model to `claude-haiku-4-5-20251001` (commit 3abfc38; `// B1 trial` marker on the model line). Owner is testing 10 real student questions now.
- **Keep Haiku** → drop the `// B1 trial` comment, mark done (~12x cheaper).
- **Revert** → model back to `claude-sonnet-4-6`.
Note: an earlier "AI service error" during this trial was NOT the model — it was a stale Vercel `ANTHROPIC_API_KEY` (now updated). Reproduction confirmed Haiku + the full STAR prompt + max_tokens:512 work fine.

### B1a. STAR Chat knows the logged-in student — DONE (commit 37bc309)
star-chat.html student mode now sends childData { childName, yearGroup } (reads profiles.year_group); api/star-chat.js buildSystem(childData) prepends a line telling STAR the student's name + year group so it skips Phase 1's name/age/year questions and goes straight to the 4 session options. Graceful fallback (Phase 1 asks normally) if year_group is missing.

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
- F1. **Back up the question bank** — DONE. `scripts/backup-question-bank.mjs` exports questions + passages to timestamped JSON under ./backups (gitignored), keeps the 4 most recent of each. Run weekly: `node scripts/backup-question-bank.mjs`. First run: 13,776 question rows + 35 passages.
  - **Supabase keep-alive (temporary):** api/send-weekly-emails.js now does a `SELECT id FROM questions LIMIT 1` at the start of the Sunday cron so the free-tier project isn't paused for inactivity. Remove once Supabase is upgraded to Pro before launch. Failure is swallowed so it never blocks the emails.
- F2. **Anthropic spend alert**: set a monthly budget limit + email alert in console.anthropic.com. (Human, 5 min — no code.)
- F3. **Error visibility**: add a tiny `api/log-error.js` that client pages POST uncaught errors to, writing to a Supabase `client_errors` table; check weekly. (Sonnet.)
- F4. **Full dress rehearsal**: create a brand-new parent account on a phone, pay with Stripe test card, add child, run onboarding → sprint → full mock → parent dashboard → weekly email. Fix everything that snags. (Human.)
- F5. Existing CLAUDE.md launch items still open: Stripe live keys, Supabase confirm-email after SMTP verify, remaining Anthropic branding sweep.

## Notes for whoever executes this
- Never put service-role or Anthropic keys in client code.
- Supabase JS is pinned to 2.39.3 — do not upgrade.
- All DB writes go via /api/ functions.
- Test accounts: andrewsandgregg@gmail.com, bigfishholidayhomes@gmail.com.
