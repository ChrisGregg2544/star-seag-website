/**
 * fix-option-questions.mjs  (E3)
 *
 * Repairs quarantined multiple-choice questions whose ONLY problem is the
 * answer options — a duplicate option, a blank option, or a "___" gap marker.
 * Keeps the question text and the correct answer; asks Sonnet to fix only the
 * offending option(s), re-lints the result against question-contract.mjs, and
 * (on --apply) sets validated=true, validator_reason=null.
 *
 * Scope: independent-choice A–E topics only (maths + vocabulary). Segment-style
 * punctuation/spelling option issues are handled by resegment-punctuation.mjs (E2),
 * and comprehension option issues belong to the regenerate flow (E4).
 *
 * Usage:
 *   node scripts/fix-option-questions.mjs            # dry run, all
 *   node scripts/fix-option-questions.mjs --limit 5  # dry run, first 5
 *   node scripts/fix-option-questions.mjs --apply    # write to DB
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
if (!ANTHROPIC_KEY || !SERVICE_KEY) { console.error('Missing keys'); process.exit(1); }

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// A–E independent-choice topics only (never segment-style, never comprehension).
const TARGET_TOPICS = ['vocabulary', 'arithmetic', 'geometry', 'fractions_decimals', 'measurement', 'statistics', 'algebra_sequences'];
const OPT_RULE = /^(duplicate-options|empty-option|gap-marker-in-option)/;

// Only take quarantined questions whose sole issue is the options.
async function fetchTargets() {
  let all = [], from = 0, size = 1000;
  while (true) {
    const { data, error } = await sb.from('questions')
      .select('id,topic,year_group,difficulty,question_type,question_text,options,correct_answer,explanation')
      .in('topic', TARGET_TOPICS)
      .eq('validated', false)
      .eq('validator_reason', 'lint-quarantine')
      .order('id')
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return all.filter(q => {
    const v = lintQuestion(q);
    return v.length > 0 && v.every(r => OPT_RULE.test(r));
  });
}

const SYSTEM = 'You are a precise JSON API for a UK SEAG exam question bank. Output ONLY the requested minified JSON object — no preamble, no explanation, no code fences.';

function buildPrompt(q) {
  const ans = String(q.correct_answer).toUpperCase();
  const o = q.options || {};
  const optLines = ['A', 'B', 'C', 'D', 'E'].map(k => `${k}: ${JSON.stringify(o[k] ?? '')}`).join('\n');
  return `A SEAG multiple-choice question (${q.topic}, ${q.year_group}, ages 10-11) has a problem with its ANSWER OPTIONS (a duplicate, a blank, or a "___" gap). Fix ONLY the options.

Question: ${q.question_text}
Current options:
${optLines}
Correct answer: ${ans} = ${JSON.stringify(o[ans] ?? '')}

Rules:
- Keep option ${ans} EXACTLY as it is — it is the correct answer and must stay correct and unchanged.
- Replace any blank option, any option containing "___", and any option that DUPLICATES another with a NEW, distinct, plausible-but-WRONG answer.
- Exactly 5 options keyed A,B,C,D,E. All non-empty, all DISTINCT from each other, none containing "___".
- Only option ${ans} is correct; the other four must be clearly wrong but believable (for maths, use realistic wrong results / common mistakes; keep units and format consistent with the correct answer).

Return ONLY minified JSON: {"options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct_answer":"${ans}"}`;
}

function extractJson(raw) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  let last = null;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < cleaned.length; j++) {
      const c = cleaned[j];
      if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; }
      else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { try { last = JSON.parse(cleaned.slice(i, j + 1)); } catch {} break; } }
    }
  }
  if (last === null) throw new Error(`No JSON in: ${raw.slice(0, 80)}`);
  return last;
}

async function fixOne(q) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system: SYSTEM, messages: [{ role: 'user', content: buildPrompt(q) }] }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text()).slice(0, 200));
  const parsed = extractJson((await resp.json()).content?.[0]?.text || '');

  const ans = String(q.correct_answer).toUpperCase();
  const keys = ['A', 'B', 'C', 'D', 'E'];
  const o = parsed.options || {};
  // The correct option's value must be preserved exactly
  if (String(o[ans] ?? '').trim() !== String(q.options?.[ans] ?? '').trim()) {
    throw new Error('correct option value was altered');
  }
  if (String(parsed.correct_answer).toUpperCase() !== ans) throw new Error('answer letter changed');
  const newRow = {
    topic: q.topic, year_group: q.year_group, difficulty: q.difficulty,
    question_type: q.question_type || 'Multiple_Choice',
    question_text: q.question_text,
    options: Object.fromEntries(keys.map(k => [k, o[k]])),
    correct_answer: ans,
  };
  const violations = lintQuestion(newRow);
  if (violations.length > 0) throw new Error('still violates contract: ' + violations.join(', '));
  return newRow;
}

// ── Independent verifier — catches semantic problems the lint can't (e.g. a
// replacement distractor that is a near-synonym / equivalent of the answer) ──────
function buildVerifyPrompt(q, row) {
  const ans = row.correct_answer;
  const optLines = ['A', 'B', 'C', 'D', 'E'].map(k => `${k}: ${JSON.stringify(row.options[k])}`).join('\n');
  return `You are a strict SEAG examiner (${q.topic}, ${q.year_group}, ages 10-11). Here is a multiple-choice question with its options.

Question: ${q.question_text}
${optLines}
Claimed correct answer: ${ans} = ${JSON.stringify(row.options[ans])}

Check harshly:
- Option ${ans} is genuinely correct for this question.
- Each of the OTHER four options is clearly and unambiguously WRONG — none is a synonym, an equivalent value, or otherwise an also-acceptable answer.
- There is EXACTLY ONE correct option.

Return ONLY minified JSON: {"valid":true} if every check passes, otherwise {"valid":false,"reason":"short reason"}.`;
}

async function verify(q, row) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, system: SYSTEM, messages: [{ role: 'user', content: buildVerifyPrompt(q, row) }] }),
  });
  if (!resp.ok) throw new Error('verify HTTP ' + resp.status);
  return extractJson((await resp.json()).content?.[0]?.text || '');
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}   Limit: ${LIMIT}`);
  const targets = await fetchTargets();
  console.log(`Option-only quarantined questions: ${targets.length}\n`);
  const batch = targets.slice(0, LIMIT === Infinity ? targets.length : LIMIT);

  let applied = 0, unverified = 0, fail = 0;
  for (let i = 0; i < batch.length; i++) {
    const q = batch[i];
    process.stdout.write(`[${i + 1}/${batch.length}] ${q.topic} ${q.id} ans=${q.correct_answer} ... `);
    try {
      // Fix options (structural + re-lint), then verify semantics independently. Retry up to 3x.
      let row = null, verdict = null;
      for (let attempt = 0; attempt < 3 && !row; attempt++) {
        let cand;
        try { cand = await fixOne(q); } catch { continue; }
        let v;
        try { v = await verify(q, cand); } catch { v = { valid: false, reason: 'verify error' }; }
        if (v.valid) row = cand;
        else verdict = v;
      }

      if (!row) {
        unverified++;
        console.log(`UNVERIFIED → left quarantined (${verdict?.reason || 'no clean fix'})`);
      } else if (APPLY) {
        const { error } = await sb.from('questions').update({
          options: row.options,
          validated: true,
          validator_reason: null,
        }).eq('id', q.id);
        if (error) throw new Error('DB: ' + error.message);
        applied++;
        console.log('VERIFIED → revalidated');
      } else {
        console.log('VERIFIED (dry)');
        console.log('   OLD: ' + JSON.stringify(q.options));
        console.log('   NEW: ' + JSON.stringify(row.options) + '  ans=' + row.correct_answer);
      }
    } catch (e) {
      console.log('FAIL — ' + e.message);
      fail++;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\nDone. verified=${applied} unverified=${unverified} errors=${fail}${APPLY ? '' : '  (dry run — re-run with --apply to write)'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
