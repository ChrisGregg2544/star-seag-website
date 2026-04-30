/**
 * extract-maths-options.js
 * Extracts A/B/C/D/E option texts from a Catapult PDF for maths questions.
 * Sends the PDF + all pending question texts in one API call per paper,
 * then matches results back by ID and patches reference_questions.
 *
 * Usage: node scripts/extract-maths-options.js "Warm Up 1 (2026).pdf" P6 1
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir    = dirname(fileURLToPath(import.meta.url));
const PAPERS_DIR = resolve(__dir, '../catapult-papers');

// ── .env ──────────────────────────────────────────────────────────────────────
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const ANTHROPIC_KEY  = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL   = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY    = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const SONNET_MODEL   = 'claude-sonnet-4-6';

if (!ANTHROPIC_KEY)  { console.error('Missing ANTHROPIC_API_KEY');        process.exit(1); }
if (!SERVICE_KEY)    { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

// ── Args ───────────────────────────────────────────────────────────────────────
const [, , paperFile, yearGroup, paperNumber] = process.argv;
if (!paperFile || !yearGroup || !paperNumber) {
  console.error('Usage: node scripts/extract-maths-options.js "Warm Up 1 (2026).pdf" P6 1');
  process.exit(1);
}
if (!['P6', 'P7'].includes(yearGroup)) {
  console.error('year_group must be P6 or P7'); process.exit(1);
}

const MATHS_CATEGORIES = [
  'arithmetic', 'geometry', 'fractions_decimals',
  'measurement', 'statistics', 'algebra_sequences',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function supabaseHeaders(extra = {}) {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    ...extra,
  };
}

function extractFirstJson(raw) {
  // Strip markdown code fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```[\s\S]*$/, '')
    .trim();

  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // Brace-counting scan — try array [ before object { since we expect an array
  for (const [open, close] of [['[', ']'], ['{', '}']]) {
    const start = cleaned.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === open)  depth++;
      if (cleaned[i] === close) { depth--; if (depth === 0) { try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { break; } } }
    }
  }
  return null;
}

// ── Supabase ───────────────────────────────────────────────────────────────────
async function fetchPendingQuestions() {
  const cats = MATHS_CATEGORIES.map(c => `"${c}"`).join(',');
  const url  = `${SUPABASE_URL}/rest/v1/reference_questions`
    + `?select=id,question_text,correct_answer`
    + `&year_group=eq.${yearGroup}`
    + `&category=in.(${cats})`
    + `&options=is.null`
    + `&limit=1000`;

  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`Supabase fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function saveOptions(id, options) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reference_questions?id=eq.${id}`,
    {
      method:  'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body:    JSON.stringify({ options }),
    },
  );
  if (!res.ok) throw new Error(`Supabase PATCH failed (${res.status}): ${await res.text()}`);
}

// ── Extraction ─────────────────────────────────────────────────────────────────
async function extractOptionsForPaper(pdfBase64, questions) {
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const questionList = questions
    .map((q, i) => `${i + 1}. [ID:${q.id}]\n${q.question_text}`)
    .join('\n\n');

  const prompt = `You are analysing a SEAG transfer test paper for Northern Ireland pupils (P6/P7, ages 10-11).

The PDF is the question paper. Below is a list of maths questions with IDs. For each question that appears in this PDF, extract its five multiple-choice options (A, B, C, D, E) exactly as printed.

Questions:
${questionList}

Return a JSON array. Include only questions you can find in this PDF:
[
  { "id": "uuid", "options": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." } }
]

Rules:
- Copy option text exactly (including units, symbols, fractions).
- Skip any question not in this paper — do not guess.
- Return ONLY the JSON array. No preamble, no markdown.`;

  const response = await client.beta.messages.create({
    model:      SONNET_MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
        { type: 'text', text: prompt },
      ],
    }],
    betas: ['pdfs-2024-09-25'],
  });

  const raw    = response.content?.[0]?.text || '';
  const parsed = extractFirstJson(raw);

  if (!Array.isArray(parsed)) {
    console.error('Unexpected response format. Raw (500 chars):', raw.slice(0, 500));
    return [];
  }
  return parsed;
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  const paperPath = resolve(PAPERS_DIR, paperFile);
  console.log(`Paper:      ${paperPath}`);
  console.log(`Year group: ${yearGroup}  |  Paper: ${paperNumber}\n`);

  const pdfBase64 = readFileSync(paperPath).toString('base64');

  console.log('Fetching pending maths questions from Supabase...');
  const questions = await fetchPendingQuestions();
  console.log(`Found ${questions.length} maths questions with no options for ${yearGroup}\n`);

  if (!questions.length) {
    console.log('Nothing to do.');
    return;
  }

  console.log(`Sending ${questions.length} questions to Claude with the PDF...`);
  const results = await extractOptionsForPaper(pdfBase64, questions);
  console.log(`Claude returned options for ${results.length} questions\n`);

  // Build lookup map from question ID → options
  const optionsMap = new Map(results.map(r => [r.id, r.options]));

  let saved = 0, skipped = 0, failed = 0;

  for (const q of questions) {
    const options = optionsMap.get(q.id);
    if (!options) { skipped++; continue; }

    // Validate all 5 keys present
    const missing = ['A', 'B', 'C', 'D', 'E'].filter(k => !(k in options));
    if (missing.length) {
      console.log(`  SKIP ${q.id} — missing keys: ${missing.join(', ')}`);
      skipped++;
      continue;
    }

    try {
      await saveOptions(q.id, options);
      console.log(`  OK   ${q.id}  (answer: ${q.correct_answer})`);
      saved++;
    } catch (err) {
      console.log(`  FAIL ${q.id} — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Done.`);
  console.log(`  Saved:   ${saved}`);
  console.log(`  Skipped: ${skipped}  (not in this paper)`);
  console.log(`  Failed:  ${failed}`);
  console.log('═'.repeat(50));
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
