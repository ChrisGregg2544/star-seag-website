/**
 * regenerate-missing-diagrams.js
 * Backfills diagram SVGs for questions where diagram IS NULL, by parsing question_text.
 *
 * Targets: geometry, measurement, statistics, fractions_decimals
 * Skips questions where no diagram pattern can be inferred from the text.
 *
 * Usage: node scripts/regenerate-missing-diagrams.js
 *   DRY_RUN=1 node scripts/regenerate-missing-diagrams.js   ← preview without writing
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { generateDiagram } from '../diagram-generator.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── .env ───────────────────────────────────────────────────────────────────────
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY  = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const DRY_RUN      = process.env.DRY_RUN === '1';
const PAGE_SIZE    = 200;
const UPDATE_DELAY = 30; // ms between PATCH requests

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const VISUAL_TOPICS = ['geometry', 'measurement', 'statistics', 'fractions_decimals'];

// ── Supabase helpers ───────────────────────────────────────────────────────────
const baseHeaders = {
  apikey:         SERVICE_KEY,
  Authorization:  `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchPage(offset) {
  const topicFilter = VISUAL_TOPICS.map(t => `topic.eq.${t}`).join(',');
  const url = `${SUPABASE_URL}/rest/v1/questions`
    + `?or=(${topicFilter})`
    + `&diagram=is.null`
    + `&source=eq.ai_generated_v2`
    + `&validated=eq.true`
    + `&select=id,topic,year_group,question_text`
    + `&limit=${PAGE_SIZE}&offset=${offset}`;

  const res = await fetch(url, { headers: baseHeaders });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// Second-pass fetch: statistics questions that already have a diagram (overwrite with improved generator)
async function fetchStatisticsExisting(offset) {
  const url = `${SUPABASE_URL}/rest/v1/questions`
    + `?topic=eq.statistics`
    + `&diagram=not.is.null`
    + `&source=eq.ai_generated_v2`
    + `&validated=eq.true`
    + `&select=id,topic,year_group,question_text`
    + `&limit=${PAGE_SIZE}&offset=${offset}`;

  const res = await fetch(url, { headers: baseHeaders });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function patchDiagram(id, svg) {
  const url = `${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body:    JSON.stringify({ diagram: svg }),
  });
  if (!res.ok) throw new Error(`PATCH failed for ${id} (${res.status}): ${await res.text()}`);
}

// ── SVG inference from question_text ──────────────────────────────────────────
function nums(text) {
  return (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
}

// Try to extract chart data points from question text.
// Returns { labels, values } or null if nothing found.
function extractChartData(text) {
  // Pattern 1: "Label: number" or "Label - number" pairs (e.g. "Dogs: 8, Cats: 5")
  const pairPat = /\b([A-Z][a-zA-Z]{1,10})\s*[:\-–]\s*(\d+)/g;
  const pairs = [...text.matchAll(pairPat)];
  if (pairs.length >= 3) {
    return {
      labels: pairs.slice(0, 6).map(m => m[1].slice(0, 5)),
      values: pairs.slice(0, 6).map(m => Number(m[2])),
    };
  }

  // Pattern 2: day names followed by a number
  const dayPat = /\b(Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\w*[\s,:]+(\d+)/gi;
  const days = [...text.matchAll(dayPat)];
  if (days.length >= 2) {
    return {
      labels: days.slice(0, 7).map(m => m[1].slice(0, 3)),
      values: days.slice(0, 7).map(m => Number(m[2])),
    };
  }

  // Pattern 3: month names followed by a number
  const monthPat = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\w*[\s,:]+(\d+)/gi;
  const months = [...text.matchAll(monthPat)];
  if (months.length >= 2) {
    return {
      labels: months.slice(0, 6).map(m => m[1].slice(0, 3)),
      values: months.slice(0, 6).map(m => Number(m[2])),
    };
  }

  // Pattern 4: a run of 3–7 comma-separated small integers (e.g. "3, 7, 2, 5, 4")
  const commaMatch = text.match(/\b\d+\b(?:\s*,\s*\b\d+\b){2,6}/);
  if (commaMatch) {
    const vals = commaMatch[0].split(/\s*,\s*/).map(Number).filter(n => n > 0 && n < 200);
    if (vals.length >= 3 && vals.length <= 7) {
      return {
        labels: vals.map((_, i) => String.fromCharCode(65 + i)),
        values: vals,
      };
    }
  }

  return null;
}

function inferDiagram(topic, questionText) {
  if (!questionText) return null;
  const t = questionText.toLowerCase();

  // ── Geometry ────────────────────────────────────────────────────────────────
  if (topic === 'geometry') {
    // Cuboid (check before rectangle — cuboid has 3 dimensions)
    if (t.includes('cuboid') || t.includes('volume')) {
      const n = nums(t);
      if (n.length >= 3) return generateDiagram('cuboid', { length: n[0], width: n[1], height: n[2] });
    }
    // Triangle with angles
    if (t.includes('triangle') || t.includes('angle')) {
      const angles = (t.match(/(\d+)°/g) || []).map(a => parseInt(a));
      if (angles.length >= 2) return generateDiagram('triangle', { angles });
      // Generic triangle if mentioned without angle values
      if (t.includes('triangle')) return generateDiagram('triangle', { angles: [60, 60] });
    }
    // Rectangle
    if (t.includes('rectangle')) {
      const n = nums(t);
      if (n.length >= 2) return generateDiagram('shape', { subtype: 'rectangle', length: n[0], width: n[1] });
    }
    // Square
    if (t.includes('square')) {
      const n = nums(t);
      if (n.length >= 1) return generateDiagram('shape', { subtype: 'square', side: n[0] });
    }
    // L-shape / composite (render as rectangle approximation)
    if (t.includes('l-shape') || t.includes('composite')) {
      const n = nums(t);
      if (n.length >= 2) return generateDiagram('shape', { subtype: 'rectangle', length: n[0], width: n[1] });
    }
    // Circle / radius / diameter
    if (t.includes('circle') || t.includes('radius') || t.includes('diameter')) {
      return generateDiagram('shape', { subtype: 'hexagon' }); // nearest supported round shape
    }
    // Generic shape fallback
    const shapes = ['pentagon', 'hexagon', 'octagon', 'parallelogram', 'rhombus', 'trapezium'];
    for (const s of shapes) {
      if (t.includes(s)) return generateDiagram('shape', { subtype: s });
    }
  }

  // ── Measurement ─────────────────────────────────────────────────────────────
  if (topic === 'measurement') {
    if (t.includes('ruler') || t.includes('length') || t.includes('centimetre') || t.includes('millimetre')) {
      const n = nums(t);
      const pos = n.length ? Math.min(n[0], 30) : 15;
      return generateDiagram('measurement-scale', { type: 'ruler', highlight: pos });
    }
    if (t.includes('kg') || t.includes('gram') || t.includes('weigh') || t.includes('mass') || t.includes('scale')) {
      const n = nums(t);
      const pos = n.length ? Math.min(n[0], 100) : 50;
      return generateDiagram('measurement-scale', { type: 'weighing-dial', highlight: pos });
    }
    if (t.includes('litre') || t.includes('ml') || t.includes('jug') || t.includes('capacity') || t.includes('liquid')) {
      const n = nums(t);
      const pos = n.length ? Math.min(n[0], 1000) : 500;
      return generateDiagram('measurement-scale', { type: 'measuring-jug', highlight: pos });
    }
  }

  // ── Statistics ───────────────────────────────────────────────────────────────
  if (topic === 'statistics') {
    // Pie/percent — extract actual percentage from question text
    if (t.includes('pie') || t.includes('%') || t.includes('percent')) {
      const pcts = (t.match(/(\d+)\s*%/g) || []).map(p => parseInt(p));
      if (pcts.length >= 1 && pcts[0] > 0 && pcts[0] < 100) {
        return generateDiagram('pie-chart', {
          data: [
            { label: `${pcts[0]}%`, value: pcts[0] },
            { label: 'Remaining',   value: 100 - pcts[0] },
          ],
        });
      }
    }

    // Try to extract real data from question text (uses original-case text for Name: value pattern)
    const chartData = extractChartData(questionText);
    const labels = chartData?.labels || null;
    const values = chartData?.values || null;

    if (t.includes('bar chart') || t.includes('bar graph') || t.includes('tally') || t.includes('frequency')) {
      return generateDiagram('bar-chart', {
        labels: labels || ['A', 'B', 'C', 'D', 'E'],
        values: values || [4, 7, 3, 6, 5],
      });
    }
    if (t.includes('line graph') || t.includes('line chart')) {
      return generateDiagram('line-graph', {
        labels: labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        values: values || [3, 5, 4, 7, 6],
      });
    }
    if (t.includes('pictogram')) {
      return generateDiagram('pictogram', {
        labels: labels || ['A', 'B', 'C', 'D'],
        values: values || [3, 5, 2, 4],
      });
    }
  }

  // ── Fractions / Decimals ─────────────────────────────────────────────────────
  if (topic === 'fractions_decimals') {
    const fracMatch = t.match(/(\d+)\s*\/\s*(\d+)/);
    if (fracMatch) {
      const num   = parseInt(fracMatch[1]);
      const denom = parseInt(fracMatch[2]);
      if (denom >= 2 && denom <= 12 && num < denom) {
        return generateDiagram('fraction-grid', { rows: denom, cols: 1, shaded: num });
      }
    }
  }

  return null;
}

// ── Shared patch loop ─────────────────────────────────────────────────────────
async function processRows(rows, counters) {
  for (const row of rows) {
    const svg = inferDiagram(row.topic, row.question_text);
    if (!svg) { counters.skipped++; continue; }

    if (DRY_RUN) {
      counters.patched++;
      console.log(`  DRY  ${row.topic} ${row.year_group} — ${svg.length} chars — ${row.question_text.slice(0, 70)}`);
      continue;
    }

    try {
      await patchDiagram(row.id, svg);
      counters.patched++;
      if (counters.patched % 50 === 0) console.log(`  ${counters.patched} patched so far...`);
      await new Promise(r => setTimeout(r, UPDATE_DELAY));
    } catch (e) {
      counters.errors++;
      console.error(`  ERR ${row.id} — ${e.message}`);
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`regenerate-missing-diagrams`);
  console.log(`  topics   : ${VISUAL_TOPICS.join(', ')}`);
  console.log(`  DRY_RUN  : ${DRY_RUN}`);
  console.log('');

  const counters = { fetched: 0, patched: 0, skipped: 0, errors: 0 };

  // Pass 1: all visual topics where diagram IS NULL
  console.log('── Pass 1: fill missing diagrams ────────────');
  let offset = 0;
  while (true) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;
    counters.fetched += rows.length;
    console.log(`Page offset=${offset}: ${rows.length} rows`);
    await processRows(rows, counters);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Pass 2: statistics only — overwrite existing diagrams with improved generator
  console.log('\n── Pass 2: overwrite statistics diagrams ────');
  offset = 0;
  while (true) {
    const rows = await fetchStatisticsExisting(offset);
    if (!rows.length) break;
    counters.fetched += rows.length;
    console.log(`Page offset=${offset}: ${rows.length} rows`);
    await processRows(rows, counters);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log('');
  console.log('── Summary ──────────────────────────────────');
  console.log(`  Fetched : ${counters.fetched}`);
  console.log(`  Patched : ${counters.patched}${DRY_RUN ? ' (dry run — no writes)' : ''}`);
  console.log(`  Skipped : ${counters.skipped} (no diagram pattern matched)`);
  console.log(`  Errors  : ${counters.errors}`);

  if (DRY_RUN && counters.patched > 0) {
    console.log('');
    console.log('Run without DRY_RUN=1 to apply changes.');
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
