/**
 * repair-comprehension-passages.mjs  (E4 — deterministic repair)
 *
 * Quarantined comprehension questions that HAVE a valid passage_id but are
 * missing the passage TEXT on the row. Fix = copy passage.content from the
 * linked passages row onto the question, re-lint, and (on --apply) set
 * validated=true, validator_reason=null. No AI — purely deterministic.
 * Anything that still fails the contract after the copy is left quarantined.
 *
 * Usage:
 *   node scripts/repair-comprehension-passages.mjs            # dry run, 5 examples
 *   node scripts/repair-comprehension-passages.mjs --apply    # write to DB
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
const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY  = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const APPLY = process.argv.includes('--apply');

async function fetchTargets() {
  let all = [], from = 0, size = 1000;
  while (true) {
    const { data, error } = await sb.from('questions')
      .select('id,topic,year_group,difficulty,question_type,question_text,passage,passage_id,options,correct_answer')
      .in('topic', ['comprehension_mc', 'comprehension_written'])
      .eq('validated', false)
      .eq('validator_reason', 'lint-quarantine')
      .not('passage_id', 'is', null)
      .is('passage', null)
      .order('id')
      .range(from, from + size - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return all;
}

async function fetchPassageMap(ids) {
  const map = new Map();
  const uniq = [...new Set(ids)];
  for (let i = 0; i < uniq.length; i += 200) {
    const chunk = uniq.slice(i, i + 200);
    const { data, error } = await sb.from('passages').select('id,content').in('id', chunk);
    if (error) throw new Error(error.message);
    for (const p of data) map.set(p.id, p.content);
  }
  return map;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);
  const targets = await fetchTargets();
  console.log(`Repairable (passage_id set, passage text missing): ${targets.length}`);
  const passageMap = await fetchPassageMap(targets.map(q => q.passage_id));

  let repaired = 0, skipped = 0, shown = 0;
  for (const q of targets) {
    const content = passageMap.get(q.passage_id);
    if (!content || !content.trim()) { skipped++; continue; }  // passage row missing/empty

    const newRow = { ...q, passage: content };
    const violations = lintQuestion(newRow);
    if (violations.length > 0) {
      skipped++;
      if (!APPLY && shown < 5) { console.log(`SKIP ${q.id} — still violates: ${violations.join(', ')}`); }
      continue;
    }

    if (APPLY) {
      const { error } = await sb.from('questions').update({
        passage: content,
        validated: true,
        validator_reason: null,
      }).eq('id', q.id);
      if (error) throw new Error('DB update ' + q.id + ': ' + error.message);
      repaired++;
    } else {
      repaired++;
      if (shown < 5) {
        shown++;
        console.log(`\n[example ${shown}] ${q.topic} ${q.year_group} ${q.id}`);
        console.log(`  passage_id: ${q.passage_id}`);
        console.log(`  question:   ${(q.question_text || '').slice(0, 90)}`);
        console.log(`  passage now:${JSON.stringify((content || '').slice(0, 90))}…`);
        console.log(`  answer: ${q.correct_answer}  (lint after copy: OK)`);
      }
    }
  }

  console.log(`\nDone. ${APPLY ? 'repaired' : 'would repair'}=${repaired}  skipped=${skipped}`);
  if (!APPLY) console.log('  (dry run — re-run with --apply to write)');
}

main().catch(e => { console.error(e); process.exit(1); });
