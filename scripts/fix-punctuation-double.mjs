/**
 * fix-punctuation-double.mjs
 *
 * Issue 1: some punctuation "find the mistake" questions contain TWO errors —
 * one in the intended answer segment and one in another segment. SEAG allows
 * only one (or zero) mistakes. This scans each question with Sonnet to find ALL
 * segments containing an error; where a NON-answer segment also has an error it
 * corrects that segment only, leaving the intended answer segment's mistake intact.
 * Nothing is deleted.
 *
 * Usage:
 *   node scripts/fix-punctuation-double.mjs               # dry run, scan+count, first 40
 *   node scripts/fix-punctuation-double.mjs --scan-all    # dry run, scan ALL (true count)
 *   node scripts/fix-punctuation-double.mjs --apply --scan-all
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

const APPLY    = process.argv.includes('--apply');
const SCAN_ALL = process.argv.includes('--scan-all');
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function fetchPunct() {
  let all = [], from = 0, size = 1000;
  while (true) {
    const { data, error } = await sb.from('questions')
      .select('id,options,correct_answer')
      .eq('topic', 'punctuation').eq('validated', true).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return all;
}

function buildPrompt(q) {
  const segs = ['A', 'B', 'C', 'D'].map(k => `${k}: ${q.options[k]}`).join('\n');
  return `This is a SEAG "find the punctuation mistake" question. The sentence is split into 4 segments. Segment ${q.correct_answer} is the INTENDED single mistake.

Segments:
${segs}

Check EACH segment for punctuation/capitalisation errors (missing apostrophes, missing capital letters for proper nouns/days/months/sentence starts, wrong or missing commas, missing end punctuation, misused apostrophes).

A correct SEAG question has a mistake ONLY in segment ${q.correct_answer}. If any OTHER segment (not ${q.correct_answer}) also contains an error, that segment must be corrected so the sentence reads correctly there while keeping segment ${q.correct_answer}'s mistake unchanged.

Return ONLY minified JSON:
- If only segment ${q.correct_answer} has an error: {"clean":true}
- If other segments also have errors: {"clean":false,"fixes":{"B":"corrected text",...}} listing ONLY the non-${q.correct_answer} segments you corrected, with their corrected text.`;
}

// Strip code fences, then return the LAST balanced {...} object that parses.
// (Model may reason in prose and echo an example object before its real answer.)
function extractJson(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();

  // Fast path: whole thing is JSON
  try { return JSON.parse(cleaned); } catch { /* fall through */ }

  // Collect every balanced {...} span, keep the last one that JSON.parses
  let last = null;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < cleaned.length; j++) {
      const c = cleaned[j];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try { last = JSON.parse(cleaned.slice(i, j + 1)); } catch { /* not valid */ }
          break;
        }
      }
    }
  }
  if (last === null) throw new Error(`No JSON in: ${raw.slice(0, 80)}`);
  return last;
}

const SYSTEM = 'You are a precise JSON API. Output ONLY the requested minified JSON object. No preamble, no explanation, no code fences, no text before or after the JSON.';

async function scanOne(q) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,   // room to reason AND emit JSON (model rejects assistant prefill)
      system: SYSTEM,
      messages: [{ role: 'user', content: buildPrompt(q) }],
    }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text()).slice(0, 300));
  const json = await resp.json();
  return extractJson(json.content?.[0]?.text || '');
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}  Scan: ${SCAN_ALL ? 'ALL' : 'first 40'}`);
  const allRaw = await fetchPunct();
  // Skip "No mistake" (N) questions — they have no single intended-mistake segment,
  // so the "keep segment X's mistake, fix the others" model doesn't apply.
  const all = allRaw.filter(q => String(q.correct_answer).toUpperCase() !== 'N');
  const batch = SCAN_ALL ? all : all.slice(0, 40);
  console.log(`Punctuation validated: ${allRaw.length}   (excluding ${allRaw.length - all.length} N-answer)   scanning: ${batch.length}\n`);

  let doubles = 0, fixed = 0, fail = 0;
  for (let i = 0; i < batch.length; i++) {
    const q = batch[i];
    try {
      let res, tries = 0;
      while (true) { try { res = await scanOne(q); break; } catch (e) { if (++tries >= 3) throw e; } }
      if (res && res.clean === false && res.fixes && Object.keys(res.fixes).length) {
        doubles++;
        const ans = String(q.correct_answer);
        const newOpts = { ...q.options };
        let valid = true;
        for (const [k, v] of Object.entries(res.fixes)) {
          if (k === ans) { valid = false; break; }        // never touch the answer segment
          if (!['A', 'B', 'C', 'D'].includes(k) || !v) { valid = false; break; }
          newOpts[k] = v;
        }
        if (!valid) { console.log(`[${i + 1}] ${q.id} — skipped (fix targeted answer segment)`); continue; }
        console.log(`[${i + 1}] ${q.id} ans=${ans}  fixes=${JSON.stringify(res.fixes)}`);
        if (APPLY) {
          const { error } = await sb.from('questions').update({ options: newOpts }).eq('id', q.id);
          if (error) throw new Error('DB: ' + error.message);
          fixed++;
        }
      }
    } catch (e) {
      fail++; console.log(`[${i + 1}] ${q.id} FAIL — ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 250));
  }
  console.log(`\nScanned ${batch.length}. Double-mistake found: ${doubles}. ${APPLY ? 'Fixed: ' + fixed : '(dry run)'}. Failures: ${fail}`);
}

main().catch(e => { console.error(e); process.exit(1); });
