# STAR AI Tutor — Product Roadmap & Learning Journey

## Vision
A complete AI-powered preparation platform for the Northern Ireland SEAG Transfer Test (P6/P7).
Every student who uses STAR AI Tutor from start to finish should walk into the exam fully prepared —
topics covered, weaknesses addressed, timed practice done.

---

## The Learning Journey (4 Stages)

### Stage 1 — Foundation (P6, 12+ months out)
**Goal:** Build topic knowledge and identify weak areas.

- All students start on **general mixed sprints** regardless of level
- After 2 free sprints + 1 paid sprint, the AI begins analysing performance
- AI recommends a personalised journey based on results
- Cycle: Mixed sprint → identify weak topic → focused topic sprint → back to mixed → repeat
- AI always throws in a **general mixed sprint** even during focused topic work
- Parent dashboard shows progress and AI recommendations

**AI behaviour:**
- Tracks performance per topic across all sessions
- Recommves specific topic sprints when a topic falls below threshold
- Recognises when a topic is recovered and returns to mixed practice
- Never lets one topic dominate for too long

---

### Stage 2 — Building Confidence (P6/P7, ~6 months out)
**Goal:** Full paper practice on device, identify remaining gaps.

- Student moves to **full 56-question timed mocks on the website**
- AI still tracks every question
- After each mock AI identifies which topics still need work
- Sends student back to specific topic sprints for weak areas
- Always includes occasional general mixed sprints
- Progress timeline on dashboard shows "Stage 2 of 4 — X months to go"

**AI behaviour:**
- Compares mock performance to topic sprint performance
- Flags topics that were strong in sprints but weak in mock conditions (time pressure effect)
- Adjusts recommendations accordingly

---

### Stage 3 — Exam Simulation (P7, ~4 months out)
**Goal:** Replicate real exam conditions with printable papers.

- Student prints the **STAR AI Tutor practice paper** (SEAG-style, 56 questions)
- Sits it under timed conditions (50 minutes)
- Parent marks using the **printed answer key**
- Parent goes to a **marking page** (via QR code or short URL printed on answer key)
- Parent enters only the **questions the child got wrong** (quick — 2 minutes)
- AI receives results and updates the student's profile

**Marking page flow:**
1. Parent scans QR code or goes to URL on answer key (e.g. staraitutor.co.uk/mark)
2. Enters the paper reference number (printed on answer key)
3. Ticks which question numbers were wrong
4. Submits — done
5. AI immediately updates recommendations

**AI behaviour after printable paper results:**
- If student scoring **80%+**: "Great work — keep practising but don't overdo it. Rest is important too."
- If weak in specific topics: sends back to topic sprints for those areas
- If consistently strong: moves to "stay sharp" mode — light mixed practice only
- Always acknowledges progress and effort

---

### Stage 4 — Exam Ready
**Goal:** Confidence, consistency, no surprises.

- All topics covered at least once
- Weaknesses identified and addressed
- Timed practice completed
- AI in "maintenance mode" — light mixed sprints to stay sharp
- Dashboard shows green across all topic areas
- Final message: "You're ready. Trust your preparation."

---

## Handling Different Student Types

### Full Journey Student (started in P6)
- AI has complete performance history
- Makes specific automatic recommendations
- Knows exactly which topics need attention
- Smooth progression through all 4 stages

### Mid-Journey Joiner (joined in P7)
- AI asks: "Which subjects did you find hardest — Maths or English?"
- Recommends focused sprints based on answer
- Accelerated journey through remaining stages
- Always includes a baseline mixed sprint early on

### Late Comer (joined close to exam, goes straight to printable)
- AI detects no performance history
- Recommends: "Before using printed papers, do one online mock first so we know where to focus"
- After online mock, AI has enough data to make good recommendations
- Compressed but structured journey

---

## Key Features to Build

### Already Built
- [x] Topic sprints (study.html)
- [x] Full device mocks (mock.html)
- [x] Question bank (~1,167 questions in Supabase)
- [x] Parent dashboard
- [x] AI marking of written answers
- [x] Printable paper generator (in progress)

### To Build — Printable Paper System
- [ ] Question paper PDF generator (connected to Supabase) ← IN PROGRESS
- [ ] Answer sheet PDF (matching SEAG format)
- [ ] Parent answer key PDF (with correct answers marked)
- [ ] QR code / reference number on answer key
- [ ] Online marking page (staraitutor.co.uk/mark)
- [ ] Results ingestion — parent submits wrong answers
- [ ] AI recommendations update based on printable results
- [ ] Diagram rendering in question paper

### To Build — Learning Journey
- [ ] Stage detection — AI knows which stage each student is in
- [ ] Progress timeline on parent/student dashboard
- [ ] Stage transition triggers (time-based + performance-based)
- [ ] "Stay sharp" mode for high performers
- [ ] Late joiner detection and accelerated pathway
- [ ] Post-exam feedback collection

### To Build — AI Recommendations Engine
- [ ] Cross-stage performance tracking
- [ ] Topic recovery detection
- [ ] Time pressure effect detection (sprint vs mock performance gap)
- [ ] Burnout prevention ("don't overdo it") messaging
- [ ] Parent-facing plain English summaries of AI recommendations

---

## Printable Paper — Cover Page Message
Should include:
- This is a timed practice paper — set a timer for 50 minutes
- Work through all 56 questions
- Mark your answers on the answer sheet provided
- Do not open the paper until the timer starts
- When finished, ask a parent or teacher to mark using the answer key
- Your results will be used to guide your next steps on STAR AI Tutor

---

## Answer Key — Parent Instructions
Printed on the answer key:
- Correct answers for all 56 questions
- Instructions: circle any questions your child got wrong
- QR code + URL: staraitutor.co.uk/mark
- Reference number for this specific paper
- "Enter only the wrong answers — it takes less than 2 minutes"

---

## Technical Notes for CC
- Marking page: new HTML page `/mark` or `/paper-results`
- Needs: paper reference number lookup, wrong question entry UI, Supabase write
- Paper reference number: generated at PDF creation time, stored in Supabase with question IDs and answer key
- Parent does NOT need to be logged in to submit results (reference number is the auth)
- Results stored in new table: `printable_results` (paper_ref, student_id, wrong_questions[], submitted_at)
- AI reads this table when generating next recommendations

---

*Document created: April 2026*
*Save as: STAR_PRODUCT_ROADMAP.md in project root*
