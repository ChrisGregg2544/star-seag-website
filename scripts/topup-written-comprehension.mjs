/**
 * topup-written-comprehension.mjs
 *
 * Some passages have their 7 MC comprehension questions but fewer than 6
 * validated written (free-response) questions — their written questions were
 * lost when empty-correct-answer rows were deleted in the E4 cleanup.
 * This generates the missing written questions per passage: model answer is
 * stored as correct_answer, each row is re-linted (question-contract.mjs), and
 * only contract-clean rows are inserted (validated=true, source ai_generated_v2).
 *
 * Usage:
 *   node scripts/topup-written-comprehension.mjs            # dry run, first 2 passages
 *   node scripts/topup-written-comprehension.mjs --limit 5  # dry run, first 5 passages
 *   node scripts/topup-written-comprehension.mjs --apply     # write to DB (all short passages)
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
const LIMIT = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : (APPLY ? Infinity : 2);
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const TARGET = 6; // written questions per passage

async function fetchShortPassages() {
  const { data: passages } = await sb.from('passages').select('id,title,content,year_group,difficulty');
  let all = [], from = 0, size = 1000;
  while (true) {
    const { data } = await sb.from('questions')
      .select('passage_id,question_text').eq('topic', 'comprehension_written').eq('validated', true)
      .not('passage_id', 'is', null).range(from, from + size - 1);
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  const byP = {};
  for (const q of all) { (byP[q.passage_id] = byP[q.passage_id] || []).push(q.question_text); }
  return passages
    .map(p => ({ ...p, existing: byP[p.id] || [] }))
    .filter(p => p.existing.length < TARGET);
}

const SYSTEM = 'You are a precise JSON API. Output ONLY the requested minified JSON object — no preamble, no code fences.';

function buildPrompt(passage, need, existingQs) {
  const age = passage.year_group === 'P6' ? 'Primary 6 (age 10)' : 'Primary 7 (age 11)';
  const avoid = existingQs.length ? `\nDo NOT duplicate these existing questions:\n- ${existingQs.join('\n- ')}` : '';
  return `Write ${need} short-answer (free-response) reading comprehension questions for the Northern Ireland SEAG Transfer Test, ${passage.year_group} (${age}), based on this passage.

PASSAGE:
${passage.content}

Rules:
- Each question needs a 1-2 sentence model answer that a marker would accept, grounded in the passage.
- Test a mix of literal retrieval, inference, and vocabulary-in-context.
- UK English, age-appropriate.${avoid}

Return ONLY minified JSON: {"written":[{"question_text":"...","model_answer":"..."}, ...]} with exactly ${need} items.`;
}

function extractJson(raw) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in: ' + raw.slice(0, 80));
  return JSON.parse(m[0]);
}

async function generate(passage, need) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, temperature: 1, system: SYSTEM, messages: [{ role: 'user', content: buildPrompt(passage, need, passage.existing) }] }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text()).slice(0, 150));
  const parsed = extractJson((await resp.json()).content?.[0]?.text || '');
  return (parsed.written || []).filter(q => q.question_text && q.model_answer);
}

function toRow(passage, q) {
  return {
    subject: 'english', topic: 'comprehension_written', question_type: 'written',
    year_group: passage.year_group, difficulty: passage.difficulty || (passage.year_group === 'P6' ? 3 : 4),
    question_text: q.question_text, options: null,
    correct_answer: q.model_answer, explanation: q.model_answer,
    passage: passage.content, passage_id: passage.id,
    source: 'ai_generated_v2', validated: true, active: true, times_used: 0,
  };
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}   Limit: ${LIMIT} passages\n`);
  const short = await fetchShortPassages();
  console.log(`Passages short of ${TARGET} written: ${short.length}  (total needed: ${short.reduce((s, p) => s + (TARGET - p.existing.length), 0)})\n`);
  const batch = short.slice(0, LIMIT === Infinity ? short.length : LIMIT);

  let inserted = 0, skipped = 0, fail = 0;
  for (let i = 0; i < batch.length; i++) {
    const p = batch[i];
    const need = TARGET - p.existing.length;
    process.stdout.write(`[${i + 1}/${batch.length}] [${p.year_group}] ${p.title.slice(0, 36)} — need ${need} ... `);
    try {
      let gen = null, tries = 0;
      while (!gen && tries < 3) { tries++; try { gen = await generate(p, need); } catch { gen = null; } }
      if (!gen || !gen.length) { console.log('FAIL — no output'); fail++; continue; }

      const rows = gen.slice(0, need).map(q => toRow(p, q));
      const clean = [];
      for (const r of rows) {
        const v = lintQuestion(r);
        if (v.length > 0) { skipped++; continue; }
        clean.push(r);
      }

      if (APPLY) {
        if (clean.length) {
          const { error } = await sb.from('questions').insert(clean);
          if (error) throw new Error('DB: ' + error.message);
          inserted += clean.length;
        }
        console.log(`inserted ${clean.length}/${need}`);
      } else {
        console.log(`would insert ${clean.length}/${need}`);
        clean.slice(0, 2).forEach(r => console.log(`     Q: ${r.question_text}\n     A: ${r.correct_answer}`));
      }
    } catch (e) { console.log('FAIL — ' + e.message); fail++; }
    await new Promise(r => setTimeout(r, 300));
  }
  console.log(`\nDone. ${APPLY ? 'inserted' : 'would insert'}=${inserted} skipped=${skipped} failed=${fail}${APPLY ? '' : '  (dry run — re-run with --apply)'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
