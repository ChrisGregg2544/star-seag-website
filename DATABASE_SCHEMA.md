# STAR SEAG — Database Schema

Supabase project: `iutcgogmxhaqgaxkznxu.supabase.co`

---

## questions table (LIVE STUDENT QUESTION BANK)

**1,271 questions** — this is what students actually see during mocks and study sessions.

| Source tag | Count | Notes |
|---|---|---|
| `ai_generated_v2` | 111 | New questions with full A/B/C/D/E options — the target format |
| `ai_generated_v3` | 1,160 | Legacy questions, some with incomplete options — delete after bank reaches 2,000+ v2 |
| `rejected` | 10 | Failed validation — kept for audit, never served to students |

```sql
questions (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject           text,                    -- 'english' or 'maths'
  topic             text,                    -- category: punctuation, grammar, spelling, vocabulary,
                                             --   comprehension_mc, comprehension_written, arithmetic,
                                             --   geometry, fractions_decimals, measurement,
                                             --   statistics, algebra_sequences
  year_group        text,                    -- 'P6' or 'P7'
  difficulty        int,                     -- 1–5
  question_type     text,                    -- 'Multiple_Choice' or 'written'
  question_text     text,
  options           jsonb,                   -- {"A":"…","B":"…","C":"…","D":"…","E":"…"} for most topics
                                             -- {"A":"…","B":"…","C":"…","D":"…","N":"No mistake"} for punctuation/spelling
                                             -- null for comprehension_written
  correct_answer    text,                    -- single letter: A/B/C/D/E or N
  explanation       text,
  validated         boolean,                 -- true = approved, serves to students
  source            text,                    -- 'ai_generated_v2', 'ai_generated_v3', 'rejected'
  passage           text,                    -- full sentence (punctuation); reading passage (comprehension)
  passage_id        uuid,                    -- FK → comprehension_passages.id (comprehension sets only)
  diagram           text,                    -- inline SVG string or null
  times_used        int,                     -- incremented each time served to a student
  validator_verdict text,                    -- 'pass', 'warn', 'fail', or null
  validator_reason  text,
  created_at        timestamptz DEFAULT now()
)
```

### RLS policies

| Policy | Role | Operation |
|---|---|---|
| Public can read validated questions | public | SELECT WHERE validated = true |
| Anon can read all questions | anon | SELECT (unrestricted) |
| Anon can update validator fields | anon | UPDATE (times_used only) |
| Service role full access | service_role | ALL |

---

## reference_questions table (CATAPULT PAPER TEMPLATES)

**1,133 questions** extracted from 20 Catapult past papers (10 P6, 10 P7).
Used as style/difficulty examples when generating new questions. **Students never see these.**

> **DELETE BEFORE LAUNCH — copyright material.**
> Run: `DELETE FROM reference_questions;` in Supabase SQL editor before going live.

```sql
reference_questions (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text       text         NOT NULL,
  correct_answer      text         NOT NULL,
  category            text         NOT NULL,    -- same 12 categories as questions.topic
  difficulty          text,                     -- 'easy', 'medium', 'hard'
  year_group          text,                     -- 'P6' or 'P7'
  paper_source        text,                     -- e.g. 'catapult_p6_paper_1'
  explanation         text,
  needs_diagram       boolean      DEFAULT false,
  diagram_description text,                     -- plain-English description of required diagram
  passage_id          uuid,                     -- FK → comprehension_passages.id (comprehension sets only)
  extracted_at        timestamptz  DEFAULT now(),

  -- Populated by bulk-revalidate tool
  validation_outcome  text,                     -- 'pass', 'warn', 'fail'
  v1_score            int,                      -- V1 accuracy validator score (1–10)
  v1_reason           text,
  v4_score            int,                      -- V4 specialist/quality validator score (1–10)
  v4_reason           text,
  combined_score      numeric,                  -- average of active validator scores
  revalidated_at      timestamptz
)
```

### Key difference from questions table

| | `questions` | `reference_questions` |
|---|---|---|
| Has `options` jsonb | Yes | No — only `correct_answer` text |
| Has `topic` column | Yes (`topic`) | No — uses `category` |
| Has `source` column | Yes | No — uses `paper_source` |
| Has `validated` boolean | Yes | No |
| Has `diagram` SVG | Yes | No — has `diagram_description` text only |
| Served to students | Yes | Never |
| Delete before launch | No | **Yes** |

---

## Other tables

| Table | Purpose |
|---|---|
| `comprehension_passages` | Passage text for comprehension sets (20 total: 10 P6, 10 P7) |
| `validation_results` | Log of every validator run — v1/v2/v3 scores, outcome, attempts |
| `profiles` | User accounts — subscription, year group, progress state |
| `student_question_history` | Questions seen per student (dedup) |
| `sessions` | Completed mocks and sprints |
| `question_results` | Per-question results per session |
| `progress_summary` | Latest scores and weak topics per student |
| `validator_feedback` | Human review decisions used to train future validator runs |
