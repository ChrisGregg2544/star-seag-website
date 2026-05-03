/**
 * regenerate-missing-diagrams.js
 * Backfills diagram SVGs for questions that have diagram_description but diagram IS NULL.
 *
 * Targets: geometry, measurement, statistics, fractions_decimals, algebra_sequences
 * Skips questions with no diagram_description (can't generate without one).
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
const BATCH_SIZE   = 100; // questions fetched per page
const UPDATE_DELAY = 50;  // ms between PATCH requests

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const VISUAL_TOPICS = [
  'geometry',
  'measurement',
  'statistics',
  'fractions_decimals',
  'algebra_sequences',
];

// ── Supabase helpers ───────────────────────────────────────────────────────────
const headers = {
  apikey:        SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchPage(offset) {
  const topicFilter = VISUAL_TOPICS.map(t => `topic.eq.${t}`).join(',');
  const url = `${SUPABASE_URL}/rest/v1/questions`
    + `?or=(${topicFilter})`
    + `&diagram=is.null`
    + `&diagram_description=not.is.null`
    + `&source=eq.ai_generated_v2`
    + `&validated=eq.true`
    + `&select=id,topic,year_group,diagram_description`
    + `&limit=${BATCH_SIZE}&offset=${offset}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function patchDiagram(id, svg) {
  const url = `${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { ...headers, Prefer: 'return=minimal' },
    body:    JSON.stringify({ diagram: svg }),
  });
  if (!res.ok) throw new Error(`PATCH failed for ${id} (${res.status}): ${await res.text()}`);
}

// ── SVG generation (mirrors generateSVGFromDescription in question-builder.js) ─
function generateSVGFromDescription(description) {
  if (!description) return null;

  if (description.includes('triangle')) {
    const angleMatches = description.match(/(\d+)°/g);
    const angles = angleMatches ? angleMatches.map(a => parseInt(a)) : [];
    return generateDiagram('triangle', { angles });
  }
  if (description.includes('rectangle')) {
    const nums = description.match(/\d+/g);
    if (!nums || nums.length < 2) return null;
    const [length, width] = nums.map(Number);
    return generateDiagram('shape', { subtype: 'rectangle', length, width });
  }
  if (description.includes('square')) {
    const nums = description.match(/\d+/g);
    if (!nums) return null;
    const side = Number(nums[0]);
    return generateDiagram('shape', { subtype: 'square', side });
  }
  if (description.includes('cuboid')) {
    const nums = description.match(/\d+/g);
    if (!nums || nums.length < 3) return null;
    const [length, width, height] = nums.map(Number);
    return generateDiagram('cuboid', { length, width, height });
  }
  if (description.includes('fraction-grid')) {
    const nums = description.match(/\d+/g);
    if (!nums || nums.length < 2) return null;
    const [num, denom] = nums.map(Number);
    return generateDiagram('fraction-grid', { rows: Math.min(denom, 10), cols: 1, shaded: num });
  }
  if (description.includes('pie-chart: fraction')) {
    const fractions = description.match(/(\d+)\/(\d+)/g);
    if (!fractions) return null;
    const data = fractions.map(f => {
      const [n, d] = f.split('/').map(Number);
      return { label: f, value: n / d };
    });
    return generateDiagram('pie-chart', { data });
  }
  if (description.includes('pie-chart: percentage')) {
    const nums = description.match(/\d+/g);
    if (!nums) return null;
    const percent = Number(nums[0]);
    return generateDiagram('pie-chart', {
      data: [
        { label: `${percent}%`, value: percent },
        { label: 'Remaining', value: 100 - percent },
      ],
    });
  }
  if (description.includes('measurement-scale: ruler')) {
    const nums = description.match(/\d+/g);
    const pos = nums ? Number(nums[0]) : 0;
    return generateDiagram('measurement-scale', { type: 'ruler', highlight: pos });
  }
  if (description.includes('measurement-scale: weighing-dial')) {
    const nums = description.match(/\d+/g);
    const pos = nums ? Number(nums[0]) : 0;
    return generateDiagram('measurement-scale', { type: 'weighing-dial', highlight: pos });
  }
  if (description.includes('measurement-scale: measuring-jug')) {
    const nums = description.match(/\d+/g);
    const pos = nums ? Number(nums[0]) : 0;
    return generateDiagram('measurement-scale', { type: 'measuring-jug', highlight: pos });
  }

  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`regenerate-missing-diagrams: topics=${VISUAL_TOPICS.join(', ')} DRY_RUN=${DRY_RUN}`);

  let offset = 0;
  let totalFetched = 0;
  let totalPatched = 0;
  let totalSkipped = 0;
  let totalErrors  = 0;

  while (true) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;

    totalFetched += rows.length;
    console.log(`\nPage offset=${offset}: ${rows.length} rows`);

    for (const row of rows) {
      const svg = generateSVGFromDescription(row.diagram_description);

      if (!svg) {
        totalSkipped++;
        console.log(`  SKIP  ${row.id} (${row.topic} ${row.year_group}) — no matcher for: ${row.diagram_description.slice(0, 60)}`);
        continue;
      }

      if (DRY_RUN) {
        totalPatched++;
        console.log(`  DRY   ${row.id} (${row.topic} ${row.year_group}) — would write ${svg.length} chars`);
        continue;
      }

      try {
        await patchDiagram(row.id, svg);
        totalPatched++;
        console.log(`  OK    ${row.id} (${row.topic} ${row.year_group}) — ${svg.length} chars`);
        await new Promise(r => setTimeout(r, UPDATE_DELAY));
      } catch (e) {
        totalErrors++;
        console.error(`  ERR   ${row.id} — ${e.message}`);
      }
    }

    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  console.log(`\n── Summary ──────────────────────────────────`);
  console.log(`  Fetched : ${totalFetched}`);
  console.log(`  Patched : ${totalPatched}${DRY_RUN ? ' (dry run — no writes)' : ''}`);
  console.log(`  Skipped : ${totalSkipped} (no diagram matcher)`);
  console.log(`  Errors  : ${totalErrors}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
