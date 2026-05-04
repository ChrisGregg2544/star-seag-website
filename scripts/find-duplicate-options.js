/**
 * find-duplicate-options.js
 * Reports all validated questions where any two answer options are identical.
 *
 * Usage:
 *   node scripts/find-duplicate-options.js
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

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY  = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const PAGE_SIZE    = 1000;

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const baseHeaders = {
  apikey:        SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchPage(offset) {
  const url = `${SUPABASE_URL}/rest/v1/questions`
    + `?validated=eq.true`
    + `&options=not.is.null`
    + `&select=id,topic,year_group,question_text,options,correct_answer`
    + `&limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, { headers: baseHeaders });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('Scanning for duplicate answer options in validated questions...\n');

  const duplicates = [];
  let offset = 0;
  let totalScanned = 0;

  while (true) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;
    totalScanned += rows.length;

    for (const row of rows) {
      if (!row.options || typeof row.options !== 'object') continue;
      const entries = Object.entries(row.options);
      const seen = new Map(); // normalised → original value
      const dupeKeys = [];

      for (const [key, val] of entries) {
        const norm = String(val).trim().toLowerCase();
        if (seen.has(norm)) {
          dupeKeys.push(key);
        } else {
          seen.set(norm, { key, val });
        }
      }

      if (dupeKeys.length > 0) {
        duplicates.push({
          id:             row.id,
          topic:          row.topic,
          year_group:     row.year_group,
          question:       row.question_text.slice(0, 100),
          options:        row.options,
          correct_answer: row.correct_answer,
          duplicate_keys: dupeKeys,
        });
      }
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Scanned : ${totalScanned} questions`);
  console.log(`Duplicates found : ${duplicates.length}\n`);

  if (duplicates.length === 0) {
    console.log('No duplicate options found.');
    return;
  }

  // Group by topic for readability
  const byTopic = {};
  for (const d of duplicates) {
    const key = `${d.topic} ${d.year_group}`;
    if (!byTopic[key]) byTopic[key] = [];
    byTopic[key].push(d);
  }

  for (const [group, items] of Object.entries(byTopic).sort()) {
    console.log(`── ${group} (${items.length}) ──────────────────────────`);
    for (const d of items) {
      console.log(`  ID     : ${d.id}`);
      console.log(`  Q      : ${d.question}`);
      const optStr = Object.entries(d.options)
        .map(([k, v]) => {
          const isDupe = d.duplicate_keys.includes(k);
          return `${k}:"${v}"${isDupe ? ' ⚠️' : ''}`;
        })
        .join('  ');
      console.log(`  Options: ${optStr}`);
      console.log(`  Correct: ${d.correct_answer}   Dupe keys: ${d.duplicate_keys.join(', ')}`);
      console.log('');
    }
  }

  console.log(`Total with duplicates: ${duplicates.length}`);
  console.log('IDs only:');
  console.log(duplicates.map(d => d.id).join('\n'));
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
