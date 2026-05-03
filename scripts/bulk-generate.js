/**
 * bulk-generate.js
 * Generates questions across all 12 categories × 2 year groups to hit targets.
 *
 * Targets (per year group):
 *   punctuation, grammar, spelling        → 100
 *   vocabulary                            → 40
 *   comprehension_mc                      → 100
 *   comprehension_written                 → 75
 *   arithmetic, geometry, fractions_decimals,
 *   measurement, statistics, algebra_sequences → 150
 *   Total: 2,830
 *
 * Prerequisites: vercel dev must be running on port 3000 (reads .env for API keys).
 * Usage: node scripts/bulk-generate.js
 *   API_BASE=http://localhost:3000 node scripts/bulk-generate.js
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── .env (for Supabase count queries only) ─────────────────────────────────────
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const SUPABASE_URL   = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY    = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const API_BASE       = process.env.API_BASE || 'https://www.staraitutor.co.uk/api/question-builder';
const PROGRESS_FILE  = resolve(__dir, '../progress.json');
const BATCH_SIZE     = 50;
const BATCH_DELAY_MS = 5000;

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

// ── Generation plan ────────────────────────────────────────────────────────────
const PLAN = [
  { category: 'punctuation',           year_group: 'P6', target: 100 },
  { category: 'punctuation',           year_group: 'P7', target: 100 },
  { category: 'grammar',               year_group: 'P6', target: 100 },
  { category: 'grammar',               year_group: 'P7', target: 100 },
  { category: 'spelling',              year_group: 'P6', target: 100 },
  { category: 'spelling',              year_group: 'P7', target: 100 },
  { category: 'vocabulary',            year_group: 'P6', target: 40  },
  { category: 'vocabulary',            year_group: 'P7', target: 40  },
  { category: 'comprehension_mc',      year_group: 'P6', target: 100 },
  { category: 'comprehension_mc',      year_group: 'P7', target: 100 },
  { category: 'comprehension_written', year_group: 'P6', target: 75  },
  { category: 'comprehension_written', year_group: 'P7', target: 75  },
  { category: 'arithmetic',            year_group: 'P6', target: 150 },
  { category: 'arithmetic',            year_group: 'P7', target: 150 },
  { category: 'geometry',              year_group: 'P6', target: 150 },
  { category: 'geometry',              year_group: 'P7', target: 150 },
  { category: 'fractions_decimals',    year_group: 'P6', target: 150 },
  { category: 'fractions_decimals',    year_group: 'P7', target: 150 },
  { category: 'measurement',           year_group: 'P6', target: 150 },
  { category: 'measurement',           year_group: 'P7', target: 150 },
  { category: 'statistics',            year_group: 'P6', target: 150 },
  { category: 'statistics',            year_group: 'P7', target: 150 },
  { category: 'algebra_sequences',     year_group: 'P6', target: 150 },
  { category: 'algebra_sequences',     year_group: 'P7', target: 150 },
];

const TOTAL_TARGET = PLAN.reduce((s, p) => s + p.target, 0);

// ── Progress tracking ──────────────────────────────────────────────────────────
function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { started_at: new Date().toISOString(), buckets: {} };
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')); } catch { return { buckets: {} }; }
}

function saveProgress(progress) {
  progress.last_updated = new Date().toISOString();
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Supabase ───────────────────────────────────────────────────────────────────
async function getCurrentCount(category, year_group) {
  const url = `${SUPABASE_URL}/rest/v1/questions`
    + `?topic=eq.${encodeURIComponent(category)}`
    + `&year_group=eq.${year_group}`
    + `&source=eq.ai_generated_v2`
    + `&validated=eq.true`
    + `&select=id`;

  const res = await fetch(url, {
    headers: {
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer':        'count=exact',
    },
  });

  if (!res.ok) throw new Error(`Count query failed (${res.status}): ${await res.text()}`);
  const range = res.headers.get('content-range'); // e.g. "0-49/123" or "*/0"
  if (!range) return 0;
  const total = parseInt(range.split('/')[1]);
  return isNaN(total) ? 0 : total;
}

// ── API calls (requires vercel dev running) ────────────────────────────────────
async function generateBatch(category, year_group, batch_size) {
  const res = await fetch(API_BASE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'generate-questions', category, year_group, batch_size }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`generate-questions ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function saveBatch(questions) {
  const res = await fetch(API_BASE, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'save-generated', questions }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`save-generated ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`${'═'.repeat(60)}`);
  console.log(`STAR Bulk Question Generator`);
  console.log(`API: ${API_BASE}`);
  console.log(`Target total: ${TOTAL_TARGET} questions across ${PLAN.length} buckets`);
  console.log(`Batch size: ${BATCH_SIZE}  |  Delay: ${BATCH_DELAY_MS / 1000}s between batches`);
  console.log('═'.repeat(60));

  const progress = loadProgress();
  let runGenerated = 0;
  let runSaved     = 0;

  for (let pi = 0; pi < PLAN.length; pi++) {
    const { category, year_group, target } = PLAN[pi];
    const key = `${category}_${year_group}`;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${pi + 1}/${PLAN.length}] ${category} ${year_group}  (target: ${target})`);

    let current;
    try {
      current = await getCurrentCount(category, year_group);
    } catch (err) {
      console.error(`  ✗ Could not fetch count: ${err.message}`);
      continue;
    }

    const needed = target - current;
    console.log(`  Current: ${current}  |  Needed: ${Math.max(0, needed)}`);

    if (needed <= 0) {
      console.log('  ✓ Already at target — skipping.');
      continue;
    }

    if (!progress.buckets[key]) progress.buckets[key] = { generated: 0, saved: 0, batches: 0 };
    const bucket = progress.buckets[key];

    let bucketSaved = 0;
    let batchNum    = 0;

    while (bucketSaved < needed) {
      const batchSize = Math.min(BATCH_SIZE, needed - bucketSaved);
      batchNum++;

      process.stdout.write(`  Batch ${batchNum} (${batchSize} questions)... `);

      try {
        const genResult = await generateBatch(category, year_group, batchSize);
        const questions = genResult.questions || [];

        if (!questions.length) {
          console.log('0 returned — skipping bucket.');
          break;
        }

        process.stdout.write(`${questions.length} generated → saving... `);

        const saveResult = await saveBatch(questions);
        const saved      = saveResult.saved || 0;

        bucketSaved     += saved;
        runGenerated    += questions.length;
        runSaved        += saved;
        bucket.generated += questions.length;
        bucket.saved     += saved;
        bucket.batches++;

        saveProgress(progress);

        const dupes = genResult.skipped_duplicates || 0;
        console.log(`${saved} saved${dupes ? ` (${dupes} dupes skipped)` : ''}`);

        if (bucketSaved < needed) {
          process.stdout.write(`  Waiting ${BATCH_DELAY_MS / 1000}s... `);
          await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
          process.stdout.write('\n');
        }
      } catch (err) {
        console.log(`FAILED — ${err.message}`);
        break;
      }
    }

    console.log(`  Bucket done: ${bucketSaved} saved this run`);
  }

  // ── Final summary ──────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  console.log('DONE');
  console.log(`  Generated this run: ${runGenerated}`);
  console.log(`  Saved this run:     ${runSaved}`);
  console.log(`  Progress saved to:  ${PROGRESS_FILE}`);
  console.log('═'.repeat(60));

  // Per-bucket summary
  console.log('\nBucket summary:');
  for (const { category, year_group, target } of PLAN) {
    const key = `${category}_${year_group}`;
    let current;
    try { current = await getCurrentCount(category, year_group); } catch { current = '?'; }
    const bar = current >= target ? '✓' : '○';
    console.log(`  ${bar} ${(category + ' ' + year_group).padEnd(30)} ${String(current).padStart(4)} / ${target}`);
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
