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

## Notes for whoever executes this
- Never put service-role or Anthropic keys in client code.
- Supabase JS is pinned to 2.39.3 — do not upgrade.
- All DB writes go via /api/ functions.
- Test accounts: andrewsandgregg@gmail.com, bigfishholidayhomes@gmail.com.
