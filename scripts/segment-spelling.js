/**
 * segment-spelling.js
 * Similar to segment-punctuation.js but for spelling category.
 * Adds A/B/C/D/N segment options to spelling reference questions
 * that have no options yet.
 *
 * Usage: node scripts/segment-spelling.js
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

const ANTHROPIC_KEY = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL  = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY   = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!SERVICE_KEY)   { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-sonnet-4-6';

function supabaseHeaders(extra = {}) {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    ...extra,
  };
}

async function fetchQuestions() {
  const url = `${SUPABASE_URL}/rest/v1/reference_questions`
    + `?select=id,question_text,correct_answer,explanation`
    + `&category=eq.spelling`
    + `&options=is.null`
    + `&limit=1000`;

  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase fetch failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

function validateOptions(options) {
  const required = ['A', 'B', 'C', 'D', 'N'];
  const missing = required.filter(k => !(k in options));
  if (missing.length) throw new Error(`Options missing keys: ${missing.join(', ')}`);
  if (options.N !== 'No mistake') throw new Error(`N must be "No mistake", got: "${options.N}"`);
}

async function segmentQuestion(question_text, correct_answer, explanation) {
  const prompt = `You are a JSON generator. Return ONLY valid JSON, no other text.
Segment this SEAG spelling question into A/B/C/D/N parts.

Question: ${question_text}
Correct answer: ${correct_answer}
Explanation: ${explanation}

CRITICAL: Response MUST include all 5 keys: A, B, C, D, N
The N option is ALWAYS "No mistake" regardless of the answer.

{
  "A": "segment text",
  "B": "segment text",
  "C": "segment text",
  "D": "segment text",
  "N": "No mistake"
}

Rules: segments must be consecutive parts of the sentence. All words must appear in exactly one segment. The segment containing the error is ${correct_answer}.

Return ONLY the JSON object. No explanation, no markdown, no code fences. Just the JSON.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 1000,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error');

  const raw = (data.content?.[0]?.text || '')
    .replace(/^```json\s*/i, '')
    .replace(/```[\s\S]*$/, '')
    .trim();

  // 1. Direct parse
  try { return JSON.parse(raw); } catch { /* fall through */ }

  // 2. Trim trailing content after last }
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace !== -1) {
    try { return JSON.parse(raw.slice(0, lastBrace + 1)); } catch { /* fall through */ }
  }

  // 3. Regex extract first {...} block
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }

  throw new Error(`No JSON found in response: ${raw.slice(0, 200)}`);
}

async function saveOptions(id, options) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reference_questions?id=eq.${id}`,
    {
      method:  'PATCH',
      headers: supabaseHeaders({ 'Prefer': 'return=minimal' }),
      body:    JSON.stringify({ options }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase update failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

async function main() {
  console.log('Fetching spelling reference questions with no options...');
  const questions = await fetchQuestions();
  console.log(`Found ${questions.length} questions to segment.\n`);

  if (!questions.length) {
    console.log('Nothing to do.');
    return;
  }

  let passed = 0, failed = 0;

  for (const q of questions) {
    process.stdout.write(`[${passed + failed + 1}/${questions.length}] ${q.id} ... `);
    try {
      const options = await segmentQuestion(q.question_text, q.correct_answer, q.explanation || '');
      validateOptions(options);
      await saveOptions(q.id, options);
      console.log(`OK (answer: ${q.correct_answer})`);
      passed++;
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      failed++;
    }

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\nDone. ${passed} segmented, ${failed} failed.`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
