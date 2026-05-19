/**
 * reseed-function-machines.mjs
 * Generates function-machine diagrams for all validated algebra_sequences
 * questions whose text mentions "function machine" or "input"+"output".
 *
 * Usage:
 *   node scripts/reseed-function-machines.mjs          ← dry run (default)
 *   node scripts/reseed-function-machines.mjs --write  ← write to Supabase
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { generateDiagram } from '../diagram-generator.js';

const __dir  = dirname(fileURLToPath(import.meta.url));
const WRITE  = process.argv.includes('--write');

// ── .env ───────────────────────────────────────────────────────────────────────
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}
const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY  = envVars.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const headers = {
  apikey:         SERVICE_KEY,
  Authorization:  `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer:         'return=minimal',
};

// ── Rule extraction ────────────────────────────────────────────────────────────
// Priority: extract a concise mathematical rule from question text.
// Returns a short string suitable for the rule box (ideally ≤ 11 chars,
// but wrapRuleText in diagram-generator.js handles longer strings).

function extractRule(text) {
  const t = text.toLowerCase();

  // 1. Already-formatted operator expressions: "× 4", "÷ 3", "+ 7", "− 2", "- 2"
  const opMatch = text.match(/([×÷+\-−]\s*\d+(?:\s*[+\-−×÷]\s*\d+)?)/);
  if (opMatch) return opMatch[1].trim();

  // 2. "multiply/multiplies [0-2 words] by N"  e.g. "multiplies it by 4", "multiplies the input by 3"
  const mulMatch = t.match(/multipl(?:y|ies)\s+(?:\w+\s+){0,2}by\s+(\d+)/);
  if (mulMatch) return `× ${mulMatch[1]}`;

  // 3. "divide/divides [0-2 words] by N"  e.g. "divides the input by 2"
  const divMatch = t.match(/divid(?:e|es)\s+(?:\w+\s+){0,2}by\s+(\d+)/);
  if (divMatch) return `÷ ${divMatch[1]}`;

  // 4. "add/adds N" (not "additional")
  const addMatch = t.match(/\badd(?:s)?\s+(\d+)\b/);
  if (addMatch) return `+ ${addMatch[1]}`;

  // 5. "subtract/subtracts N"
  const subMatch = t.match(/subtract(?:s)?\s+(\d+)\b/);
  if (subMatch) return `− ${subMatch[1]}`;

  // 6. "increase/increases by N"
  const incMatch = t.match(/increase(?:s)?\s+by\s+(\d+)/);
  if (incMatch) return `+ ${incMatch[1]}`;

  // 7. "decrease/decreases by N"
  const decMatch = t.match(/decrease(?:s)?\s+by\s+(\d+)/);
  if (decMatch) return `− ${decMatch[1]}`;

  // 8. "double/doubles" / "triple/triples"
  if (/\bdoubles?\b/.test(t)) return '× 2';
  if (/\btriples?\b/.test(t)) return '× 3';
  if (/\bhalves?\b|halved/.test(t)) return '÷ 2';

  // 9. "n → expr" or "input → expr" style notation
  const arrowMatch = text.match(/(?:n|input)\s*→\s*([^\s.?]{1,20})/i);
  if (arrowMatch) return arrowMatch[1].trim();

  // 10. No match — use generic placeholder
  return '?';
}

// ── Fetch all matching questions ───────────────────────────────────────────────
async function fetchAll() {
  const PAGE = 500;
  let offset = 0;
  const results = [];

  while (true) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/questions`);
    url.searchParams.set('topic',    'eq.algebra_sequences');
    url.searchParams.set('validated','eq.true');
    url.searchParams.set('or',       '(question_text.ilike.*function machine*,question_text.ilike.*input*output*)');
    url.searchParams.set('select',   'id,question_text');
    url.searchParams.set('limit',    PAGE);
    url.searchParams.set('offset',   offset);

    const res  = await fetch(url.toString(), { headers });
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    results.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return results;
}

// ── Update one question's diagram ──────────────────────────────────────────────
async function updateDiagram(id, svg) {
  const url = `${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`;
  const res  = await fetch(url, {
    method:  'PATCH',
    headers,
    body:    JSON.stringify({ diagram: svg }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PATCH ${id} failed ${res.status}: ${txt.slice(0, 120)}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
console.log('Fetching matching questions…');
const questions = await fetchAll();
console.log(`Found ${questions.length} questions.\n`);

// Build plan
const plan = questions.map(q => {
  const rule = extractRule(q.question_text);
  const svg  = generateDiagram('function-machine', { rule, input: '?', output: '?' });
  return { id: q.id, rule, svgLen: svg ? svg.length : 0, svg, preview: q.question_text.slice(0, 80) };
});

const matched  = plan.filter(p => p.rule !== '?');
const fallback = plan.filter(p => p.rule === '?');

// ── Dry-run report ────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════');
console.log('  DRY RUN SUMMARY');
console.log('═══════════════════════════════════════════════');
console.log(`  Total questions   : ${plan.length}`);
console.log(`  Rule extracted    : ${matched.length} (${Math.round(matched.length/plan.length*100)}%)`);
console.log(`  Fallback (rule=?) : ${fallback.length} (${Math.round(fallback.length/plan.length*100)}%)`);
console.log(`  SVG failures      : ${plan.filter(p => !p.svg).length}`);
console.log('───────────────────────────────────────────────');
console.log('\nSample extracted rules (first 10):');
plan.slice(0, 10).forEach((p, i) => {
  console.log(`  ${String(i+1).padStart(2)}. rule="${p.rule}"  ← "${p.preview}…"`);
});
console.log('\nFallback examples (first 5, rule could not be extracted):');
fallback.slice(0, 5).forEach((p, i) => {
  console.log(`  ${i+1}. "${p.preview}…"`);
});
console.log('\n═══════════════════════════════════════════════');

if (!WRITE) {
  console.log('\n  Run with --write to apply changes to Supabase.');
  console.log('  Example: node scripts/reseed-function-machines.mjs --write\n');
  process.exit(0);
}

// ── Write mode ────────────────────────────────────────────────────────────────
console.log(`\nWriting ${plan.length} diagrams to Supabase…`);
let done = 0, errors = 0;
for (const p of plan) {
  if (!p.svg) { errors++; continue; }
  try {
    await updateDiagram(p.id, p.svg);
    done++;
    if (done % 50 === 0) console.log(`  …${done}/${plan.length} updated`);
    await new Promise(r => setTimeout(r, 25)); // 25 ms between writes
  } catch (err) {
    console.error(`  ERROR ${p.id}: ${err.message}`);
    errors++;
  }
}
console.log(`\nDone. ${done} updated, ${errors} errors.`);
