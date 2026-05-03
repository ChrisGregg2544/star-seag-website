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
    if (t.includes('bar chart') || t.includes('bar graph') || t.includes('frequency')) {
      return generateDiagram('bar-chart', {
        labels: ['A', 'B', 'C', 'D'],
        values: [4, 7, 3, 6],
      });
    }
    if (t.includes('line graph') || t.includes('line chart')) {
      return generateDiagram('line-graph', {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        values: [3, 5, 4, 7, 6],
      });
    }
    if (t.includes('pictogram')) {
      return generateDiagram('pictogram', {
        labels: ['A', 'B', 'C'],
        values: [3, 5, 4],
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

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`regenerate-missing-diagrams`);
  console.log(`  topics   : ${VISUAL_TOPICS.join(', ')}`);
  console.log(`  DRY_RUN  : ${DRY_RUN}`);
  console.log('');

  let offset = 0;
  let totalFetched = 0;
  let totalPatched = 0;
  let totalSkipped = 0;
  let totalErrors  = 0;

  while (true) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;

    totalFetched += rows.length;
    console.log(`Page offset=${offset}: ${rows.length} rows`);

    for (const row of rows) {
      const svg = inferDiagram(row.topic, row.question_text);

      if (!svg) {
        totalSkipped++;
        continue;
      }

      if (DRY_RUN) {
        totalPatched++;
        console.log(`  DRY  ${row.topic} ${row.year_group} — ${svg.length} chars — ${row.question_text.slice(0, 70)}`);
        continue;
      }

      try {
        await patchDiagram(row.id, svg);
        totalPatched++;
        if (totalPatched % 50 === 0) console.log(`  ${totalPatched} patched so far...`);
        await new Promise(r => setTimeout(r, UPDATE_DELAY));
      } catch (e) {
        totalErrors++;
        console.error(`  ERR ${row.id} — ${e.message}`);
      }
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log('');
  console.log('── Summary ──────────────────────────────────');
  console.log(`  Fetched : ${totalFetched}`);
  console.log(`  Patched : ${totalPatched}${DRY_RUN ? ' (dry run — no writes)' : ''}`);
  console.log(`  Skipped : ${totalSkipped} (no diagram pattern matched)`);
  console.log(`  Errors  : ${totalErrors}`);

  if (DRY_RUN && totalPatched > 0) {
    console.log('');
    console.log('Run without DRY_RUN=1 to apply changes.');
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
