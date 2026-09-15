/**
 * geometry-concept-inventory.js
 * Cataloguing pass (NOT a scope audit): sample N active geometry questions that
 * the scope audit did NOT flag, and inventory the concepts each requires.
 * No scope judgement — pure "what does a pupil need to know to answer this?".
 * Output: distinct concepts by frequency. Report-only, no DB writes.
 *
 *   SAMPLE=200 node scripts/geometry-concept-inventory.js
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('='); if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}
const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY  = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = envVars.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';
const SAMPLE = process.env.SAMPLE ? parseInt(process.env.SAMPLE) : 200;
const CONCURRENCY = 5, DELAY_MS = 200;
const sbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

// Exclude every question the scope audit flagged (deactivated OR kept), so this is a
// clean look at the UN-flagged active geometry bank.
const auditFlagIds = new Set(
  JSON.parse(readFileSync(resolve(__dir, 'scope-audit-flags.json'), 'utf8')).flags
    .filter(f => f.topic === 'geometry').map(f => f.id)
);

async function fetchActiveGeometry() {
  let rows = [], offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/questions?validated=eq.true&topic=eq.geometry`
      + `&select=id,year_group,question_text,options,correct_answer&limit=200&offset=${offset}`;
    const res = await fetch(url, { headers: sbHeaders });
    const page = await res.json();
    rows.push(...page);
    if (page.length < 200) break; offset += 200;
  }
  return rows.filter(r => !auditFlagIds.has(r.id));
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildPrompt(q) {
  const opts = q.options ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join('\n') : '(no options)';
  return `You are cataloguing the mathematical content of a Key Stage 2 geometry question. List EVERY distinct concept, technique, or piece of knowledge a pupil needs to answer it. This is an inventory only — do NOT judge whether anything is in scope, too easy, or too hard.

Use short canonical lowercase concept labels of 2-5 words (e.g. "area of rectangle", "angles in a triangle sum to 180", "properties of isosceles triangle", "reflect shape in mirror line", "name 3d shape from faces"). Prefer reusing the same label for the same idea. 1 to 4 labels is typical.

QUESTION:
${q.question_text}
Options:
${opts}
Correct answer: ${q.correct_answer}

Output ONLY a JSON array of concept-label strings, nothing else. Example: ["area of rectangle","perimeter of rectangle"]`;
}

async function askClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw = (data.content?.[0]?.text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) throw new Error(`No JSON array in: ${raw.slice(0, 80)}`);
  const arr = JSON.parse(m[0]);
  if (!Array.isArray(arr)) throw new Error('not an array');
  return arr.map(s => String(s).toLowerCase().replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const norm = () => {};

async function main() {
  console.log(`geometry-concept-inventory  model=${MODEL}  SAMPLE=${SAMPLE}`);
  const pool = await fetchActiveGeometry();
  console.log(`active un-flagged geometry available: ${pool.length}`);
  const sample = shuffle(pool).slice(0, SAMPLE);
  console.log(`inventorying ${sample.length}...\n`);

  const freq = {}; let done = 0, err = 0;
  const start = Date.now();
  for (let i = 0; i < sample.length; i += CONCURRENCY) {
    const chunk = sample.slice(i, i + CONCURRENCY);
    await Promise.all(chunk.map(async q => {
      try { const cs = await askClaude(buildPrompt(q)); for (const c of cs) freq[c] = (freq[c] || 0) + 1; }
      catch (e) { err++; if (err % 5 === 1) console.error('  ERR', q.id, e.message.slice(0, 60)); }
      done++;
    }));
    if (done % 50 < CONCURRENCY) console.log(`  ${done}/${sample.length} (${(done/((Date.now()-start)/1000)).toFixed(2)}/s)`);
    if (i + CONCURRENCY < sample.length) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  const rows = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  console.log(`\nDone. ${sample.length} questions, ${err} errors, ${rows.length} distinct concepts.\n`);
  console.log('=== DISTINCT GEOMETRY CONCEPTS BY FREQUENCY ===');
  for (const [c, n] of rows) console.log(String(n).padStart(4) + '  ' + c);

  writeFileSync(resolve(__dir, 'geometry-concept-inventory.json'),
    JSON.stringify({ generated: new Date().toISOString(), model: MODEL, sampled: sample.length, errors: err, concepts: rows.map(([concept, count]) => ({ concept, count })) }, null, 2));
  console.log('\nWritten to scripts/geometry-concept-inventory.json');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
