/**
 * reseed-diagrams.js
 * Regenerates SVG diagrams for all validated questions that already have a
 * diagram, using the updated attachDiagram() logic that extracts measurements
 * from question text.
 *
 * Run with:
 *   node reseed-diagrams.js
 *
 * Optional flags:
 *   --dry-run     Log what would change without writing to Supabase
 *   --limit N     Only process first N questions (for testing)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { generateDiagram } from './diagram-generator.js';

// ── Load .env manually (no dotenv dependency) ─────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync('.env', 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env not found — rely on environment variables already set
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set. Add it to .env or pass as env var.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1]) : Infinity;

// ── Measurement / angle extractors (mirrors seed-questions.js) ────────────────
function extractMeasurements(text, count) {
  const pat = /(\d+(?:\.\d+)?)\s*(cm|m|mm|km)/g;
  const found = [];
  let m;
  while ((m = pat.exec(text)) !== null && found.length < count) {
    found.push(`${m[1]} ${m[2]}`);
  }
  while (found.length < count) found.push('');
  return found;
}

function extractAngles(text, count) {
  const pat = /(\d+(?:\.\d+)?)\s*(?:°|degrees?)/g;
  const found = [];
  let m;
  while ((m = pat.exec(text)) !== null && found.length < count) {
    found.push(`${m[1]}°`);
  }
  while (found.length < count) found.push('');
  return found;
}

function attachDiagram(q) {
  const text = ((q.question_text || '') + ' ' + (q.topic || '')).toLowerCase();

  if (/right[- ]angled/.test(text) && /triangle/.test(text)) {
    const [sideA, sideB, sideC] = extractMeasurements(text, 3);
    const [, angleB, angleC] = extractAngles(text, 3);
    return generateDiagram('triangle', { subtype: 'right-angled', sideA, sideB, sideC, angleB, angleC, unknownAngle: /\ba°|unknown/.test(text) });
  }
  if (/equilateral/.test(text) && /triangle/.test(text)) {
    const [sideA] = extractMeasurements(text, 1);
    return generateDiagram('triangle', { subtype: 'equilateral', sideA, sideB: sideA, sideC: sideA });
  }
  if (/isosceles/.test(text) && /triangle/.test(text)) {
    const [sideA, sideB] = extractMeasurements(text, 2);
    const [angleA, angleB, angleC] = extractAngles(text, 3);
    return generateDiagram('triangle', { subtype: 'isosceles', sideA, sideB, sideC: sideB, angleA, angleB, angleC });
  }
  if (/\btriangle\b/.test(text)) {
    const [sideA, sideB, sideC] = extractMeasurements(text, 3);
    const [angleA, angleB, angleC] = extractAngles(text, 3);
    return generateDiagram('triangle', { subtype: 'scalene', sideA, sideB, sideC, angleA, angleB, angleC, unknownAngle: /\ba°|unknown/.test(text) });
  }

  if (/\bsquare\b/.test(text) && !/square number/.test(text)) {
    const [width] = extractMeasurements(text, 1);
    return generateDiagram('shape', { subtype: 'square', width });
  }
  if (/\brectangle\b/.test(text)) {
    const [width, height] = extractMeasurements(text, 2);
    return generateDiagram('shape', { subtype: 'rectangle', width, height });
  }
  if (/\bhexagon\b/.test(text))     return generateDiagram('shape', { subtype: 'hexagon' });
  if (/\bpentagon\b/.test(text))    return generateDiagram('shape', { subtype: 'pentagon' });
  if (/\boctagon\b/.test(text))     return generateDiagram('shape', { subtype: 'octagon' });
  if (/\bparallelogram\b/.test(text)) {
    const [width, height] = extractMeasurements(text, 2);
    return generateDiagram('shape', { subtype: 'parallelogram', width, height });
  }
  if (/\brhombus\b/.test(text))     return generateDiagram('shape', { subtype: 'rhombus' });
  if (/\btrapezium\b/.test(text)) {
    const [width] = extractMeasurements(text, 1);
    return generateDiagram('shape', { subtype: 'trapezium', width });
  }

  if (/\bangle\b|\bdegrees?\b|\bprotractor\b/.test(text))
    return generateDiagram('angle', { unknown: /unknown|a°|find/.test(text) });

  if (/\bnet\b|\bunfold/.test(text))
    return generateDiagram('net', {});

  if (/shaded|fraction.*grid|grid.*fraction/.test(text))
    return generateDiagram('fraction-grid', {});

  if (/bar chart|bar graph|\bfrequency\b/.test(text))
    return generateDiagram('bar-chart', {});

  if (/line graph/.test(text))
    return generateDiagram('line-graph', {});

  if (/\bcoordinates?\b|\bplotted\b|\b(?:on a|using a|the)\s+grid\b/.test(text) && !/fraction.*grid|grid.*fraction|shaded/.test(text)) {
    const ptPat = /\(\s*(\d+)\s*,\s*(\d+)\s*\)/g;
    const pts = [];
    let ptm;
    while ((ptm = ptPat.exec(text)) !== null) {
      const px = parseInt(ptm[1]), py = parseInt(ptm[2]);
      if (px >= 0 && px <= 10 && py >= 0 && py <= 10) pts.push({ x: px, y: py });
    }
    return generateDiagram('coordinate-grid', { points: pts });
  }

  if (/\bpictogram\b/.test(text)) {
    const keyMatch = text.match(/(?:key|symbol|each\s+(?:symbol|picture|icon|star|image))[^=:\d]*[=:]\s*(\d+)/i)
                  || text.match(/represents?\s+(\d+)/i)
                  || text.match(/worth\s+(\d+)/i);
    const keyValue = keyMatch ? (parseInt(keyMatch[1]) || 1) : 1;
    const data = [];
    const dpat = /([A-Z][a-zA-Z ]{1,20}?)\s*[:=]\s*(\d+)(?:\s*(?:symbol|book|pet|pupil|child|student|vote|point)s?)?/g;
    let dm;
    while ((dm = dpat.exec(text)) !== null) {
      const label = dm[1].trim();
      if (['key', 'answer', 'note'].includes(label.toLowerCase())) continue;
      const count = parseInt(dm[2]);
      if (count >= 0 && count <= 20 && data.length < 8) data.push({ label, count });
    }
    if (data.length >= 2) return generateDiagram('pictogram', { data, keyValue });
    return null;
  }

  if (/number line|missing number/.test(text))
    return generateDiagram('number-line', {});

  if (/\bruler\b|\bthermometer\b|\bweighs?\b|\bweighing\b/.test(text))
    return generateDiagram('measurement-scale', { type: /therm/.test(text) ? 'thermometer' : /weigh/.test(text) ? 'weighing-dial' : 'ruler' });

  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`Fetching validated questions with diagrams...${DRY_RUN ? ' [DRY RUN]' : ''}`);

  // Fetch in pages to avoid hitting response size limits
  const PAGE = 200;
  let allQuestions = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('questions')
      .select('id, question_text, topic, diagram')
      .not('diagram', 'is', null)
      .eq('validated', true)
      .range(from, from + PAGE - 1);

    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!data || data.length === 0) break;
    allQuestions = allQuestions.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const total = Math.min(allQuestions.length, LIMIT);
  console.log(`Found ${allQuestions.length} questions with diagrams. Processing ${total}...\n`);

  let updated = 0, skipped = 0, failed = 0;

  for (let i = 0; i < total; i++) {
    const q = allQuestions[i];
    const prefix = `[${i + 1}/${total}]`;

    let newSvg;
    try {
      newSvg = attachDiagram(q);
    } catch (err) {
      console.error(`${prefix} ERROR generating diagram for ${q.id}: ${err.message}`);
      failed++;
      continue;
    }

    if (!newSvg) {
      console.log(`${prefix} SKIP  ${q.id.slice(0, 8)} — no diagram type matched`);
      skipped++;
      continue;
    }

    if (newSvg === q.diagram) {
      console.log(`${prefix} SAME  ${q.id.slice(0, 8)} — diagram unchanged`);
      skipped++;
      continue;
    }

    // Show what changed
    const hadLabels = /<text/.test(q.diagram);
    const hasLabels = /<text/.test(newSvg);
    const labelChange = !hadLabels && hasLabels ? ' (+labels added)' : hadLabels && hasLabels ? ' (labels updated)' : '';
    console.log(`${prefix} UPDATE ${q.id.slice(0, 8)} — ${q.question_text.slice(0, 60)}${labelChange}`);

    if (!DRY_RUN) {
      const { error } = await sb
        .from('questions')
        .update({ diagram: newSvg })
        .eq('id', q.id);

      if (error) {
        console.error(`        FAILED: ${error.message}`);
        failed++;
        continue;
      }
    }

    updated++;
  }

  console.log(`
────────────────────────────────
Done.
  Updated : ${updated}
  Skipped : ${skipped}
  Failed  : ${failed}
  Total   : ${total}
${DRY_RUN ? '\n[DRY RUN — no changes written to Supabase]' : ''}`.trim());
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
