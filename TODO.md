# Post-Bulk-Generation Tasks

## Completed

✅ **Student Authentication** — using existing Supabase Auth (login.html + Google OAuth)

✅ **Question History Tracking** — `student_question_history` table; both study.html and mock.html insert rows with `student_id`, `user_id`, and `seen_at` on every answered question

✅ **Question Repeat Prevention** — 30-day exclusion filter applied at fetch time in both study mode (`fetchBatch`) and mock mode (`fetchPool`); logged-out users unaffected

---

## Remaining

### Student Progress Dashboard
- Overall accuracy per category (strengths / weaknesses)
- Historical performance graphs
- Session history page

### Admin Monitoring
- Low stock alerts when a category drops below a threshold
- Automated top-up trigger when buckets run low

---

## Timing

Progress dashboard is the next priority after bulk generation completes and question bank is verified.
