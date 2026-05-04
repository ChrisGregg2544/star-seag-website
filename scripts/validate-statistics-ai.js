/**
 * validate-statistics-ai.js
 * Runs the same Claude validator logic as validate.html against all
 * validated statistics questions. Uses claude-haiku-4-5 for cost control.
 *
 * Usage:
 *   node scripts/validate-statistics-ai.js
 *   PREVIEW=1 node scripts/validate-statistics-ai.js   ← count only, no API calls
 *   LIMIT=50   node scripts/validate-statistics-ai.js   ← cap at N questions
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const SUPABASE_URL    = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY     = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY   = envVars.ANTHROPIC_API_KEY;
const PREVIEW         = process.env.PREVIEW === '1';
const LIMIT           = process.env.LIMIT ? parseInt(process.env.LIMIT) : Infinity;
const PAGE_SIZE       = 200;
const DELAY_MS        = 400;   // between API calls
const CONCURRENCY     = 3;     // parallel Claude calls

if (!SERVICE_KEY)   { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }
if (!PREVIEW && !ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY in .env'); process.exit(1); }

const sbHeaders = {
  apikey:        SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// ── Statistics standard (from validate.html) ──────────────────────────────────
const STATISTICS_STANDARD = `REAL CATAPULT PAPERS STATISTICS STANDARD:
Pictograms: establish symbol value first from given data, then calculate.
Bar/line graphs: read values carefully (each interval may represent 2 or more units), find differences and totals.
Mean: add all values then divide by count. Distance-time graphs: horizontal section = stationary.
Pie charts: sector angles (360°÷total×frequency). Probability: certain/likely/unlikely/impossible language.
Real example: "Wednesday had 8 meals served, 2 plates shown in pictogram, so 1 plate = 4 meals. Friday shows 4.5 plates = 18 meals."
P6: straightforward chart reading. P7: multi-step, calculate missing values, interpret trends.`;

const DIAGRAM_NOTE = `\nDIAGRAM RULE FOR STATISTICS QUESTIONS:
Some statistics questions require a visual diagram (bar chart, pie chart, pictogram, line graph) to be answerable.
These are valid questions — diagrams are stored separately.
If a question CANNOT be answered from the text alone because it requires reading a specific chart value that is not given in the text, give WARN with reason "requires diagram reading". Do NOT give FAIL for this reason.
If the question IS self-contained (all values given in text, no visual reading needed), evaluate it normally.
Only FAIL a statistics question if the correct answer is mathematically wrong.\n`;

function buildPrompt(q) {
  const optionsText = q.options
    ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join('\n')
    : 'Written answer (no options)';

  return `You are a quality checker for a Northern Ireland SEAG Transfer Test preparation platform (British English).

Check this question against the REAL Catapult Papers standard:

${STATISTICS_STANDARD}
${DIAGRAM_NOTE}
QUESTION:
Subject: maths | Topic: statistics | Year: ${q.year_group} | Difficulty: ${q.difficulty}/5

Question text:
${q.question_text}

Options:
${optionsText}

Correct answer: ${q.correct_answer}
Explanation: ${q.explanation || 'none'}

VERDICT CRITERIA:
PASS = correct answer is unambiguous, format matches real Catapult Papers, tests the right statistics concept for ${q.year_group}, difficulty appropriate, explanation accurate
WARN = minor issues (slightly awkward wording, explanation a bit long) but question is usable; OR requires diagram to answer
FAIL = mathematically wrong answer, correct answer key points to wrong option, wildly wrong difficulty

Do all reasoning silently. Output ONLY the JSON object below — no text before or after:
{"verdict":"PASS|WARN|FAIL","reason":"max 8 words"}`;
}

async function askClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':       'application/json',
      'x-api-key':          ANTHROPIC_KEY,
      'anthropic-version':  '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw  = data.content?.[0]?.text?.trim() || '';
  const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  const m    = json.match(/\{[\s\S]*\}/);
  if (!m) throw new Error(`No JSON in: ${raw.slice(0, 200)}`);
  const result = JSON.parse(m[0]);
  if (!['PASS', 'WARN', 'FAIL'].includes(result.verdict)) throw new Error(`Bad verdict: ${result.verdict}`);
  return result;
}

async function fetchPage(offset) {
  const url = `${SUPABASE_URL}/rest/v1/questions`
    + `?topic=eq.statistics`
    + `&validated=eq.true`
    + `&select=id,year_group,difficulty,question_text,options,correct_answer,explanation`
    + `&limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// Process N items concurrently
async function processBatch(items, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
    if (i + CONCURRENCY < items.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }
  return results;
}

async function main() {
  console.log(`validate-statistics-ai   PREVIEW=${PREVIEW}  LIMIT=${LIMIT === Infinity ? 'none' : LIMIT}\n`);

  // Fetch all statistics questions
  let allRows = [];
  let offset = 0;
  while (true) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;
    allRows.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (LIMIT < Infinity) allRows = allRows.slice(0, LIMIT);

  console.log(`Fetched ${allRows.length} validated statistics questions.\n`);

  if (PREVIEW) {
    console.log('PREVIEW mode — no API calls made.');
    console.log(`Estimated cost (claude-haiku-4-5): ~$${(allRows.length * 0.0015).toFixed(2)}`);
    return;
  }

  const counts = { PASS: 0, WARN: 0, FAIL: 0, ERROR: 0 };
  const warns = [];
  const fails = [];
  let done = 0;

  await processBatch(allRows, async (row) => {
    try {
      const result = await askClaude(buildPrompt(row));
      counts[result.verdict]++;
      done++;

      if (result.verdict === 'WARN') {
        warns.push({ id: row.id, year_group: row.year_group, reason: result.reason, q: row.question_text.slice(0, 70) });
      }
      if (result.verdict === 'FAIL') {
        fails.push({ id: row.id, year_group: row.year_group, reason: result.reason, q: row.question_text.slice(0, 70), correct: row.correct_answer, options: row.options });
      }

      if (done % 50 === 0) {
        console.log(`  ${done}/${allRows.length}  PASS=${counts.PASS}  WARN=${counts.WARN}  FAIL=${counts.FAIL}  ERR=${counts.ERROR}`);
      }
    } catch (e) {
      counts.ERROR++;
      console.error(`  ERR ${row.id} — ${e.message}`);
    }
  });

  console.log('\n── Results ──────────────────────────────────────────');
  console.log(`  Total   : ${allRows.length}`);
  console.log(`  PASS    : ${counts.PASS}  (${Math.round(counts.PASS/allRows.length*100)}%)`);
  console.log(`  WARN    : ${counts.WARN}  (${Math.round(counts.WARN/allRows.length*100)}%)`);
  console.log(`  FAIL    : ${counts.FAIL}  (${Math.round(counts.FAIL/allRows.length*100)}%)`);
  console.log(`  Errors  : ${counts.ERROR}`);

  if (fails.length > 0) {
    console.log('\n── FAIL questions ───────────────────────────────────');
    for (const f of fails) {
      console.log(`  ${f.id}  [${f.year_group}]`);
      console.log(`  Q: ${f.q}`);
      console.log(`  Correct: ${f.correct}   Options: ${JSON.stringify(f.options)}`);
      console.log(`  Reason: ${f.reason}`);
      console.log('');
    }
  }

  if (warns.length > 0) {
    console.log('\n── WARN questions (first 20) ────────────────────────');
    for (const w of warns.slice(0, 20)) {
      console.log(`  ${w.id}  [${w.year_group}]  ${w.reason}`);
      console.log(`  Q: ${w.q}`);
      console.log('');
    }
    if (warns.length > 20) console.log(`  ... and ${warns.length - 20} more WARNs`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
