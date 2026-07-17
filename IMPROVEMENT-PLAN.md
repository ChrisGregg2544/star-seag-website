# STAR Improvement Plan — ordered, self-contained tasks
Each task is independent and small enough for any model to execute. Do them in order. After each task: test, commit, push.

## PHASE A — Security (do before launch)

### A1. Protect star-chat and mark-written (CRITICAL)
Files: `api/star-chat.js`, `api/mark-written.js`
1. Require a Supabase JWT: read `Authorization: Bearer <token>` header, verify with `https://iutcgogmxhaqgaxkznxu.supabase.co/auth/v1/user` (pass the token + anon key). Reject 401 if invalid.
2. Update callers (`star-chat.html`, `study.html`, `mock.html`) to send the session token: `(await sb.auth.getSession()).data.session.access_token`.
3. Replace CORS `*` with `https://staraitutor.co.uk` and the vercel.app domain.
4. Add a simple per-user daily cap: count today's calls in a `api_usage` table (user_id, date, count); reject over 200/day with a friendly message.

### A2. Stop exposing correct answers to the browser (CRITICAL)
1. Create `api/check-answer.js` (service role): input `{question_id, answer}`, returns `{correct: bool, correct_answer, explanation}`. Only reveals the answer AFTER an attempt.
2. In `study.html` and `mock.html`, remove `correct_answer, explanation` from the SELECT; call `api/check-answer` on submit instead.
3. Change RLS: drop "Anon can read all questions"; keep public SELECT but create a Postgres VIEW `questions_public` without `correct_answer/explanation`, or use column-level grants.
4. Test a full mock + sprint end-to-end after this change — it touches the core loop.

### A3. Lock admin pages
1. Move `validate.html`, `review.html`, `admin/reports.html` behind a server check: small `api/admin-login.js` comparing against `ADMIN_PASSWORD` env var, sets an httpOnly cookie; pages fetch data only via APIs that check the cookie.
2. Remove the hardcoded `STAR2026admin` strings.
3. Rotate the password (it is now in git history).

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

### E1. Rewrite segment-style grammar (~700 questions) — AUTOMATED
Adapt `scripts/rewrite-grammar-questions.mjs` (proven: 524/524 success):
1. Change fetchFlagged() to select topic=grammar, validated=false, validator_reason='lint-quarantine'.
2. Run `--limit 5` dry, check quality, then `--apply`.
3. After rewrite, set validated=true and validator_reason=null on the rewritten IDs.
4. Re-lint to confirm.

### E2. Re-segment overlapping spelling/punctuation (~250) — AUTOMATED
Adapt `scripts/resegment-punctuation.mjs` (has built-in independent verifier):
1. Generalise topic filter to punctuation OR spelling; source from quarantined set.
2. `--apply`: verified → update + validated=true; unverified → leave quarantined.
3. Expect ~30% recovery; the rest stay out (correct outcome).

### E3. Fix duplicate/empty/gap options (~100) — AUTOMATED
New small script per rewrite-grammar pattern: send question + violation names to Sonnet, ask for corrected options only (keep question + answer), re-lint result in-script (import lintQuestion), only write if 0 violations, then validated=true.

### E4. Comprehension + empty-answer questions (~1,400) — REGENERATE, do NOT repair
1. DELETE quarantined questions with violations missing-passage / missing-passage-id / empty-correct-answer (they carry no salvageable value) — or leave quarantined if nervous; they cost nothing.
2. Top up comprehension with fresh passage sets (7 MC + 6 written per passage) using the existing generation pipeline (seed-questions.js seedComprehension or question-builder), which stores passage + passage_id correctly.
3. Target per CLAUDE.md: healthy counts per year group.

### E5. Close the gate — MANDATORY, do this before any new seeding
In every generation/seeding script (seed-questions.js, api/question-builder.js insert paths, topup scripts):
`import { lintQuestion } from './scripts/question-contract.mjs'` — refuse to insert any question where lintQuestion(q).length > 0. This is what makes the fix permanent.

### E6. Weekly maintenance (any model, 5 minutes)
1. `node scripts/lint-questions.mjs` — must stay at 0 violations.
2. `node find-duplicates.js` after any seeding.
3. Monthly: `DRY_RUN=1 node scripts/validate-all-ai.js` (semantic check, Haiku).

## Notes for whoever executes this
- Never put service-role or Anthropic keys in client code.
- Supabase JS is pinned to 2.39.3 — do not upgrade.
- All DB writes go via /api/ functions.
- Test accounts: andrewsandgregg@gmail.com, bigfishholidayhomes@gmail.com.
