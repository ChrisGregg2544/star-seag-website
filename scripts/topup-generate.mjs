/**
 * topup-generate.mjs
 * Top-up question bank for specified categories using the deployed Vercel API.
 * Generates with Sonnet, validates each question, saves only passing ones.
 *
 * Usage: node scripts/topup-generate.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Load .env ──────────────────────────────────────────────────────────────
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const eq = line.indexOf('=');
  if (eq > 0) envVars[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
}

const SERVICE_KEY  = envVars.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const VERCEL_URL   = 'https://star-seag-website.vercel.app';
const BATCH_SIZE   = 15;
const CONCURRENCY  = 8;   // parallel run-validators calls per batch
const MAX_BATCHES  = 60;  // safety cap per category (60 × 15 = 900 generated max)

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

// ── Jobs ───────────────────────────────────────────────────────────────────
const JOBS = [
  { category: 'punctuation', year_group: 'P7', target: 505 },
  { category: 'punctuation', year_group: 'P6', target: 513 },
  { category: 'geometry',    year_group: 'P6', target: 505 },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getCurrentCount(category, year_group) {
  const url = `${SUPABASE_URL}/rest/v1/questions?topic=eq.${encodeURIComponent(category)}&year_group=eq.${encodeURIComponent(year_group)}&active=eq.true&validated=eq.true&select=id`;
  const res = await fetch(url, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'count=exact',
      'Range': '0-0',
    },
  });
  const cr = res.headers.get('content-range');
  const m = cr?.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

async function generateBatch(category, year_group, batch_size) {
  const res = await fetch(`${VERCEL_URL}/api/question-builder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate-questions', category, year_group, batch_size }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`generate ${res.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  return { questions: data.questions || [], skipped: data.skipped_duplicates || 0 };
}

async function validateQuestion(q) {
  try {
    const res = await fetch(`${VERCEL_URL}/api/question-builder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:        'run-validators',
        question_text: q.question_text,
        correct_answer: q.correct_answer,
        category:      q.category,
        year_group:    q.year_group,
        difficulty:    q.difficulty || 3,
        options:       q.options || null,
      }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function runConcurrent(items, concurrency, fn) {
  const results = new Array(items.length).fill(null);
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    batchResults.forEach((r, j) => { results[i + j] = r; });
  }
  return results;
}

async function saveBatch(questions) {
  const res = await fetch(`${VERCEL_URL}/api/question-builder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save-generated', questions }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`save ${res.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  return data.saved || 0;
}

// ── Category runner ────────────────────────────────────────────────────────
async function processJob({ category, year_group, target }) {
  const bar = '═'.repeat(58);
  console.log(`\n${bar}`);
  console.log(`  ${category.toUpperCase()} ${year_group}  →  target: ${target}`);
  console.log(bar);

  const startCount = await getCurrentCount(category, year_group);
  console.log(`  Current active+validated: ${startCount}`);

  const needed = Math.max(0, target - startCount);
  if (needed === 0) {
    console.log('  Already at or above target — skipping.\n');
    return { category, year_group, startCount, added: 0, final: startCount, target, generated: 0, passed: 0 };
  }
  console.log(`  Need to add: ${needed}\n`);

  let totalGenerated = 0;
  let totalPassed    = 0;
  let totalSaved     = 0;
  let batchNum       = 0;

  while (totalSaved < needed && batchNum < MAX_BATCHES) {
    batchNum++;

    // ── Generate ──
    process.stdout.write(`  [${batchNum}] gen... `);
    let questions, skippedDupes;
    try {
      const result = await generateBatch(category, year_group, BATCH_SIZE);
      questions    = result.questions;
      skippedDupes = result.skipped;
    } catch (e) {
      console.log(`GEN ERROR: ${e.message} — retrying in 10s`);
      await sleep(10000);
      batchNum--; // don't count this attempt
      continue;
    }

    if (!questions.length) {
      console.log(`0 returned (${skippedDupes} deduped) — skipping batch`);
      await sleep(2000);
      continue;
    }
    totalGenerated += questions.length;
    process.stdout.write(`got ${questions.length}${skippedDupes ? ` (+${skippedDupes} deduped)` : ''}. val... `);

    // ── Validate ──
    const validations = await runConcurrent(questions, CONCURRENCY, validateQuestion);

    // run-validators returns { outcome, v1, v4 } for specialist cats or { outcome, v1, v2, v3 } for others
    const passing = questions
      .map((q, i) => ({ q, v: validations[i] }))
      .filter(({ v }) => v && v.outcome === 'pass')
      .map(({ q, v }) => ({
        ...q,
        v1_score:          v.v1?.score  ?? null,
        v1_reason:         v.v1?.reason ?? null,
        v4_score:          v.v4?.score  ?? v.v2?.score  ?? null,  // v4 = specialist, v2 = general
        v4_reason:         v.v4?.reason ?? v.v2?.reason ?? null,
        validator_verdict: v.outcome    ?? 'pass',
      }));

    totalPassed += passing.length;
    const pct = Math.round(passing.length / questions.length * 100);
    process.stdout.write(`${passing.length}/${questions.length} pass (${pct}%). `);

    if (!passing.length) {
      console.log('Nothing to save.');
      await sleep(1000);
      continue;
    }

    // ── Save (only as many as still needed) ──
    const toSave = passing.slice(0, needed - totalSaved);
    try {
      const saved = await saveBatch(toSave);
      totalSaved += saved;
      console.log(`Saved ${saved}. Total: ${totalSaved}/${needed}`);
    } catch (e) {
      console.log(`SAVE ERROR: ${e.message}`);
    }

    await sleep(1000); // brief pause between batches
  }

  const finalCount = await getCurrentCount(category, year_group);
  const overallPct = totalGenerated > 0 ? Math.round(totalPassed / totalGenerated * 100) : 0;

  console.log(`\n  ── ${category} ${year_group} COMPLETE ──`);
  console.log(`  Generated: ${totalGenerated} | Passed: ${totalPassed} (${overallPct}%) | Saved: ${totalSaved}`);
  console.log(`  Count: ${startCount} → ${finalCount}  (target ${target})`);

  return {
    category, year_group, target,
    startCount, added: totalSaved, final: finalCount,
    generated: totalGenerated, passed: totalPassed, passRate: `${overallPct}%`,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────
console.log('Top-up generation starting…');
console.log(`Vercel: ${VERCEL_URL}`);
console.log(`Batch size: ${BATCH_SIZE} | Concurrency: ${CONCURRENCY}`);

const results = [];
for (const job of JOBS) {
  const r = await processJob(job);
  results.push(r);
}

const bar = '═'.repeat(58);
console.log(`\n${bar}`);
console.log('  ALL JOBS COMPLETE — SUMMARY');
console.log(bar);
for (const r of results) {
  const ok = r.final >= r.target ? '✅' : '⚠️ ';
  console.log(`  ${ok} ${r.category} ${r.year_group}: ${r.final}/${r.target}  (added ${r.added}, pass rate ${r.passRate})`);
}
console.log(bar);
