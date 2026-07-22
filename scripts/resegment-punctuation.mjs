/**
 * resegment-punctuation.mjs
 *
 * Bug 4: ~43 punctuation questions have overlapping / duplicated segments
 * (e.g. segment D repeats part of segment A). They have no `passage` to
 * re-split from, so each intended sentence must be reconstructed and re-cut
 * into 4 clean, non-overlapping consecutive segments A/B/C/D, preserving the
 * single punctuation mistake in the correct-answer segment. Updated in place.
 *
 * Usage:
 *   node scripts/resegment-punctuation.mjs            # dry run, prints before/after for all
 *   node scripts/resegment-punctuation.mjs --limit 5  # dry run, first 5
 *   node scripts/resegment-punctuation.mjs --apply     # write to DB
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

// ── Overlap detection (same as investigation) ───────────────────────────────────
function isBroken(q) {
  const o = q.options || {};
  const segs = ['A', 'B', 'C', 'D'].map(k => (o[k] || '').trim());
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    if (i === j) continue;
    const a = segs[i], b = segs[j];
    if (!a || !b) continue;
    if (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a))) return true;
    const aw = a.split(/\s+/);
    for (let k = 0; k + 3 <= aw.length; k++) {
      const tri = aw.slice(k, k + 3).join(' ');
      if (tri.length > 8 && b.includes(tri)) return true;
    }
  }
  return false;
}

async function fetchBroken() {
  let all = [], from = 0, size = 1000;
  while (true) {
    const { data, error } = await sb.from('questions')
      .select('id,year_group,options,correct_answer,explanation')
      .eq('topic', 'punctuation').eq('validated', true).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return all.filter(isBroken);
}

const SYSTEM = 'You are a precise JSON API for a UK SEAG exam question bank. Output ONLY the requested minified JSON object — no preamble, no explanation, no code fences.';

function buildPrompt(q) {
  const o = q.options || {};
  const ans = String(q.correct_answer).toUpperCase();
  const segs = ['A', 'B', 'C', 'D'].map(k => `${k}: ${JSON.stringify(o[k] || '')}`).join('\n');
  const ansDesc = ans === 'N'
    ? 'The intended answer is N (No mistake) — the reconstructed sentence must be fully correct with NO punctuation errors.'
    : `The intended answer is ${ans} — segment ${ans} must contain exactly ONE punctuation/capitalisation mistake, and the other three segments must be correct.`;

  return `A SEAG "find the punctuation mistake" question has broken segments — they overlap or duplicate each other. Reconstruct it cleanly.

Current (broken) segments:
${segs}

${ansDesc}

Task:
1. Work out the single intended sentence these segments were trying to represent.
2. Split it into EXACTLY 4 consecutive, NON-overlapping segments A, B, C, D. Concatenating A+B+C+D (with single spaces) must reproduce the whole sentence once, with no word repeated across segments. Every segment must be a real part of the sentence — NEVER put "No mistake" or a placeholder as a segment.
3. Keep it age-appropriate (P6/P7, ages 10-11), wholesome, everyday topics. UK English.
${ans === 'N'
  ? '4. The sentence must be PERFECTLY punctuated with NO errors of any kind (answer N).'
  : `4. Introduce EXACTLY ONE punctuation/capitalisation error, and it must be in segment ${ans} ONLY (e.g. a missing apostrophe, a lowercase proper noun, a missing or misplaced comma). Every OTHER segment must be flawless — do NOT capitalise common nouns, do NOT add stray commas, do NOT create any second error anywhere.`}
5. The explanation must clearly name the error and give the correction (state what it is now and what it should be) — never leave it identical or empty.

Return ONLY minified JSON:
{"options":{"A":"...","B":"...","C":"...","D":"...","N":"No mistake"},"correct_answer":"${ans}","explanation":"one short sentence naming the error and its fix"}`;
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

async function reconstruct(q) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system: SYSTEM, messages: [{ role: 'user', content: buildPrompt(q) }] }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text()).slice(0, 200));
  const json = await resp.json();
  const parsed = extractJson(json.content?.[0]?.text || '');

  // Validation
  const o = parsed.options || {};
  const segs = ['A', 'B', 'C', 'D'].map(k => (o[k] || '').trim());
  if (segs.some(s => !s)) throw new Error('missing segment');
  // No cross-segment duplication (3+ consecutive shared words)
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    if (i === j) continue;
    const aw = segs[i].split(/\s+/);
    for (let k = 0; k + 3 <= aw.length; k++) {
      const tri = aw.slice(k, k + 3).join(' ');
      if (tri.length > 8 && segs[j].includes(tri)) throw new Error('still overlapping');
    }
  }
  if (o.N == null) parsed.options.N = 'No mistake';
  const ans = String(parsed.correct_answer).toUpperCase();
  if (!['A', 'B', 'C', 'D', 'N'].includes(ans)) throw new Error('bad answer');
  if (ans !== String(q.correct_answer).toUpperCase()) throw new Error('answer drifted from original');
  return parsed;
}

// ── Independent verifier (fresh Sonnet call, no memory of how it was built) ──────
function buildVerifyPrompt(parsed) {
  const o = parsed.options || {};
  const ans = String(parsed.correct_answer).toUpperCase();
  const segs = ['A', 'B', 'C', 'D'].map(k => `${k}: ${JSON.stringify(o[k] || '')}`).join('\n');
  return `You are a strict SEAG examiner checking a "find the punctuation mistake" question. Read the 4 segments as one sentence.

${segs}

The claimed answer is ${ans}.

Check ALL of these and be harsh:
- The 4 segments join into ONE natural, sensible sentence with no repeated words across segments.
- No segment is a placeholder like "No mistake".
${ans === 'N'
  ? '- The sentence is PERFECTLY punctuated with zero errors of any kind.'
  : `- Segment ${ans} contains exactly ONE genuine punctuation/capitalisation error.\n- EVERY other segment (not ${ans}) is completely correct — no ghost errors, no wrongly capitalised common nouns, no stray commas.`}
- There is no SECOND error anywhere in the sentence.

Return ONLY minified JSON: {"valid":true} if every check passes, otherwise {"valid":false,"reason":"short reason"}.`;
}

async function verify(parsed) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, system: SYSTEM, messages: [{ role: 'user', content: buildVerifyPrompt(parsed) }] }),
  });
  if (!resp.ok) throw new Error('verify HTTP ' + resp.status);
  const json = await resp.json();
  return extractJson(json.content?.[0]?.text || '');
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}   Limit: ${LIMIT}`);
  const broken = await fetchBroken();
  console.log(`Broken punctuation questions: ${broken.length}\n`);
  const batch = broken.slice(0, LIMIT === Infinity ? broken.length : LIMIT);

  let applied = 0, unvalidated = 0, fail = 0, verifyPass = 0, verifyFail = 0;
  for (let i = 0; i < batch.length; i++) {
    const q = batch[i];
    process.stdout.write(`[${i + 1}/${batch.length}] ${q.id} ans=${q.correct_answer} ... `);
    try {
      // Reconstruct (retry up to 3x), then verify with a fresh independent pass
      let parsed = null, verdict = null;
      for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
        let cand;
        try { cand = await reconstruct(q); } catch { continue; }
        let v;
        try { v = await verify(cand); } catch { v = { valid: false, reason: 'verify error' }; }
        if (v.valid) { parsed = cand; verdict = v; }
        else verdict = v;
      }

      if (parsed) {
        verifyPass++;
        if (APPLY) {
          const { error } = await sb.from('questions').update({
            options: parsed.options,
            correct_answer: String(parsed.correct_answer).toUpperCase(),
            explanation: parsed.explanation || q.explanation || null,
          }).eq('id', q.id);
          if (error) throw new Error('DB: ' + error.message);
          applied++;
          console.log('VERIFIED → updated');
        } else {
          console.log('VERIFIED (dry)');
          const o = q.options || {};
          console.log('   OLD: ' + ['A','B','C','D'].map(k => `${k}=${JSON.stringify(o[k])}`).join('  '));
          console.log('   NEW: ' + ['A','B','C','D'].map(k => `${k}=${JSON.stringify(parsed.options[k])}`).join('  '));
          console.log('   ans=' + parsed.correct_answer + '  expl=' + JSON.stringify(parsed.explanation));
        }
      } else {
        // Could not produce a verified reconstruction — remove from student pool
        verifyFail++;
        if (APPLY) {
          const { error } = await sb.from('questions').update({ validated: false }).eq('id', q.id);
          if (error) throw new Error('DB: ' + error.message);
          unvalidated++;
          console.log(`UNVERIFIED → un-validated (${verdict?.reason || 'no clean reconstruction'})`);
        } else {
          console.log(`UNVERIFIED → would un-validate (${verdict?.reason || 'no clean reconstruction'})`);
        }
      }
    } catch (e) {
      console.log('FAIL — ' + e.message);
      fail++;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\nDone. verified=${verifyPass} unverified=${verifyFail} errors=${fail}`);
  if (APPLY) console.log(`  Applied (reconstructed): ${applied}   Un-validated (removed): ${unvalidated}`);
  else console.log('  (dry run — re-run with --apply to write)');
}

main().catch(e => { console.error(e); process.exit(1); });
