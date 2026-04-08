/**
 * fill-questions.mjs
 * Generates questions for thin topics and inserts into Supabase.
 * Reads ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY from ../.env
 *
 * Usage: node scripts/fill-questions.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env ──────────────────────────────────────────────────────────────
const envPath = resolve(__dir, '../.env');
const envVars = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const ANTHROPIC_KEY  = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL   = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY    = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_KEY)  { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!SERVICE_KEY)    { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

// ── Targets & current counts ───────────────────────────────────────────────
const TARGETS = [
  // maths
  { topic: 'algebra_sequences',  subject: 'maths',   year: 'P6', target: 30, current: 10 },
  { topic: 'algebra_sequences',  subject: 'maths',   year: 'P7', target: 40, current: 11 },
  { topic: 'statistics',         subject: 'maths',   year: 'P6', target: 30, current: 10 },
  { topic: 'statistics',         subject: 'maths',   year: 'P7', target: 40, current: 12 },
  { topic: 'measurement',        subject: 'maths',   year: 'P6', target: 30, current: 10 },
  { topic: 'measurement',        subject: 'maths',   year: 'P7', target: 40, current: 14 },
  { topic: 'arithmetic',         subject: 'maths',   year: 'P6', target: 30, current: 15 },
  { topic: 'fractions_decimals', subject: 'maths',   year: 'P6', target: 30, current: 15 },
  { topic: 'geometry',           subject: 'maths',   year: 'P6', target: 30, current: 15 },
  // english
  { topic: 'vocabulary',         subject: 'english', year: 'P6', target: 20, current: 10 },
  { topic: 'vocabulary',         subject: 'english', year: 'P7', target: 20, current: 10 },
];

// ── Prompt helpers ─────────────────────────────────────────────────────────
const SYSTEM = `You are a professional SEAG Transfer Test examiner for Northern Ireland.
Generate original exam-quality questions for P6/P7 pupils (ages 10-11).
Every scenario, number, and sentence must be entirely original — never copy from any published paper.
UK English spelling only.
Return ONLY valid raw JSON — no markdown, no code fences.`;

function mathsPrompt(topic, year, n) {
  const levelNote = year === 'P6'
    ? 'P6: whole numbers, basic fractions, decimals to 2dp, simple percentages (10/25/50/75%), metric units, time, money up to £10.'
    : 'P7: all number ops, percentages of amounts, fractions/decimals/percentages, ratio/proportion, negative numbers, metric conversion, 24-hour clock, probability, algebra with letters.';

  const topicNote = {
    algebra_sequences:  year === 'P6'
      ? 'number sequences (add/subtract/multiply rules), simple function machines, missing numbers in patterns'
      : 'sequences with mixed rules, two-step function machines, simple algebraic expressions with letters, finding the rule',
    statistics:         year === 'P6'
      ? 'reading bar charts and pictograms, simple tallies, most/least popular, total from chart'
      : 'reading line graphs and pie charts, calculating mean/range, Venn diagrams, probability fractions',
    measurement:        year === 'P6'
      ? 'reading scales, converting between m/cm/km and kg/g and L/ml, telling time, reading timetables, perimeter of simple shapes'
      : 'metric conversions (multi-step), reading complex timetables, area/perimeter of composite shapes, volume by counting cubes',
    arithmetic:         year === 'P6'
      ? 'addition/subtraction of 3-4 digit numbers, multiplication tables up to 12×, short division, word problems with money'
      : 'multi-step word problems, long multiplication/division',
    fractions_decimals: year === 'P6'
      ? 'fractions of amounts (½ ¼ ⅓ ⅛), simple equivalent fractions, ordering fractions, decimal place value, adding/subtracting decimals'
      : 'fractions/decimals/percentages equivalence, multiplying fractions by whole numbers, ratio/proportion',
    geometry:           year === 'P6'
      ? 'naming 2D/3D shapes and their properties, lines of symmetry, right angles, parallel/perpendicular lines, simple coordinates in first quadrant'
      : 'angles in shapes, reflection, translation, coordinates (first quadrant), properties of quadrilaterals and triangles',
  }[topic] || topic;

  return `Generate exactly ${n} MATHS MULTIPLE CHOICE questions about "${topic}" for ${year}.
${levelNote}
Topic focus: ${topicNote}
Each question has exactly 5 options A/B/C/D/E.
Pre-calculate every answer twice. The correct answer MUST appear among the options.
Vary difficulty across the batch — some easy (difficulty 1-2), some harder (difficulty 3-4).
For each question, include a "difficulty" field (integer 1-4).
Return {"questions": [{"difficulty": 1, "question_text": "...", "options": {"A":"...","B":"...","C":"...","D":"...","E":"..."}, "correct_answer": "A", "explanation": "...", "hint": "..."}, ...]}`;
}

function vocabularyPrompt(year, n) {
  const levelNote = year === 'P6'
    ? 'Age-appropriate vocabulary, concrete meanings, short passages ~60-80 words'
    : 'Wider vocabulary including some abstract words, slightly longer passages ~80-100 words';
  return `Generate exactly ${n} VOCABULARY multiple choice questions for ${year} pupils.
${levelNote}
Each question: write a short original prose passage, then ask ONE vocabulary question about a word in it.
Question types (vary across the batch):
- "Find a word in the passage that means X" (give a synonym definition)
- "What does the word X mean in this passage?" (give 5 meaning options)
- "Which word is closest in meaning to X as used in the passage?"
Each question has exactly 5 options A/B/C/D/E (single words or short phrases).
Passages must feature: animals, nature, school, sport, science, history, or hobbies — age-appropriate.
Vary difficulty 1-4. Include "difficulty" field.
The passage must be embedded in "question_text" — include it before the question itself.
Return {"questions": [{"difficulty": 2, "question_text": "Read the passage below...\n\n[passage]\n\n[question]", "options": {"A":"...","B":"...","C":"...","D":"...","E":"..."}, "correct_answer": "B", "explanation": "...", "hint": "..."}, ...]}`;
}

// ── Call Anthropic ─────────────────────────────────────────────────────────
async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  if (Array.isArray(parsed)) return parsed;
  return parsed.questions || parsed;
}

// ── Insert into Supabase ───────────────────────────────────────────────────
async function insertQuestions(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
    method: 'POST',
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase insert ${res.status}: ${txt.slice(0, 300)}`);
  }
}

// ── Convert Claude output → DB row ────────────────────────────────────────
function toRow(q, topic, subject, year) {
  // Normalise options: accept array or object, always store as object {A,B,C,D,E}
  let opts = q.options || {};
  if (Array.isArray(opts)) {
    const keys = ['A', 'B', 'C', 'D', 'E'];
    const obj = {};
    opts.forEach((v, i) => { if (keys[i]) obj[keys[i]] = v; });
    opts = obj;
  }
  return {
    subject,
    topic,
    year_group:     year,
    difficulty:     Math.min(4, Math.max(1, parseInt(q.difficulty) || 2)),
    question_type:  'mc',
    question_text:  (q.question_text || q.text || '').trim(),
    options:        opts,
    correct_answer: (q.correct_answer || q.answer || '').trim().toUpperCase(),
    explanation:    (q.explanation || '').trim(),
    source:         'ai_generated_v3',
    validated:      false,
    passage:        null,
    diagram:        null,
    times_used:     0,
  };
}

// ── Verify correct answer is in options ───────────────────────────────────
function isValid(row) {
  if (!row.question_text || !row.correct_answer) return false;
  const opts = row.options;
  if (!opts || !opts[row.correct_answer]) {
    console.warn(`  ⚠ Skipping — correct_answer "${row.correct_answer}" not in options`);
    return false;
  }
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  let totalInserted = 0;

  for (const t of TARGETS) {
    const needed = t.target - t.current;
    if (needed <= 0) {
      console.log(`✓ ${t.topic} ${t.year} already at target (${t.current})`);
      continue;
    }

    console.log(`\n→ ${t.topic} ${t.year}: need ${needed} more (have ${t.current}, target ${t.target})`);

    // Generate in batches of 10 (or remaining if < 10)
    let remaining = needed;
    while (remaining > 0) {
      const batchSize = Math.min(10, remaining);
      const prompt = t.subject === 'english'
        ? vocabularyPrompt(t.year, batchSize)
        : mathsPrompt(t.topic, t.year, batchSize);

      let questions;
      try {
        questions = await callClaude(prompt);
        console.log(`  Claude returned ${questions.length} questions`);
      } catch (err) {
        console.error(`  ✗ Claude error: ${err.message}`);
        break;
      }

      const rows = questions
        .map(q => toRow(q, t.topic, t.subject, t.year))
        .filter(isValid);

      if (rows.length === 0) {
        console.warn(`  ✗ No valid rows after filtering`);
        break;
      }

      try {
        await insertQuestions(rows);
        console.log(`  ✓ Inserted ${rows.length}`);
        totalInserted += rows.length;
        remaining -= rows.length;
      } catch (err) {
        console.error(`  ✗ Insert error: ${err.message}`);
        break;
      }

      // Small delay to avoid rate limits
      if (remaining > 0) await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n✅ Done. Total inserted: ${totalInserted}`);
}

main().catch(err => { console.error(err); process.exit(1); });
