/**
 * rewrite-grammar-questions.mjs
 *
 * Fixes malformed segment-style grammar questions (issues 3 & 4):
 *   - Issue 3: an answer option longer than 6 words (sentence fragments)
 *   - Issue 4: an option that is a gap marker "___" / empty, or empty correct_answer
 *
 * Each flagged question is rewritten by Sonnet into a proper "choose the best word"
 * grammar question: a gap sentence + 5 single-word / short-phrase options (A–E) +
 * correct answer + explanation. Updated in place — nothing is deleted.
 *
 * Usage:
 *   node scripts/rewrite-grammar-questions.mjs            # dry run, first 3, prints before/after
 *   node scripts/rewrite-grammar-questions.mjs --limit 10 # dry run, first 10
 *   node scripts/rewrite-grammar-questions.mjs --apply    # write ALL flagged to DB
 *   node scripts/rewrite-grammar-questions.mjs --apply --limit 25
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { lintQuestion } from './question-contract.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const ANTHROPIC_KEY = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL  = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY   = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const MODEL         = 'claude-sonnet-4-6';

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!SERVICE_KEY)   { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : (APPLY ? Infinity : 3);

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Flag detection (mirrors the investigation) ──────────────────────────────────
function isFlagged(q) {
  const opts = q.options || {};
  const vals = Object.values(opts).filter(v => v != null).map(String);
  const longOpt = vals.some(v => v.trim().split(/\s+/).length > 6);          // issue 3
  const gap = vals.some(v => v.trim() === '___' || v.trim() === '' || v.includes('___'))
              || String(q.correct_answer).trim() === '';                      // issue 4
  return longOpt || gap;
}

// Target the quarantined grammar questions (validated=false, lint-quarantine).
async function fetchFlagged() {
  let all = [], from = 0, size = 1000;
  while (true) {
    const { data, error } = await sb.from('questions')
      .select('id,year_group,difficulty,question_text,options,correct_answer,explanation')
      .eq('topic', 'grammar')
      .eq('validated', false)
      .eq('validator_reason', 'lint-quarantine')
      .order('id')
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return all;
}

// ── Sonnet rewrite ──────────────────────────────────────────────────────────────
const GRAMMAR_POINTS = [
  'subject-verb agreement', 'past simple vs past perfect tense', 'present vs past tense consistency',
  'correct pronoun (I/me/he/him/they/them)', 'possessive pronoun (its/their/whose)',
  'preposition choice (in/on/at/among/between)', 'conjunction choice (although/because/unless/whereas)',
  'article choice (a/an/the)', 'comparative vs superlative adjective', 'adverb vs adjective form',
  'irregular verb form (went/gone, brought, caught)', 'relative pronoun (who/which/that/whose)',
  'quantifier (fewer/less/many/much)', 'correct verb form after a modal (can/must/should)',
];
const THEMES = [
  'a school trip', 'a football match', 'baking in the kitchen', 'a rainy walk to school',
  'a visit to grandparents', 'a science lesson', 'a birthday party', 'a trip to the beach',
  'a library visit', 'gardening', 'a bike ride', 'a museum tour', 'feeding pets', 'a camping trip',
  'a music concert', 'a swimming lesson', 'a snowy morning', 'a market stall', 'a train journey',
];
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function buildPrompt(q) {
  const point = pick(GRAMMAR_POINTS);
  const theme = pick(THEMES);
  return `You are rewriting a broken grammar question for the Northern Ireland SEAG Transfer Test (${q.year_group}, ages 10-11, difficulty ${q.difficulty}/5).

The original question is malformed. Write a NEW, clean "choose the best word" grammar question.

Grammar point to test: ${point}
Sentence context/theme: ${theme} (write an original sentence about this — do NOT reuse a generic template)

Rules:
- question_text: ONE original sentence with a single gap shown as "_____" (five underscores). Make it specific to the theme above, not a stock sentence.
- Exactly 5 options keyed A,B,C,D,E. Each option is a SINGLE WORD or a SHORT phrase of at most 3 words. No sentence fragments.
- Exactly one option is grammatically correct in the gap; the other four are plausible but wrong.
- correct_answer: the single letter (A/B/C/D/E) of the correct option.
- explanation: one short sentence explaining why the answer is correct.
- UK English. No option may be blank or "___".

Return ONLY minified JSON, no markdown:
{"question_text":"...","options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct_answer":"A","explanation":"..."}`;
}

function extractJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/```\s*$/m, '').trim();
  return JSON.parse(cleaned);
}

async function rewriteOne(q) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      temperature: 1,
      messages: [{ role: 'user', content: buildPrompt(q) }],
    }),
  });
  if (!resp.ok) throw new Error('Anthropic HTTP ' + resp.status + ' ' + (await resp.text()).slice(0, 200));
  const json = await resp.json();
  const text = json.content?.[0]?.text || '';
  const parsed = extractJson(text);

  // Validation
  const keys = ['A', 'B', 'C', 'D', 'E'];
  if (!parsed.question_text || !parsed.options) throw new Error('missing fields');
  for (const k of keys) {
    const v = parsed.options[k];
    if (v == null || String(v).trim() === '' || String(v).includes('___')) throw new Error('bad option ' + k);
    if (String(v).trim().split(/\s+/).length > 3) throw new Error('option ' + k + ' too long');
  }
  if (!keys.includes(String(parsed.correct_answer))) throw new Error('bad correct_answer');

  // Shuffle option positions so the correct answer isn't biased toward A/B
  const correctText = parsed.options[String(parsed.correct_answer)];
  const values = keys.map(k => parsed.options[k]);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  const shuffled = {};
  keys.forEach((k, i) => { shuffled[k] = values[i]; });
  parsed.options = shuffled;
  parsed.correct_answer = keys[values.indexOf(correctText)];
  return parsed;
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}   Limit: ${LIMIT}`);
  const flagged = await fetchFlagged();
  console.log(`Flagged grammar questions: ${flagged.length}`);
  const batch = flagged.slice(0, LIMIT === Infinity ? flagged.length : LIMIT);
  console.log(`Processing: ${batch.length}\n`);

  let ok = 0, fail = 0;
  for (let i = 0; i < batch.length; i++) {
    const q = batch[i];
    process.stdout.write(`[${i + 1}/${batch.length}] ${q.id} ... `);
    try {
      let parsed, attempts = 0;
      while (true) {
        try { parsed = await rewriteOne(q); break; }
        catch (e) { if (++attempts >= 3) throw e; }
      }

      const newRow = {
        topic:          'grammar',
        year_group:     q.year_group,
        difficulty:     q.difficulty,
        question_type:  'Multiple_Choice',
        question_text:  parsed.question_text,
        options:        { A: parsed.options.A, B: parsed.options.B, C: parsed.options.C, D: parsed.options.D, E: parsed.options.E },
        correct_answer: String(parsed.correct_answer),
      };

      // Re-lint the rewrite before trusting it — never re-validate a still-broken question
      const violations = lintQuestion(newRow);
      if (violations.length > 0) throw new Error('rewrite still violates contract: ' + violations.join(', '));

      if (APPLY) {
        const { error } = await sb.from('questions').update({
          question_text:    newRow.question_text,
          options:          newRow.options,
          correct_answer:   newRow.correct_answer,
          explanation:      parsed.explanation || null,
          question_type:    'Multiple_Choice',
          validated:        true,
          validator_reason: null,
        }).eq('id', q.id);
        if (error) throw new Error('DB update: ' + error.message);
        console.log('updated + revalidated');
      } else {
        console.log('OK (dry)');
        console.log('   OLD opts:', JSON.stringify(q.options));
        console.log('   NEW Q   :', parsed.question_text);
        console.log('   NEW opts:', JSON.stringify(parsed.options), '  ans=' + parsed.correct_answer);
      }
      ok++;
    } catch (e) {
      console.log('FAIL — ' + e.message);
      fail++;
    }
    await new Promise(r => setTimeout(r, 300)); // gentle rate limit
  }
  console.log(`\nDone. ok=${ok} fail=${fail}${APPLY ? '' : '  (dry run — re-run with --apply to write)'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
