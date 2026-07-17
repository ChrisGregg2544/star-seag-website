/**
 * lint-questions.mjs — audit the whole question bank against question-contract.mjs.
 * Deterministic, zero AI cost, seconds to run.
 *
 * Usage:
 *   node scripts/lint-questions.mjs                 # report only (default)
 *   node scripts/lint-questions.mjs --quarantine    # set validated=false on violators
 *
 * Report shows violation counts per rule and per topic, and writes all
 * violating IDs + reasons to scripts/lint-report.json for the repair queue.
 */
import { readFileSync, writeFileSync } from 'fs';
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
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient('https://iutcgogmxhaqgaxkznxu.supabase.co', SERVICE_KEY);

const QUARANTINE = process.argv.includes('--quarantine');

async function fetchAllValidated() {
  let all = [], from = 0, size = 1000;
  while (true) {
    const { data, error } = await sb.from('questions')
      .select('id,subject,topic,year_group,difficulty,question_type,question_text,passage,passage_id,options,correct_answer')
      .eq('validated', true).range(from, from + size - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data);
    if (data.length < size) break;
    from += size;
  }
  return all;
}

async function main() {
  console.log(`Mode: ${QUARANTINE ? 'QUARANTINE (validated=false on violators)' : 'REPORT ONLY'}\n`);
  const qs = await fetchAllValidated();
  console.log(`Validated questions fetched: ${qs.length}\n`);

  const byRule = {}, byTopic = {}, bad = [];
  for (const q of qs) {
    const v = lintQuestion(q);
    if (v.length === 0) continue;
    bad.push({ id: q.id, topic: q.topic, year_group: q.year_group, violations: v });
    byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;
    for (const rule of v) {
      const key = rule.replace(/-(option|options)-[A-EN](-[A-EN])?$/, '-$1'); // collapse per-letter variants
      byRule[key] = (byRule[key] || 0) + 1;
    }
  }

  console.log(`VIOLATING QUESTIONS: ${bad.length} of ${qs.length} (${(bad.length / qs.length * 100).toFixed(1)}%)\n`);
  console.log('By rule:');
  Object.entries(byRule).sort((a, b) => b[1] - a[1]).forEach(([r, n]) => console.log(`  ${String(n).padStart(5)}  ${r}`));
  console.log('\nBy topic:');
  Object.entries(byTopic).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log(`  ${String(n).padStart(5)}  ${t}`));

  writeFileSync(resolve(__dir, 'lint-report.json'), JSON.stringify(bad, null, 2));
  console.log(`\nFull detail written to scripts/lint-report.json`);

  if (QUARANTINE && bad.length > 0) {
    console.log(`\nQuarantining ${bad.length} questions...`);
    let done = 0;
    for (let i = 0; i < bad.length; i += 100) {
      const ids = bad.slice(i, i + 100).map(b => b.id);
      const { error } = await sb.from('questions').update({ validated: false, validator_reason: 'lint-quarantine' }).in('id', ids);
      if (error) throw new Error(error.message);
      done += ids.length;
    }
    console.log(`Quarantined: ${done}`);
  } else if (!QUARANTINE) {
    console.log('\n(report only — re-run with --quarantine to remove violators from the student pool)');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
