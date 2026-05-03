# Post-Bulk-Generation Tasks

## Status
Bulk generation running — complete these tasks once generation finishes and questions are tested.

---

## 1. Student Authentication System
- Login / signup pages
- Session management
- User profiles

## 2. Question Repeat Prevention
- Track `question_id` + `student_id` in `student_question_history`
- Filter queries to exclude questions seen in last 30 days
- Works in both study mode and mock mode

## 3. Student Progress Tracking
- Overall accuracy per category
- Strengths / weaknesses dashboard
- Historical performance graphs

---

## Timing

Add authentication **before** public launch.

- Easier to launch with auth from day 1 — no migration needed later
- Better data from the start (all sessions tied to a real user)
- Do **after** bulk generation completes + testing passes

Estimated: 6–8 hours for full auth + tracking system.
