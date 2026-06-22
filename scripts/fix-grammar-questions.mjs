import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SUPA_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const GAP = /_+|\[[ _]*\]|\(\s*\)|\.\.\./;
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1200;

async function fetchPage(offset, size) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/questions?select=id,question_text,options,correct_answer,explanation,year_group&subject=eq.english&topic=eq.grammar&validated=eq.true`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Range: `${offset}-${offset + size - 1}` } }
  );
  return r.json();
}

async function fetchAll() {
  let all = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await fetchPage(offset, 500);
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    if (rows.length < 500) break;
  }
  return all;
}

async function updateRow(id, fields) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/questions?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fields),
    }
  );
  if (!r.ok && r.status !== 204) {
    const text = await r.text();
    throw new Error(`DB update failed (${r.status}): ${text}`);
  }
}

function buildPrompt(q) {
  return `You are rewriting a grammar question for the Northern Ireland SEAG Transfer Test (${q.year_group}, ages 10-11).

This question was generated in the WRONG FORMAT — it looks like a punctuation/error-spotting question where a complete sentence is split into segments A/B/C/D with an N="No mistake" option. Convert it to a proper grammar FILL-IN-THE-BLANK format.

RULES:
- Write a sentence containing ___ exactly once where the tested word/phrase goes
- Provide exactly 5 options: A, B, C, D, E — each a single word or short phrase (2-4 words max)
- One option is clearly correct; the other four are plausible distractors testing the same grammar concept
- No N option, no "No mistake"
- Language appropriate for age 10-11
- Preserve the grammar concept from the explanation

ORIGINAL QUESTION:
Question text: ${q.question_text}
Options: ${JSON.stringify(q.options)}
Correct answer: ${q.correct_answer}
Explanation: ${q.explanation || 'No explanation provided'}

Return ONLY valid JSON, no markdown:
{"question_text":"sentence with ___ in it","options":{"A":"word1","B":"word2","C":"word3","D":"word4","E":"word5"},"correct_answer":"A","explanation":"one sentence explanation"}`;
}

function isValidRewrite(result) {
  if (typeof result !== 'object' || !result) return false;
  if (!result.question_text || !GAP.test(result.question_text)) return false;
  const opts = result.options;
  if (!opts || typeof opts !== 'object') return false;
  const keys = Object.keys(opts);
  if (keys.length !== 5) return false;
  if (!['A','B','C','D','E'].every(k => k in opts)) return false;
  if ('N' in opts) return false;
  if (!['A','B','C','D','E'].includes(result.correct_answer)) return false;
  const vals = Object.values(opts);
  if (vals.some(v => !v || typeof v !== 'string' || v.length > 60)) return false;
  return true;
}

async function rewriteOne(q) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: buildPrompt(q) }],
  });
  const raw = msg.content[0].text.trim();
  // Strip markdown fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const allRows = await fetchAll();
const wrongFormat = allRows.filter(r => !GAP.test(r.question_text) && r.options && 'N' in r.options);

console.log(`Total validated grammar questions fetched: ${allRows.length}`);
console.log(`Wrong-format to fix: ${wrongFormat.length}`);
console.log(`Batch size: ${BATCH_SIZE} | Delay between batches: ${BATCH_DELAY_MS}ms`);
console.log(`Estimated batches: ${Math.ceil(wrongFormat.length / BATCH_SIZE)}\n`);

let passed = 0;
let failed = 0;
let parseErrors = 0;
const failures = [];

for (let b = 0; b < wrongFormat.length; b += BATCH_SIZE) {
  const batch = wrongFormat.slice(b, b + BATCH_SIZE);
  const batchNum = Math.floor(b / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(wrongFormat.length / BATCH_SIZE);
  process.stdout.write(`Batch ${batchNum}/${totalBatches} (${b + 1}–${Math.min(b + BATCH_SIZE, wrongFormat.length)})... `);

  const results = await Promise.allSettled(
    batch.map(q => rewriteOne(q).then(result => ({ q, result })))
  );

  let batchPass = 0;
  let batchFail = 0;

  for (const r of results) {
    if (r.status === 'rejected') {
      parseErrors++;
      batchFail++;
      failures.push({ id: r.reason?.id || '?', error: String(r.reason) });
      continue;
    }
    const { q, result } = r.value;
    if (!isValidRewrite(result)) {
      parseErrors++;
      batchFail++;
      failures.push({ id: q.id, error: 'Invalid rewrite: ' + JSON.stringify(result).substring(0, 120) });
      continue;
    }
    try {
      await updateRow(q.id, {
        question_text: result.question_text,
        options: result.options,
        correct_answer: result.correct_answer,
        explanation: result.explanation,
      });
      passed++;
      batchPass++;
    } catch (e) {
      failed++;
      batchFail++;
      failures.push({ id: q.id, error: e.message });
    }
  }

  console.log(`✓${batchPass} ✗${batchFail}`);

  if (b + BATCH_SIZE < wrongFormat.length) {
    await new Promise(res => setTimeout(res, BATCH_DELAY_MS));
  }
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`DONE`);
console.log(`  Updated:     ${passed}`);
console.log(`  Parse/AI err: ${parseErrors}`);
console.log(`  DB errors:   ${failed}`);
console.log(`  Total failed: ${failures.length}`);

if (failures.length > 0) {
  console.log('\nFailed IDs:');
  failures.forEach(f => console.log(`  ${f.id} — ${f.error.substring(0, 100)}`));
}
