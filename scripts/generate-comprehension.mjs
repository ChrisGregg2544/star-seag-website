/**
 * STAR — Passage-Linked Comprehension Question Generator
 *
 * Uses Sonnet for single-pass generation + validation (established rule).
 * Generates 7 MC + 6 written questions per passage, linked via passage_id.
 *
 * Usage:
 *   node scripts/generate-comprehension.mjs --year P6 --batch 3
 *   node scripts/generate-comprehension.mjs --year P7 --batch 3 --from 3
 *
 * Options:
 *   --year P6|P7   Year group to process (default: P6)
 *   --batch N      How many passages to process then stop (default: 3)
 *   --from N       Skip first N passages in the list (default: 0)
 *   --dry-run      Generate but do not insert — print sample output
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env ──────────────────────────────────────────────────────────────────
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k?.trim() && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const ANTHROPIC_KEY = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL  = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY   = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;

if (!ANTHROPIC_KEY) { console.error('❌  Missing ANTHROPIC_API_KEY in .env'); process.exit(1); }
if (!SERVICE_KEY)   { console.error('❌  Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

// ── CLI args ───────────────────────────────────────────────────────────────────
function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : def;
}
const YEAR    = arg('--year',  'P6');
const BATCH   = parseInt(arg('--batch', '3'), 10);
const FROM    = parseInt(arg('--from',  '0'), 10);
const DRY_RUN = process.argv.includes('--dry-run');

const DELAY_MS = 4000;
const MODEL    = 'claude-sonnet-4-6';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Supabase helpers ───────────────────────────────────────────────────────────
async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function sbInsert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`INSERT ${table} → ${res.status}: ${await res.text()}`);
}

// ── Fetch passages that have no linked v2 questions ────────────────────────────
async function fetchPassages(year) {
  const all = await sbGet(
    `passages?year_group=eq.${year}&select=id,year_group,content&order=id`
  );

  const existing = await sbGet(
    `questions?source=eq.ai_generated_v2&validated=eq.true&topic=eq.comprehension_mc`
    + `&passage_id=not.is.null&select=passage_id`
  );
  const covered = new Set(existing.map(r => r.passage_id));
  return all.filter(p => !covered.has(p.id));
}

// ── Build generate+validate prompt ────────────────────────────────────────────
function buildPrompt(passage) {
  const ageLabel = passage.year_group === 'P6'
    ? 'Primary 6 pupils aged 10 in Northern Ireland'
    : 'Primary 7 pupils aged 11 in Northern Ireland sitting the SEAG Transfer Test';

  return `You are writing reading comprehension questions for the Northern Ireland SEAG Transfer Test.
Audience: ${ageLabel}.

Read this passage in full before writing any questions:

===PASSAGE START===
${passage.content}
===PASSAGE END===

Your task: generate exactly 7 multiple-choice questions and 6 free-response questions based ONLY on this passage. Then validate each question yourself before including it in the output.

GENERATION RULES:
- Every question must refer to something specific in this passage — no generic comprehension questions
- MC questions mirror Q16–Q22 of the real SEAG paper: 5 options (A/B/C/D/E), one correct
- Written questions mirror Q23–Q28: require a 1–3 sentence answer drawn from the passage
- Vary question types: inference, vocabulary in context, author's purpose, fact retrieval, language effect
- Do not start every question with "According to the passage" — vary the phrasing
- Difficulty must match the year group (${passage.year_group})

SELF-VALIDATION: For each question, check ALL of the following before including it:
1. passage_specific — the question cannot be answered without reading this passage
2. answer_correct — the correct answer is unambiguously right; wrong answers are plausible but definitely wrong
3. difficulty_ok — appropriate challenge level for ${passage.year_group} (not too easy, not too hard)
4. distractors_ok — MC distractors are believable but clearly wrong on careful reading

Only include a question in the output if it passes all four checks. If you generate a question that fails any check, discard it and generate a replacement until you have 7 passing MC and 6 passing written.

Return ONLY valid JSON — no markdown fences, no explanation outside the JSON:
{
  "mc": [
    {
      "question_text": "string",
      "options": { "A": "string", "B": "string", "C": "string", "D": "string", "E": "string" },
      "correct_answer": "A",
      "explanation": "One sentence explaining why this answer is correct",
      "checks": { "passage_specific": true, "answer_correct": true, "difficulty_ok": true, "distractors_ok": true }
    }
  ],
  "written": [
    {
      "question_text": "string",
      "model_answer": "Full model answer a marker would accept (2–3 sentences)",
      "checks": { "passage_specific": true, "answer_correct": true, "difficulty_ok": true }
    }
  ]
}`;
}

// ── Call Sonnet ────────────────────────────────────────────────────────────────
async function callSonnet(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type':      'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text.trim();
}

// ── Parse + validate Sonnet response ──────────────────────────────────────────
function parseResponse(raw) {
  const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(json);

  // Filter to only questions that passed all checks
  const mc = (parsed.mc || []).filter(q =>
    q.checks?.passage_specific &&
    q.checks?.answer_correct &&
    q.checks?.difficulty_ok &&
    q.checks?.distractors_ok &&
    q.question_text && q.options && q.correct_answer
  );

  const written = (parsed.written || []).filter(q =>
    q.checks?.passage_specific &&
    q.checks?.answer_correct &&
    q.checks?.difficulty_ok &&
    q.question_text && q.model_answer
  );

  return { mc, written };
}

// ── Build DB rows ──────────────────────────────────────────────────────────────
function buildRows(passage, mc, written) {
  const base = {
    subject:    'english',
    year_group: passage.year_group,
    passage_id: passage.id,
    source:     'ai_generated_v2',
    active:     true,
    validated:  true,
    difficulty: passage.year_group === 'P6' ? 3 : 4,
    times_used: 0,
  };

  return [
    ...mc.slice(0, 7).map(q => ({
      ...base,
      topic:          'comprehension_mc',
      question_type:  'Multiple_Choice',
      question_text:  q.question_text,
      options:        q.options,
      correct_answer: q.correct_answer,
      explanation:    q.explanation || null,
    })),
    ...written.slice(0, 6).map(q => ({
      ...base,
      topic:          'comprehension_written',
      question_type:  'written',
      question_text:  q.question_text,
      options:        null,
      correct_answer: '',
      explanation:    q.model_answer,
    })),
  ];
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60));
  console.log('STAR — Comprehension Question Generator');
  console.log(`Model: ${MODEL}`);
  console.log(`Year: ${YEAR}  |  Batch: ${BATCH}  |  From: ${FROM}${DRY_RUN ? '  |  DRY RUN' : ''}`);
  console.log('═'.repeat(60));

  const allPassages = await fetchPassages(YEAR);
  const batch       = allPassages.slice(FROM, FROM + BATCH);

  console.log(`\nPassages needing questions (${YEAR}): ${allPassages.length}`);
  console.log(`Processing this batch: ${batch.length} (indices ${FROM}–${FROM + batch.length - 1})\n`);

  if (batch.length === 0) {
    console.log('No passages to process. Done.');
    return;
  }

  const results = [];

  for (let i = 0; i < batch.length; i++) {
    const passage = batch[i];
    const preview = passage.content.slice(0, 100).replace(/\n/g, ' ');
    console.log(`─`.repeat(60));
    console.log(`[${i + 1}/${batch.length}] ${YEAR} — ${preview}…`);
    console.log(`Passage ID: ${passage.id}`);

    try {
      const prompt = buildPrompt(passage);
      console.log('  Calling Sonnet (generate + validate)…');
      const raw    = await callSonnet(prompt);
      const { mc, written } = parseResponse(raw);

      console.log(`  MC passed validation:      ${mc.length}/7`);
      console.log(`  Written passed validation: ${written.length}/6`);

      if (mc.length < 7 || written.length < 6) {
        console.warn(`  ⚠ SKIPPED — not enough questions passed validation (need 7 MC + 6 written)`);
        results.push({ id: passage.id, preview: preview.slice(0, 60), status: 'skipped', mc: mc.length, written: written.length });
      } else {
        const rows = buildRows(passage, mc, written);
        if (DRY_RUN) {
          console.log('  [DRY RUN] Sample MC question:');
          console.log('  ', JSON.stringify(mc[0], null, 2).split('\n').join('\n   '));
        } else {
          await sbInsert('questions', rows);
          console.log(`  ✓ Inserted ${rows.length} rows (7 MC + 6 written)`);
        }
        results.push({ id: passage.id, preview: preview.slice(0, 60), status: DRY_RUN ? 'dry-run' : 'inserted', mc: mc.length, written: written.length });
      }
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      results.push({ id: passage.id, preview: preview.slice(0, 60), status: 'error', error: err.message });
    }

    if (i < batch.length - 1) await sleep(DELAY_MS);
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('BATCH COMPLETE — Results:');
  console.log('═'.repeat(60));
  for (const r of results) {
    const icon = r.status === 'inserted' ? '✓' : r.status === 'dry-run' ? '○' : '✗';
    const detail = r.status === 'error' ? r.error : `${r.mc} MC + ${r.written} written`;
    console.log(`  ${icon} [${r.status.toUpperCase()}] ${r.preview}…`);
    console.log(`      ${detail}`);
  }

  const inserted = results.filter(r => r.status === 'inserted').length;
  const skipped  = results.filter(r => r.status === 'skipped').length;
  const errored  = results.filter(r => r.status === 'error').length;
  console.log(`\nInserted: ${inserted}  |  Skipped: ${skipped}  |  Errors: ${errored}`);
  console.log('\nReview the results above before running the next batch.');
  if (!DRY_RUN && allPassages.length > FROM + BATCH) {
    const nextFrom = FROM + BATCH;
    console.log(`Next batch command:`);
    console.log(`  node scripts/generate-comprehension.mjs --year ${YEAR} --batch ${BATCH} --from ${nextFrom}`);
  }
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
