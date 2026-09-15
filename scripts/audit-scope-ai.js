/**
 * audit-scope-ai.js
 * SEAG curriculum-SCOPE audit of active maths questions (NOT correctness, NOT format).
 * For each active question, Sonnet judges: is this within NI KS2 SEAG scope, or beyond it?
 * Flags anything needing a technique/notation/concept not in the 2026 Specification.
 *
 * Report-only. NEVER writes to the database. Deactivation is a separate, approved step.
 *
 * Usage:
 *   node scripts/audit-scope-ai.js                 ← full maths run (all 6 topics)
 *   SAMPLE=30 node scripts/audit-scope-ai.js       ← even sample across topics (trial)
 *   TOPIC=geometry node scripts/audit-scope-ai.js  ← single topic
 *   YEAR=P7 node scripts/audit-scope-ai.js         ← single year group
 *   LIMIT=100 node scripts/audit-scope-ai.js       ← cap total
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const SUPABASE_URL  = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY   = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = envVars.ANTHROPIC_API_KEY;
const MODEL         = 'claude-sonnet-4-6';

const FILTER_TOPIC = process.env.TOPIC || '';
const FILTER_YEAR  = process.env.YEAR  || '';
const LIMIT        = process.env.LIMIT  ? parseInt(process.env.LIMIT)  : Infinity;
const SAMPLE       = process.env.SAMPLE ? parseInt(process.env.SAMPLE) : 0;
const PAGE_SIZE    = 200;
const CONCURRENCY  = 5;
const DELAY_MS     = 200;

const MATHS_TOPICS = ['arithmetic', 'algebra_sequences', 'geometry', 'fractions_decimals', 'measurement', 'statistics'];

if (!SERVICE_KEY)   { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

// ── The authoritative scope boundary (verbatim, SEAG 2026 Specification — NI KS2 Maths) ──
const SEAG_SPEC = `NUMBER
- Whole numbers, digits signifying value
- Decimals up to two decimal places; multiply by 10, 100 and 1000
- Estimates and approximations to nearest 10 or 100
- Addition and subtraction (mentally, two two-digit numbers up to 100 and up to two decimal places); multiplications (to 10 x 10) and divisions; multiplication and division of decimals by whole numbers
- Vulgar and decimal fractions and percentages; relationships and equivalence among these
- Patterns and sequences of whole numbers, including steps, doubling and halving, multiplication patterns and predicting sequential numbers
- Prime, square and cube numbers; understanding indices, square and triangular numbers or series
- Use of simple function machines
- Use of a letter to represent a whole number (as in 6 + a = 24)

MEASUREMENT
- Length, weight, volume, capacity, time, area and temperature
- Metric terms: metre, gram, litre, and prefixes kilo, centi, milli
- Relationships between units; converting one metric unit to another
- Multiplication, division, addition and subtraction up to two decimal places
- Differences between two temperatures; reading a scale including negative temperatures (Celsius only)
- Perimeter of simple shapes; area by counting squares; volume by counting cubes; areas and volumes of 2-D and 3-D shapes
- Calculating and using scale to measure distance (simple drawings only)
- Analogue clock; 12- and 24-hour relationship including a.m./p.m.; timetables (24-hour)

SHAPE AND SPACE
- Regular and irregular 2-D shapes; classify by angles and sides; reflect shapes; name/describe quadrilaterals, circles, triangles, polygons
- 3-D shapes: cubes, cuboids, cones, cylinders, spheres, triangular prisms, pyramids
- Geometrical properties to solve problems
- Quarter/half/three-quarter/whole turns; clockwise/anti-clockwise; eight points of compass; coordinates in the FIRST QUADRANT only
- Line and angle language: vertical, horizontal, perpendicular, parallel, acute, obtuse, reflex
- Angles in triangles (scalene, right-angled, equilateral, isosceles) and quadrilaterals (square, rectangle, rhombus, kite, parallelogram, trapezium)
- Line symmetry

MONEY
- Problem solving (+, -, x, ÷); estimation/approximation; change up to £10; interpreting a calculator display

PROBABILITY
- Language: certain, uncertain, likely, unlikely, impossible, fair; order events by likelihood; fifty-fifty; probability with a die

DATA REPRESENTATION
- Record/represent/interpret data: Venn, block graphs, bar charts, bar-line graphs, line graphs (axis from zero)
- Interpret pie-charts, frequency tables, tallying
- Calculate and use mean and range of discrete data

EXPLICIT EXCLUSIONS (out of scope):
- Imperial units
- Scale beyond simple drawings
- Meaning of congruence in 2-D shapes
- Measuring or drawing angles
- Angles other than internal angles of triangles and quadrilaterals

OUT OF SCOPE = anything requiring a technique, notation or concept not listed above.
Model case (already removed): "nth term" / general term formulas / algebraic notation such as n², 2n, 3n+1 — correct maths, correct format, but years beyond a 10-year-old. IN SCOPE by contrast: predicting the next/missing number by continuing a pattern; a letter for an unknown whole number in a one-step equation (6 + a = 24).`;

// ── Reference-question ceiling (loaded per category at runtime) ──
const refCache = {};
async function loadReferenceAnchors(category) {
  if (refCache[category]) return refCache[category];
  // Prefer the hardest real questions as the ceiling illustration.
  const url = `${SUPABASE_URL}/rest/v1/reference_questions`
    + `?category=eq.${encodeURIComponent(category)}`
    + `&select=question_text,correct_answer,difficulty&order=difficulty.desc&limit=8`;
  const res = await fetch(url, { headers: sbHeaders });
  const rows = res.ok ? await res.json() : [];
  const text = rows.length
    ? rows.map((r, i) => `${i + 1}. [${r.difficulty || '?'}] ${(r.question_text || '').replace(/\s+/g, ' ').trim()}`).join('\n')
    : '(no reference examples for this category)';
  refCache[category] = text;
  return text;
}

// ── Prompt builder (SCOPE only) ──
function buildPrompt(q, referenceAnchor) {
  const optionsText = q.options
    ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join('\n')
    : 'Written answer (no options)';

  return `You are auditing a Northern Ireland SEAG Transfer Test question bank for pupils aged 10-11 (Key Stage 2). British English, UK curriculum.

Your ONLY job is to judge CURRICULUM SCOPE and DIFFICULTY CEILING. You are NOT checking correctness, wording, or format — a separate system handles those. Assume the maths is correct and the format is fine.

THE AUTHORITATIVE SEAG MATHS SCOPE (2026 Specification). Anything NOT listed here is out of scope:
${SEAG_SPEC}

REAL PAST-PAPER QUESTIONS for topic "${q.topic}" (this is the actual difficulty ceiling — nothing in scope is harder than these):
${referenceAnchor}

QUESTION UNDER REVIEW:
Topic: ${q.topic} | Year: ${q.year_group} | Difficulty tag: ${q.difficulty}/5
${q.question_text}
${q.passage ? `\nPassage/context:\n${q.passage}\n` : ''}
Options:
${optionsText}
Correct answer: ${q.correct_answer}

AREA/VOLUME CLARIFICATION (do NOT over-flag these): The spec lists "finding area by counting squares" AND "calculating areas and volumes of two and three dimensional shapes" as SEPARATE permissions, not one restricted method. Calculating the area or volume of a 2-D or 3-D shape with a standard formula IS in scope — including rectangle area (l × w), triangle area (½ × base × height), parallelogram area (base × height), and cuboid volume (l × w × h). Do not flag these as beyond scope.

PIE-CHART CLARIFICATION (do NOT over-flag these): Computing a frequency/count from a pie-chart sector angle IS in scope. The spec lists pie-chart interpretation under Data Representation and quarter/half/three-quarter/whole turns under Shape and Space; reading a sector as a fraction of a full turn (angle ÷ 360 × total) is the normal way to interpret a pie chart, and the arithmetic is within Number scope. Do not flag pie-chart angle-to-frequency questions as beyond scope.

CHECK BOTH INCLUSIONS AND EXCLUSIONS. A question is BEYOND_SCOPE in either of two ways:
(a) it requires a technique, notation or concept NOT listed in the spec (e.g. nth-term formulas, algebraic notation like n²/2n, simultaneous equations, standard deviation, speed/rate compound measures, ratio/proportion beyond simple, negative-number arithmetic beyond temperature scales, coordinates outside the first quadrant, circle area/circumference, Pythagoras, indices beyond square/cube, recurring-decimal division); OR
(b) it hits one of the spec's EXPLICIT EXCLUSIONS directly: Imperial units; scale from anything other than a simple drawing; congruence in 2-D shapes; measuring or drawing angles; angles other than internal angles of triangles and quadrilaterals.

DECISION:
- IN_SCOPE = every technique, notation and concept the pupil needs is in the spec above (inclusions), it hits no explicit exclusion, and it is no harder than the real past-paper ceiling.
- BEYOND_SCOPE = it fails via (a) not-listed, or (b) hits-an-exclusion.

When BEYOND_SCOPE: name the specific concept; set spec_area to the single most relevant spec section (NUMBER, MEASUREMENT, SHAPE AND SPACE, MONEY, PROBABILITY, DATA REPRESENTATION, or "not in spec"); and in the reason state whether it is "not listed" or names the exact exclusion it hits.

Do all reasoning silently. Output ONLY this JSON object, nothing before or after:
{"verdict":"IN_SCOPE|BEYOND_SCOPE","concept":"the technique/notation/concept required","spec_area":"single spec section, or 'not in spec'","basis":"not-listed|exclusion","reason":"max 15 words; if exclusion, name which"}`;
}

// ── Claude call (brace-matching extractor from validate-all-ai.js) ──
async function askClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw  = (data.content?.[0]?.text || '').trim();
  const json = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  const m    = json.match(/\{[\s\S]*?\}/);
  if (!m) throw new Error(`No JSON in: ${raw.slice(0, 100)}`);
  const result = JSON.parse(m[0]);
  if (!['IN_SCOPE', 'BEYOND_SCOPE'].includes(result.verdict)) throw new Error(`Bad verdict: ${result.verdict}`);
  return result;
}

// ── Fetch ──
async function fetchTopicAll(topic) {
  let rows = [], offset = 0;
  while (true) {
    let url = `${SUPABASE_URL}/rest/v1/questions?validated=eq.true&topic=eq.${encodeURIComponent(topic)}`
      + `&select=id,subject,topic,year_group,difficulty,question_text,options,correct_answer,passage`
      + `&limit=${PAGE_SIZE}&offset=${offset}`;
    if (FILTER_YEAR) url += `&year_group=eq.${encodeURIComponent(FILTER_YEAR)}`;
    const res = await fetch(url, { headers: sbHeaders });
    if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

function evenSample(arr, n) {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

async function processBatch(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk = items.slice(i, i + CONCURRENCY);
    out.push(...await Promise.all(chunk.map(fn)));
    if (i + CONCURRENCY < items.length) await new Promise(r => setTimeout(r, DELAY_MS));
  }
  return out;
}

async function main() {
  const topics = FILTER_TOPIC ? [FILTER_TOPIC] : MATHS_TOPICS;
  console.log(`audit-scope-ai   model=${MODEL}  topics=${topics.join(',')}  ${SAMPLE ? `SAMPLE=${SAMPLE}` : 'FULL'}${FILTER_YEAR ? `  year=${FILTER_YEAR}` : ''}\n`);

  // Assemble the question set
  let questions = [];
  for (const t of topics) {
    const all = await fetchTopicAll(t);
    let picked = all;
    if (SAMPLE) picked = evenSample(all, Math.max(1, Math.round(SAMPLE / topics.length)));
    questions.push(...picked);
    console.log(`  ${t.padEnd(22)} ${all.length} active → ${picked.length} selected`);
  }
  if (LIMIT < Infinity) questions = questions.slice(0, LIMIT);

  // Preload reference anchors for the categories in play
  for (const t of topics) await loadReferenceAnchors(t);

  // ── Resumable checkpoint ──────────────────────────────────────────────────
  const ckptPath = resolve(__dir, '../scripts/scope-audit-progress.json');
  const flagsPath = resolve(__dir, '../scripts/scope-audit-flags.json');
  const total = { IN_SCOPE: 0, BEYOND_SCOPE: 0, ERROR: 0 };
  const byTopic = {};
  let flags = [];
  const processed = new Set();

  if (!SAMPLE) {
    try {
      const prev = JSON.parse(readFileSync(ckptPath, 'utf8'));
      if (prev.processedIds) {
        for (const id of prev.processedIds) processed.add(id);
        flags = prev.flags || [];
        Object.assign(total, prev.totals || {});
        Object.assign(byTopic, prev.byTopic || {});
        console.log(`Resuming — ${processed.size} already audited, ${flags.length} flags carried over.`);
      }
    } catch { /* no checkpoint, fresh run */ }
  }

  const pending = questions.filter(q => !processed.has(q.id));
  console.log(`\nAuditing ${pending.length} questions (${questions.length} total, ${processed.size} done)...\n`);

  let done = processed.size;
  const start = Date.now();
  const runStartDone = done;

  function flush() {
    const payload = {
      updated: new Date().toISOString(), model: MODEL,
      totalPlanned: questions.length, processedIds: [...processed],
      totals: total, byTopic, flags,
    };
    writeFileSync(ckptPath, JSON.stringify(payload, null, 2));
    writeFileSync(flagsPath, JSON.stringify({ ...payload, note: 'flag list only' }, null, 2));
  }

  // Chunked loop so we can persist after every chunk (survives interruption).
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const chunk = pending.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async (q) => {
      const t = q.topic;
      byTopic[t] = byTopic[t] || { IN_SCOPE: 0, BEYOND_SCOPE: 0, ERROR: 0 };
      try {
        const r = await askClaude(buildPrompt(q, refCache[t]));
        total[r.verdict]++; byTopic[t][r.verdict]++;
        if (r.verdict === 'BEYOND_SCOPE') {
          flags.push({ id: q.id, topic: t, year: q.year_group, difficulty: q.difficulty,
            concept: r.concept, spec_area: r.spec_area, basis: r.basis || '', reason: r.reason,
            question: (q.question_text || '').replace(/\s+/g, ' ').trim(), options: q.options, correct: q.correct_answer });
        }
        processed.add(q.id);
      } catch (e) {
        total.ERROR++; byTopic[t].ERROR++;
        // NOT added to processed — a resume will retry errored questions.
        if (total.ERROR % 5 === 1) console.error(`  ERR ${q.id} [${t}] — ${e.message.slice(0, 90)}`);
      }
      done++;
    }));
    flush(); // persist after each chunk
    if (done % 50 < CONCURRENCY) {
      const ran = done - runStartDone;
      const rate = (ran / ((Date.now() - start) / 1000)).toFixed(2);
      const eta = rate > 0 ? Math.round((pending.length - ran) / rate / 60) : '?';
      console.log(`  ${done}/${questions.length}  in=${total.IN_SCOPE} beyond=${total.BEYOND_SCOPE} err=${total.ERROR} (${rate}/s, ETA ~${eta}m)`);
    }
    if (i + CONCURRENCY < pending.length) await new Promise(r => setTimeout(r, DELAY_MS));
  }
  flush();

  const elapsed = Math.round((Date.now() - start) / 1000);
  console.log(`\nDone in ${Math.floor(elapsed/60)}m ${elapsed%60}s\n`);

  console.log('── Scope results by topic ──────────────────────────────────');
  console.log(`${'Topic'.padEnd(22)} ${'Total'.padStart(6)} ${'InScope'.padStart(8)} ${'Beyond'.padStart(7)} ${'Err'.padStart(4)}`);
  for (const [t, c] of Object.entries(byTopic).sort()) {
    const tot = c.IN_SCOPE + c.BEYOND_SCOPE + c.ERROR;
    console.log(`${t.padEnd(22)} ${String(tot).padStart(6)} ${String(c.IN_SCOPE).padStart(8)} ${String(c.BEYOND_SCOPE).padStart(7)} ${String(c.ERROR).padStart(4)}`);
  }
  console.log(`\nTOTAL  in-scope=${total.IN_SCOPE}  BEYOND=${total.BEYOND_SCOPE}  errors=${total.ERROR}`);

  // Clustering: which spec areas the flags relate to (spot patterns in the full run)
  if (flags.length) {
    const bySpec = {};
    for (const f of flags) { const k = f.spec_area || 'unspecified'; bySpec[k] = (bySpec[k] || 0) + 1; }
    console.log('\n── Flag clustering by spec area ────────────────────────────');
    for (const [area, n] of Object.entries(bySpec).sort(([, a], [, b]) => b - a)) {
      console.log(`  ${String(n).padStart(4)}  ${area}`);
    }
    const byBasis = {};
    for (const f of flags) { const k = f.basis || 'unspecified'; byBasis[k] = (byBasis[k] || 0) + 1; }
    console.log('  basis: ' + Object.entries(byBasis).map(([k, v]) => `${k}=${v}`).join('  '));
  }

  console.log(`\n══ BEYOND-SCOPE FLAGS (${flags.length}) ══════════════════════════════`);
  for (const f of flags) {
    console.log(`\n[${f.topic} / ${f.year} / diff ${f.difficulty}]  ${f.id}`);
    console.log(`  Q: ${f.question}`);
    if (f.options) console.log(`  opts: ${JSON.stringify(f.options)}   correct: ${f.correct}`);
    console.log(`  concept:   ${f.concept}`);
    console.log(`  spec area: ${f.spec_area}   (${f.basis})`);
    console.log(`  reason:    ${f.reason}`);
  }

  flush();
  console.log(`\nFlags + checkpoint written to ${flagsPath}`);
  console.log('REPORT ONLY — no database changes made.');
  if (total.ERROR === 0 && !SAMPLE) console.log('(clean finish — safe to delete scope-audit-progress.json)');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
