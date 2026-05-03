/**
 * generate-diagrams.js
 * For each reference_questions row with needs_diagram=true and no diagram yet:
 * 1. Sends diagram_description to Claude Sonnet
 * 2. Parses response into { type, options } for diagram-generator.js
 * 3. Calls generateDiagram() to produce inline SVG
 * 4. Saves SVG back to reference_questions.diagram
 *
 * Prerequisite: run this SQL in Supabase first if diagram column is missing:
 *   ALTER TABLE reference_questions ADD COLUMN diagram text;
 *
 * Usage: node scripts/generate-diagrams.js
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { generateDiagram } from '../diagram-generator.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── .env ──────────────────────────────────────────────────────────────────────
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const ANTHROPIC_KEY = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL  = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY   = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const MODEL         = 'claude-sonnet-4-6';

if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY');        process.exit(1); }
if (!SERVICE_KEY)   { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// ── Helpers ────────────────────────────────────────────────────────────────────
function supabaseHeaders(extra = {}) {
  return {
    'apikey':        SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type':  'application/json',
    ...extra,
  };
}

function extractFirstJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/```[\s\S]*$/, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const start = cleaned.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === open)  depth++;
      if (cleaned[i] === close) { depth--; if (depth === 0) { try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { break; } } }
    }
  }
  return null;
}

// ── Supabase ───────────────────────────────────────────────────────────────────
async function fetchPending() {
  const url = `${SUPABASE_URL}/rest/v1/reference_questions`
    + `?select=id,diagram_description,category`
    + `&needs_diagram=eq.true`
    + `&diagram=is.null`
    + `&limit=1000`;

  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`Supabase fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function saveDiagram(id, svg) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reference_questions?id=eq.${id}`,
    {
      method:  'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body:    JSON.stringify({ diagram: svg }),
    },
  );
  if (!res.ok) throw new Error(`Supabase PATCH failed (${res.status}): ${await res.text()}`);
}

// ── Claude ─────────────────────────────────────────────────────────────────────
const SYSTEM = `You are a JSON generator. Return ONLY valid JSON, no other text.`;

const TYPE_GUIDE = `Available types and their key options (ONLY use these exact type names):

triangle  — { subtype: "scalene|equilateral|isosceles|right-angled", sideA, sideB, sideC, angleA, angleB, angleC, unknownAngle: bool }
shape     — { subtype: "rectangle|square|parallelogram|rhombus|trapezium|pentagon|hexagon|octagon", width, height, sideLabel }
angle     — { type: "single|straight-line|around-point", value: "65°", unknown: bool }
net       — { subtype: "cube", sideLabel }
fraction-grid — { numerator: 3, denominator: 4 }
bar-chart — { labels: ["Mon","Tue",...], values: [4,7,...], title, yLabel }
line-graph — { points: [{x,y},...], title, xLabel, yLabel, xMin, xMax, yMin, yMax }
pictogram — { labels: ["A","B",...], counts: [3,5,...], title, symbol: "★", scale: 2 }
number-line — { min: 0, max: 10, marked: [3, 7], unknown: 5, label }
measurement-scale — { subtype: "ruler|thermometer|weighing-dial", value, min, max, unit }
coordinate-grid — { points: [{x,y,label},...], xMin, xMax, yMin, yMax }
cuboid    — { width: "5cm", height: "3cm", depth: "2cm" }
pie-chart — { data: [{"label": "A", "value": 30}, {"label": "B", "value": 70}] }
function-machine — { rule: "× 3", input: "4", output: "12" }

Mapping rules for unsupported diagram types:
- tally chart, frequency table, carroll diagram, venn diagram → use bar-chart
- L-shape, composite shape, irregular shape → use shape with subtype "rectangle"
- magic square, number grid, number cards → use coordinate-grid
- decision tree, flow chart → use function-machine
- multiple diagrams needed → pick the MOST IMPORTANT single diagram only`;

async function parseDescription(description) {
  const prompt = `Parse this SEAG maths diagram description into structured options for diagram-generator.js.

Description: ${description}

${TYPE_GUIDE}

Choose the best matching type from the list above. Do NOT invent new type names.
Return ONLY a single JSON object (never an array):
{
  "type": "...",
  "options": { ... }
}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      MODEL,
      max_tokens: 800,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Anthropic API error');

  const raw    = data.content?.[0]?.text || '';
  const parsed = extractFirstJson(raw);
  if (!parsed || !parsed.type) throw new Error(`Bad parse response: ${raw.slice(0, 150)}`);
  return parsed;
}

// ── Main ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching reference questions needing diagrams...');
  const questions = await fetchPending();
  console.log(`Found ${questions.length} questions to process\n`);

  if (!questions.length) { console.log('Nothing to do.'); return; }

  let saved = 0, failed = 0;
  const failures = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    process.stdout.write(`[${i + 1}/${questions.length}] ${q.id} ... `);

    if (!q.diagram_description) {
      console.log('SKIP (no description)');
      failed++;
      continue;
    }

    try {
      // 1. Ask Claude to parse the description
      const { type, options } = await parseDescription(q.diagram_description);

      // 2. Generate SVG
      const svg = generateDiagram(type, options);
      if (!svg) throw new Error(`generateDiagram returned null for type "${type}"`);

      // 3. Save to Supabase
      await saveDiagram(q.id, svg);

      console.log(`OK  [${type}]`);
      saved++;
    } catch (err) {
      console.log(`FAIL — ${err.message}`);
      failed++;
      failures.push({ id: q.id, error: err.message });
    }

    // Avoid rate limits
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Done.  Saved: ${saved}  Failed: ${failed}`);
  if (failures.length) {
    console.log('\nFailed questions:');
    failures.forEach(f => console.log(`  ${f.id} — ${f.error}`));
  }
  console.log('═'.repeat(50));
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
