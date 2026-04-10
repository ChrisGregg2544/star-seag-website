/**
 * find-duplicates.js
 * Finds and optionally deletes duplicate questions in the validated question bank.
 *
 * Deduplication key:
 *   - punctuation / spelling topics → normalised passage field (question_text is boilerplate)
 *   - all other topics              → normalised first-80-chars of question_text
 *
 * Within each duplicate group, keep:
 *   - The question with validated=true, if one exists; otherwise
 *   - The oldest question (earliest created_at)
 *
 * Run with: node find-duplicates.js
 *
 * Optional flags:
 *   --min N      Only show groups with N or more duplicates (default: 2)
 *   --topic X    Filter to a specific topic
 *   --delete     After showing the report, prompt for confirmation then delete
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import readline from 'readline';

// ── Load .env ─────────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* rely on existing env vars */ }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set.');
  process.exit(1);
}

const minArg   = process.argv.indexOf('--min');
const MIN      = minArg !== -1 ? parseInt(process.argv[minArg + 1]) : 2;
const topicArg = process.argv.indexOf('--topic');
const TOPIC    = topicArg !== -1 ? process.argv[topicArg + 1] : null;
const DO_DELETE = process.argv.includes('--delete');

// Topics where question_text is boilerplate — use passage field for dedup key
const PASSAGE_TOPICS = new Set(['punctuation', 'spelling']);
// Comprehension questions share boilerplate text across passages — key on question_text + passage_id
const COMPREHENSION_TOPICS = new Set(['comprehension_mc', 'comprehension_written']);

function normalise(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupeKey(q) {
  if (COMPREHENSION_TOPICS.has(q.topic)) {
    // Only flag as duplicate if same question text AND same passage
    const qt = normalise(q.question_text).slice(0, 80);
    const pid = q.passage_id || 'no-passage';
    return qt ? `${pid}||${qt}` : null;
  }
  if (PASSAGE_TOPICS.has(q.topic)) {
    // spelling/punctuation: full question_text includes the unique sentence
    const qt = normalise(q.question_text);
    const p  = normalise(q.passage);
    return qt || p || null;
  }
  // All other topics: first 80 chars of question_text
  return normalise(q.question_text).slice(0, 80) || null;
}

function pickKeeper(group) {
  // Prefer validated=true, then oldest created_at
  const validated = group.filter(q => q.validated);
  const pool = validated.length > 0 ? validated : group;
  pool.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return pool[0];
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Fetching validated questions...');

  // Paginate to get all rows
  const PAGE = 500;
  let all = [];
  let from = 0;
  while (true) {
    let query = sb
      .from('questions')
      .select('id, question_text, passage, passage_id, topic, year_group, difficulty, source, subject, validated, created_at')
      .eq('validated', true)
      .range(from, from + PAGE - 1);

    if (TOPIC) query = query.eq('topic', TOPIC);

    const { data, error } = await query;
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  console.log(`Fetched ${all.length} validated questions. Grouping...\n`);

  // Group by dedup key
  const groups = new Map();
  for (const q of all) {
    const key = dedupeKey(q);
    if (!key) continue; // skip if key is empty (e.g. null passage on punctuation)
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }

  // Find groups with duplicates
  const dupeGroups = [...groups.values()].filter(g => g.length >= MIN);
  dupeGroups.sort((a, b) => b.length - a.length); // largest groups first

  if (dupeGroups.length === 0) {
    console.log('✅ No duplicates found.');
    return;
  }

  // Build deletion plan
  const toDelete = [];

  for (const group of dupeGroups) {
    const keeper = pickKeeper(group);
    for (const q of group) {
      if (q.id !== keeper.id) toDelete.push({ q, keeper });
    }
  }

  // ── Print report ────────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════════════════');
  console.log('  DUPLICATE REPORT');
  console.log('════════════════════════════════════════════════════════════\n');

  for (const group of dupeGroups) {
    const keeper = pickKeeper(group);
    const isPassageTopic = PASSAGE_TOPICS.has(group[0].topic);
    const preview = isPassageTopic
      ? (group[0].passage || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      : (group[0].question_text || '').replace(/\s+/g, ' ').trim().slice(0, 80);

    console.log(`── ${group.length}× duplicate  [${group[0].topic} / ${group[0].year_group}]`);
    console.log(`   Key: "${preview}${preview.length === 80 ? '…' : ''}"`);
    console.log(`   Match field: ${isPassageTopic ? 'passage' : 'question_text'}\n`);

    for (const q of group) {
      const isKeeper = q.id === keeper.id;
      const tag = isKeeper ? '✅ KEEP' : '🗑  DELETE';
      console.log(`   ${tag}  ID: ${q.id}`);
      console.log(`          Subject: ${q.subject}  Topic: ${q.topic}  Year: ${q.year_group}  Diff: ${q.difficulty}`);
      console.log(`          Source: ${q.source}  Created: ${q.created_at ? q.created_at.slice(0, 10) : 'unknown'}`);
      console.log();
    }
  }

  console.log('════════════════════════════════════════════════════════════');
  console.log(`Duplicate groups : ${dupeGroups.length}`);
  console.log(`Questions to DELETE: ${toDelete.length}`);
  console.log(`Questions to keep  : ${all.length - toDelete.length}`);
  console.log(`Total checked      : ${all.length}`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (!DO_DELETE) {
    console.log('Run with --delete flag to proceed with deletion.');
    return;
  }

  // ── Confirmation prompt ──────────────────────────────────────────────────────
  const answer = await confirm(`Delete ${toDelete.length} duplicate questions? Type YES to confirm: `);
  if (answer !== 'yes') {
    console.log('Aborted. No changes made.');
    return;
  }

  // ── Delete in batches of 50 ──────────────────────────────────────────────────
  const ids = toDelete.map(({ q }) => q.id);
  const BATCH = 50;
  let deleted = 0;

  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await sb.from('questions').delete().in('id', batch);
    if (error) {
      console.error(`Batch ${Math.floor(i/BATCH)+1} error:`, error.message);
    } else {
      deleted += batch.length;
      process.stdout.write(`\rDeleted ${deleted}/${ids.length}...`);
    }
  }

  console.log(`\n✅ Done. Deleted ${deleted} duplicate questions.`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
