/**
 * regenerate-missing-diagrams.js
 * Backfills / overwrites diagram SVGs by parsing question_text.
 *
 * Pass 1 — fill missing diagrams (diagram IS NULL) for visual topics
 * Pass 2 — overwrite ALL statistics diagrams (null and non-null) with
 *           data extracted directly from question_text
 *
 * Usage:
 *   node scripts/regenerate-missing-diagrams.js
 *   DRY_RUN=1 node scripts/regenerate-missing-diagrams.js   ← preview only
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
const UPDATE_DELAY = 30;

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

// Pass 2: ALL statistics questions (null or non-null diagram)
async function fetchStatisticsAll(offset) {
  const url = `${SUPABASE_URL}/rest/v1/questions`
    + `?topic=eq.statistics`
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

// ── Pictogram scale extraction ─────────────────────────────────────────────────
// Returns the keyValue (how many units each symbol represents).
function extractPictogramScale(text) {
  const t = text.toLowerCase();
  // "each symbol represents 5" / "each picture = 5" / "each icon = 5"
  const m1 = t.match(/each\s+(?:symbol|picture|image|icon|drawing|shape|smiley|star|circle|flower|apple|book|car|tree)\s+(?:represents?|=|equals?|stands\s+for)\s+(\d+)/);
  if (m1) return Number(m1[1]);
  // "● = 5" / "• = 5"
  const m2 = t.match(/[●•◆★☺☆○]\s*=\s*(\d+)/);
  if (m2) return Number(m2[1]);
  // "key: 1 symbol = 5" or "key = 5"
  const m3 = t.match(/key\s*[:=]?\s*(?:\d+\s+)?(?:symbol|picture)s?\s*=\s*(\d+)/);
  if (m3) return Number(m3[1]);
  // "represents 5 children" / "represents 10 votes"
  const m4 = t.match(/represents?\s+(\d+)\s+\w/);
  if (m4) return Number(m4[1]);
  return 1;
}

// ── Pictogram-aware data extraction ───────────────────────────────────────────
// Returns { labels, values, keyValue } or null.
// When "shows N symbols" pattern matches, N is symbol count → multiply by keyValue
// so the pictogram() function (which divides by keyValue) renders N symbols.
function extractPictogramData(text) {
  const keyValue = extractPictogramScale(text);

  // "Name shows N [symbols]" — N is symbol count, multiply to get actual count
  const showsRe = /\b([A-Z][a-z]+(?:day)?)\s+shows?\s+(\d+(?:\.\d+)?)/g;
  const showsPairs = [...text.matchAll(showsRe)];
  if (showsPairs.length >= 2) {
    return {
      labels: showsPairs.map(m => m[1].slice(0, 6)),
      values: showsPairs.map(m => Number(m[2]) * keyValue),
      keyValue,
    };
  }

  // Fall back to standard extraction (returns actual counts)
  const chartData = extractChartData(text);
  if (!chartData) return null;
  return { ...chartData, keyValue };
}

// ── Chart data extraction from question_text ───────────────────────────────────
// Returns { labels: string[], values: number[] } or null.
// Priority: named patterns first, comma-list fallback last.
// Every pattern returns exact count matching the question — no defaults.
function extractChartData(text) {
  // Strip the question tail so stray numbers don't pollute
  const dt = text
    .replace(/\?\s*$/, '')
    .replace(/\s+(What|How|Which|Find|Calculate)\s+.+/i, '');

  // ── Pattern 1: "Label: value" colon-separated pairs ──────────────────────────
  // "Week 1: £2", "Day 2: 8 mm", "Monday: 32 messages", "Case A: 16 pencils"
  // Filter: exact stopword matches only ("the" alone, not "The library")
  {
    const re = /\b([A-Za-z][A-Za-z0-9 ]{1,14}?)\s*:\s*£?(\d+(?:\.\d+)?)/g;
    const pairs = [...dt.matchAll(re)].filter(m => {
      const lbl = m[1].trim().toLowerCase();
      return lbl.length >= 2
        && !['each', 'what', 'how', 'which', 'the', 'a', 'an', 'and'].includes(lbl)
        && !lbl.startsWith('each ');
    });
    if (pairs.length >= 2) {
      return {
        labels: pairs.map(m => m[1].trim().slice(0, 8)),
        values: pairs.map(m => Number(m[2])),
      };
    }
  }

  // ── Pattern 2: "Name shows N" — pictogram-style ──────────────────────────────
  // "Saturday shows 8 ice cream symbols"
  {
    const re = /\b([A-Z][a-z]+(?:day)?)\s+shows?\s+(\d+(?:\.\d+)?)/g;
    const pairs = [...dt.matchAll(re)];
    if (pairs.length >= 2) {
      return {
        labels: pairs.map(m => m[1].slice(0, 6)),
        values: pairs.map(m => Number(m[2])),
      };
    }
  }

  // ── Pattern 3: Day names with values ─────────────────────────────────────────
  // "Monday 15", "Tuesday: 32", "Mon (45)"
  {
    const re = /\b(Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\w*\s*[:(]?\s*£?(\d+(?:\.\d+)?)/gi;
    const pairs = [...dt.matchAll(re)];
    if (pairs.length >= 2) {
      return {
        labels: pairs.map(m => m[1].slice(0, 3)),
        values: pairs.map(m => Number(m[2])),
      };
    }
  }

  // ── Pattern 4: Month names with values ───────────────────────────────────────
  {
    const re = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\w*\s*[:(]?\s*£?(\d+(?:\.\d+)?)/gi;
    const pairs = [...dt.matchAll(re)];
    if (pairs.length >= 2) {
      return {
        labels: pairs.map(m => m[1].slice(0, 3)),
        values: pairs.map(m => Number(m[2])),
      };
    }
  }

  // ── Pattern 5: "at HH:MM it was / there were N" ──────────────────────────────
  // "At 9:00 it was 18°C", "at 11:00 there were 25 customers"
  {
    const re = /\bat\s+(\d{1,2}:\d{2})\s+(?:it\s+was|there\s+were?)\s*£?(\d+(?:\.\d+)?)/gi;
    const pairs = [...dt.matchAll(re)];
    if (pairs.length >= 2) {
      return {
        labels: pairs.map(m => m[1]),
        values: pairs.map(m => Number(m[2])),
      };
    }
  }

  // ── Pattern 5b: "at week N it was N" ─────────────────────────────────────────
  // "At week 1 it was 10 cm, at week 2 it was 16 cm"
  {
    const re = /\bat\s+week\s+(\d+)\s+it\s+was\s*£?(\d+(?:\.\d+)?)/gi;
    const pairs = [...dt.matchAll(re)];
    if (pairs.length >= 2) {
      return {
        labels: pairs.map(m => 'Wk' + m[1]),
        values: pairs.map(m => Number(m[2])),
      };
    }
  }

  // ── Pattern 6: "Name verb N" — name + action verb + value ────────────────────
  // "Sarah read 8", "Classroom 2 has 36", "Pupil A collected 45", "Emma sent 32"
  {
    const re = /\b([A-Z][a-zA-Z]{0,10}(?:\s+[A-Z0-9])?)\s+(?:read|has|have|scored|collected|sold|got|sent|made|jumped|earned|saved|spent)\s+£?(\d+(?:\.\d+)?)/g;
    const pairs = [...dt.matchAll(re)];
    if (pairs.length >= 2) {
      return {
        labels: pairs.map(m => m[1].trim().slice(0, 8)),
        values: pairs.map(m => Number(m[2])),
      };
    }
  }

  // ── Pattern 7: "Name (N)" parenthetical values ───────────────────────────────
  // "Red (8 children)", "Monday (45)"
  {
    const re = /\b([A-Z][a-zA-Z]{1,10})\s+\((\d+(?:\.\d+)?)/g;
    const pairs = [...dt.matchAll(re)];
    if (pairs.length >= 2) {
      return {
        labels: pairs.map(m => m[1].slice(0, 6)),
        values: pairs.map(m => Number(m[2])),
      };
    }
  }

  // ── Pattern 8: Comma-separated number list (fallback) ────────────────────────
  // "...children: 24, 36, 20, and 32 marbles"
  // "The values are 15, 20, 25, 18, and 22"
  // "Books have 150, 200, 180, 220, and 170 pages"
  // Strategy: remove noise tokens, then find the longest proximity-run of digits.
  {
    const cleaned = dt
      // Remove clock times (avoid "10", "00" artifacts from "10:00")
      .replace(/\d{1,2}:\d{2}\s*(?:am|pm)?/gi, '')
      // Remove "at week N" so week-index digits don't bleed in
      .replace(/\bat\s+week\s+\d+\s+it\s+was/gi, 'it was')
      // Remove digit+count-noun ("5 children", "6 matches") — noise
      .replace(/\b\d+\s+(?:children|pupils?|cars?|matches?|games?|bars?|classrooms?|groups?|people|students?)\b/gi, '');

    // Find positions and values of all standalone digits
    const numMatches = [...cleaned.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map(m => ({
      val: Number(m[1]),
      idx: m.index,
    }));

    // Find the longest run where consecutive numbers are ≤25 chars apart
    let bestRun = [];
    let cur = [];
    for (const nm of numMatches) {
      if (cur.length === 0) {
        cur = [nm];
      } else {
        const prev = cur[cur.length - 1];
        const gap  = nm.idx - prev.idx - String(prev.val).length;
        if (gap <= 25) {
          cur.push(nm);
        } else {
          if (cur.length > bestRun.length) bestRun = cur;
          cur = [nm];
        }
      }
    }
    if (cur.length > bestRun.length) bestRun = cur;

    const vals = bestRun.map(m => m.val).filter(n => n >= 0 && n < 10000);
    if (vals.length >= 2 && vals.length <= 8) {
      return {
        labels: vals.map((_, i) => String.fromCharCode(65 + i)),
        values: vals,
      };
    }
  }

  return null;
}

// ── Geometry helpers ───────────────────────────────────────────────────────────
function nums(text) {
  return (text.match(/\d+(?:\.\d+)?/g) || []).map(Number);
}

// ── Diagram inference from question_text ───────────────────────────────────────
function inferDiagram(topic, questionText) {
  if (!questionText) return null;
  const t = questionText.toLowerCase();

  // ── Geometry ────────────────────────────────────────────────────────────────
  if (topic === 'geometry') {
    if (t.includes('cuboid') || t.includes('volume')) {
      const n = nums(t);
      if (n.length >= 3) return generateDiagram('cuboid', { length: n[0], width: n[1], height: n[2] });
    }
    if (t.includes('triangle') || t.includes('angle')) {
      const angles = (t.match(/(\d+)°/g) || []).map(a => parseInt(a));
      if (angles.length >= 2) return generateDiagram('triangle', { angles });
      if (t.includes('triangle')) return generateDiagram('triangle', { angles: [60, 60] });
    }
    if (t.includes('rectangle')) {
      const n = nums(t);
      if (n.length >= 2) return generateDiagram('shape', { subtype: 'rectangle', length: n[0], width: n[1] });
    }
    if (t.includes('square')) {
      const n = nums(t);
      if (n.length >= 1) return generateDiagram('shape', { subtype: 'square', side: n[0] });
    }
    if (t.includes('l-shape') || t.includes('composite')) {
      const n = nums(t);
      if (n.length >= 2) return generateDiagram('shape', { subtype: 'rectangle', length: n[0], width: n[1] });
    }
    if (t.includes('circle') || t.includes('radius') || t.includes('diameter')) {
      return generateDiagram('shape', { subtype: 'hexagon' });
    }
    for (const s of ['pentagon', 'hexagon', 'octagon', 'parallelogram', 'rhombus', 'trapezium']) {
      if (t.includes(s)) return generateDiagram('shape', { subtype: s });
    }
  }

  // ── Measurement ─────────────────────────────────────────────────────────────
  if (topic === 'measurement') {
    if (t.includes('ruler') || t.includes('length') || t.includes('centimetre') || t.includes('millimetre')) {
      const n = nums(t);
      return generateDiagram('measurement-scale', { type: 'ruler', highlight: n.length ? Math.min(n[0], 30) : 15 });
    }
    if (t.includes('kg') || t.includes('gram') || t.includes('weigh') || t.includes('mass') || t.includes('scale')) {
      const n = nums(t);
      return generateDiagram('measurement-scale', { type: 'weighing-dial', highlight: n.length ? Math.min(n[0], 100) : 50 });
    }
    if (t.includes('litre') || t.includes('ml') || t.includes('jug') || t.includes('capacity') || t.includes('liquid')) {
      const n = nums(t);
      return generateDiagram('measurement-scale', { type: 'measuring-jug', highlight: n.length ? Math.min(n[0], 1000) : 500 });
    }
  }

  // ── Statistics ───────────────────────────────────────────────────────────────
  if (topic === 'statistics') {
    // Pie / percent
    if (t.includes('pie') || (t.includes('%') && !t.includes('bar chart') && !t.includes('line graph'))) {
      const pcts = (t.match(/(\d+)\s*%/g) || []).map(p => parseInt(p));
      if (pcts.length >= 1 && pcts[0] > 0 && pcts[0] < 100) {
        return generateDiagram('pie-chart', {
          data: [
            { label: `${pcts[0]}%`, value: pcts[0] },
            { label: 'Remaining',   value: 100 - pcts[0] },
          ],
        });
      }
      return null; // pie without clear % — skip
    }

    // Pictogram: extract scale (keyValue) and pass it so the legend is correct
    if (t.includes('pictogram')) {
      const picData = extractPictogramData(questionText);
      if (!picData || picData.values.every(v => v === 0)) return null;
      return generateDiagram('pictogram', {
        labels:   picData.labels,
        values:   picData.values,
        keyValue: picData.keyValue,
      });
    }

    // Extract real data from question_text — count MUST match question
    const chartData = extractChartData(questionText);
    // Skip if no data extracted, or if every value is 0 (bad extraction)
    if (!chartData || chartData.values.every(v => v === 0)) return null;

    const { labels, values } = chartData;

    if (t.includes('bar chart') || t.includes('bar graph') || t.includes('tally') || t.includes('frequency')) {
      return generateDiagram('bar-chart', { labels, values });
    }
    if (t.includes('line graph') || t.includes('line chart')) {
      return generateDiagram('line-graph', { labels, values });
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
      const chartData = row.topic === 'statistics' ? extractChartData(row.question_text) : null;
      const dataInfo  = chartData ? `${chartData.values.length} pts [${chartData.values.join(',')}]` : 'no data';
      console.log(`  DRY  ${row.topic} ${row.year_group} | ${dataInfo} | ${row.question_text.slice(0, 60)}`);
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
  console.log('regenerate-missing-diagrams');
  console.log(`  topics   : ${VISUAL_TOPICS.join(', ')}`);
  console.log(`  DRY_RUN  : ${DRY_RUN}`);
  console.log('');

  const counters = { fetched: 0, patched: 0, skipped: 0, errors: 0 };

  // Pass 1: Fill missing diagrams for all visual topics
  console.log('── Pass 1: fill missing diagrams (diagram IS NULL) ──');
  let offset = 0;
  while (true) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;
    counters.fetched += rows.length;
    console.log(`  offset=${offset}: ${rows.length} rows`);
    await processRows(rows, counters);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Pass 2: Overwrite ALL statistics diagrams (null and existing) with data from question_text
  console.log('\n── Pass 2: overwrite ALL statistics diagrams ────────');
  offset = 0;
  while (true) {
    const rows = await fetchStatisticsAll(offset);
    if (!rows.length) break;
    counters.fetched += rows.length;
    console.log(`  offset=${offset}: ${rows.length} rows`);
    await processRows(rows, counters);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log('');
  console.log('── Summary ──────────────────────────────────────────');
  console.log(`  Fetched : ${counters.fetched}`);
  console.log(`  Patched : ${counters.patched}${DRY_RUN ? ' (dry run — no writes)' : ''}`);
  console.log(`  Skipped : ${counters.skipped} (no diagram pattern or data)`);
  console.log(`  Errors  : ${counters.errors}`);

  if (DRY_RUN && counters.patched > 0) {
    console.log('');
    console.log('Run without DRY_RUN=1 to apply changes.');
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
