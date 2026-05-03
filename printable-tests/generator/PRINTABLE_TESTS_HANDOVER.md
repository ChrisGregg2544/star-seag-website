# STAR AI Tutor — Printable Tests Handover

## Overview
Build a system that generates printable SEAG-style practice test PDFs from the Supabase question bank.

## Reference Files
See `/printable-tests/reference/` for the 4 official SEAG PDFs:
- `PracticePaper1.pdf` — full question paper format to replicate
- `PracticePaper2.pdf` — second paper showing additional question formats
- `PracticePaper1_AnswerSheet.pdf` — official answer sheet format
- `PracticePaper2_AnswerSheet.pdf` — second answer sheet

## What Has Already Been Built
See `/printable-tests/generator/` for the starting point scripts:
- `seag_generator.py` — question paper generator (Python + ReportLab)
- `answer_sheet_v2.py` — answer sheet generator (partially complete)

## Output: 3 Documents Per Paper
1. **Question Paper** — 56 questions, A4, SEAG layout
2. **Answer Sheet** — pupil marks answers (thin horizontal line style)
3. **Parent Answer Key** — same as answer sheet but with correct answers shown

## SEAG Format Rules (from both official papers)

### Question Paper Layout
- Thin rounded border on every page
- Section title in large bordered box, centred, teal/blue colour (~#3B7EA1)
- Large light-grey question numbers on left margin (~44pt, #CCCCCC)
- Bold teal answer letters (A B C D E)
- Dotted divider lines between questions
- Footer: "Page X" left, "Please go on to the next page >>>" right
- 5 answer options (A-E) for most questions

### 56 Questions in 5 Sections
| Section | Questions | Format |
|---------|-----------|--------|
| Punctuation | Q1–5 | Bracket-segment (A B C D N) |
| Grammar | Q6–10 | Word-choice boxes (A B C D E) |
| Spelling | Q11–15 | Bracket-segment (A B C D N) |
| Comprehension | Q16–28 | MC (16-22) + Written (23-28) |
| Maths | Q29–56 | MC (29-50) + Written (51-56) |

### Question Format Types
1. **Bracket-segment** (Punctuation/Spelling): Sentence divided into 4 labelled segments A/B/C/D with bracket underlines, plus N option for "no mistake"
2. **Word-choice boxes** (Grammar): Partial sentence + row of word boxes labelled A-E
3. **Comprehension MC**: Bold question + vertical A-E option list
4. **Written answer**: Bold question + empty box (answer goes on answer sheet)
5. **Maths MC**: Context text + bold question + horizontal A-E options
6. **"Choose TWO"** (Paper 2 Q17): Numbered sub-list 1-5, then A-E pairings

### Answer Sheet Format (Official SEAG Style)
- **NOT bubble circles** — thin horizontal line through a small rectangle
- Answer text shown alongside each option (e.g. "A 257", "B 353")
- Pupil details at top: Name, School, Candidate Number, School Number, DOB, Date of Test
- Page 1: Header + Practice Qs (P1-P10) + Main English Q1-22
- Page 2: Comprehension Written Q23-28 + Maths Q29-50 + Maths Written Q51-56
- Q1-5 and Q11-15: A B C D N options
- Q6-10 and Q16-22: A B C D E options
- Q29-50: A B C D E with answer text shown
- Q51-56: Written answer boxes with unit hints (kg, minutes, etc.)

## Supabase Connection
- Project ID: `iutcgogmxhaqgaxkznxu`
- The question bank has ~1,167 questions
- Key fields: `question_text`, `options` (JSON array), `correct_answer`, `topic`, `subject`, `year_group`, `difficulty`, `has_diagram`, `diagram_svg`
- Use the service role key from `.env` for server-side queries

## Build Order
1. **Connect to Supabase** — query real questions by section/topic, select correct counts
2. **Fix question paper layout** — double-digit number overlap, instruction text clipping
3. **Add missing formats** — multi-line segments, "Choose TWO", data tables
4. **Diagram rendering** — embed SVG diagrams using svglib
5. **Build answer sheet** — driven by whatever questions were selected
6. **Build parent answer key** — same layout with correct answers filled

## Key Technical Notes
- Use Python + ReportLab for PDF generation
- Run as a script locally (Option A: pre-generate papers, store in Supabase Storage)
- NOT a Vercel serverless function — run on local machine or separate server
- Install: `pip install reportlab svglib supabase-py`
- Output PDFs go to `/printable-tests/output/`

## Known Bugs to Fix in seag_generator.py
- Large question numbers overlap answer letter A on double-digit questions (16, 17...)
- Instruction text clips right margin on some pages
- Comprehension passage line numbering uses wrong font variable
- Maths section doesn't auto-paginate cleanly when questions overflow

## Branding
- Name: STAR AI Tutor
- URL: staraitutor.co.uk
- Colour: #3B7EA1 (teal/blue)
- Replace all "SEAG" / "GL Assessment" references
- Do NOT include any Anthropic or Claude branding