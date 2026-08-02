/**
 * generate-passages.mjs  (E4 — new passage volume)
 *
 * Generates fresh reading passages (title + content) for comprehension, avoiding
 * the themes already in the passages table. Preview by default (no writes);
 * --apply inserts them into the passages table. Questions for the new passages
 * are then generated separately by generate-passage-questions.mjs.
 *
 * Usage:
 *   node scripts/generate-passages.mjs            # preview 5 P6 + 5 P7, no writes
 *   node scripts/generate-passages.mjs --apply    # insert into passages table
 *   node scripts/generate-passages.mjs --per 3    # override count per year group
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dir = dirname(fileURLToPath(import.meta.url));
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}
const ANTHROPIC_KEY = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL  = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY   = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const MODEL         = 'claude-sonnet-4-6';
if (!ANTHROPIC_KEY || !SERVICE_KEY) { console.error('Missing keys'); process.exit(1); }

const APPLY = process.argv.includes('--apply');
const perArg = process.argv.indexOf('--per');
const PER = perArg > -1 ? parseInt(process.argv[perArg + 1], 10) : 5;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const SYSTEM = 'You are a precise JSON API. Output ONLY the requested minified JSON object — no preamble, no code fences.';

// Deterministic style+domain rotation so the run is genuinely varied.
const ASSIGNMENTS = {
  P6: [
    { style: 'informational non-fiction', domain: 'an unusual wild animal (NOT beaver, bee, turtle, walrus, peregrine, kakapo)' },
    { style: 'narrative story',           domain: 'a child achieving something in a sport or outdoor challenge' },
    { style: 'informational non-fiction', domain: 'a dramatic natural weather event or phenomenon (e.g. volcano, tornado, thunderstorm)' },
    { style: 'narrative story',           domain: 'a journey or small adventure with a surprise' },
    { style: 'informational non-fiction', domain: 'space and astronomy (a planet, comet, or space mission)' },
  ],
  P7: [
    { style: 'informational non-fiction', domain: 'how an everyday invention or piece of technology works' },
    { style: 'narrative story',           domain: 'a moment from history seen through one person’s eyes' },
    { style: 'informational non-fiction', domain: 'an environmental or conservation topic (NOT a seed vault)' },
    { style: 'narrative story',           domain: 'a mystery or an unexpected discovery' },
    { style: 'informational non-fiction', domain: 'a remarkable place, landmark, or ecosystem on Earth' },
  ],
};

function buildPrompt(yearGroup, style, domain, avoid) {
  const age = yearGroup === 'P6' ? 'Primary 6 (age 10)' : 'Primary 7 (age 11, sitting the transfer test)';
  return `Write ONE original reading comprehension passage for the Northern Ireland SEAG Transfer Test, ${yearGroup} (${age}).

STYLE: ${style}
SUBJECT: ${domain}

Requirements:
- 180-220 words, UK English, wholesome and age-appropriate for a 10-11 year old.
- Rich enough to support 7 multiple-choice AND 6 short-written comprehension questions (clear facts or events, some inference, some vocabulary in context).
- The TITLE must accurately describe the passage content.

Hard bans (do NOT do any of these):
- Do NOT write about a child learning a craft or skill from an elderly relative or grandparent.
- Do NOT use a veteran craftsperson setup (clockmaker, glassblower, cartographer, falconer, lighthouse keeper, blacksmith, baker, etc.).
- Do NOT reuse these existing titles/themes: ${avoid.join('; ')}.

Return ONLY minified JSON: {"title":"...","content":"...","theme":"2-4 word theme label"}`;
}

function extractJson(raw) {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON in: ' + raw.slice(0, 80));
  return JSON.parse(m[0]);
}

async function generateOne(yearGroup, style, domain, avoid) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, temperature: 1, system: SYSTEM, messages: [{ role: 'user', content: buildPrompt(yearGroup, style, domain, avoid) }] }),
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (await resp.text()).slice(0, 200));
  const parsed = extractJson((await resp.json()).content?.[0]?.text || '');
  const words = String(parsed.content || '').trim().split(/\s+/).length;
  if (!parsed.title || !parsed.content) throw new Error('missing fields');
  if (words < 120 || words > 320) throw new Error(`length ${words} words out of range`);
  return { ...parsed, words };
}

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'to', 'in', 'last', 'night', 'day', 'story', 'tale']);
function sigWords(s) {
  return new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)));
}
// Two labels clash if they share 2+ significant words (catches "Clockmaker's
// Apprentice" twice, "Northern Lights ...", "Lighthouse Keeper's Last Winter").
function clashes(label, priorLabels) {
  const a = sigWords(label);
  for (const prior of priorLabels) {
    const b = sigWords(prior);
    let shared = 0;
    for (const w of a) if (b.has(w)) shared++;
    if (shared >= 2) return prior;
  }
  return null;
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (inserting passages)' : 'PREVIEW (no writes)'}   ${PER} per year group\n`);
  const { data: existing } = await sb.from('passages').select('title');
  const avoidTitles = (existing || []).map(p => p.title);

  const generated = [];
  const runLabels = [];   // titles+themes generated this run — spans BOTH year groups
  for (const yg of ['P6', 'P7']) {
    const assigns = ASSIGNMENTS[yg].slice(0, PER);
    for (let i = 0; i < assigns.length; i++) {
      const { style, domain } = assigns[i];
      let p = null, tries = 0;
      while (tries < 4) {
        tries++;
        let cand;
        try { cand = await generateOne(yg, style, domain, [...avoidTitles, ...runLabels]); }
        catch (e) { if (tries >= 4) console.log(`  [${yg} ${i + 1}] FAIL — ${e.message}`); continue; }
        const label = `${cand.title} ${cand.theme || ''}`;
        const clash = clashes(label, [...avoidTitles, ...runLabels]);
        if (clash) { console.log(`  [${yg} ${i + 1}] retry — "${cand.title}" clashes with "${clash}"`); continue; }
        p = cand; break;
      }
      if (!p) continue;
      runLabels.push(`${p.title} ${p.theme || ''}`);
      generated.push({ year_group: yg, style, ...p });
      console.log(`\n──────── ${yg}  ·  ${style}  ·  (${p.words} words)  ────────`);
      console.log(`TITLE: ${p.title}`);
      console.log(p.content);
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n\nGenerated ${generated.length} passages (${generated.filter(g => g.year_group === 'P6').length} P6, ${generated.filter(g => g.year_group === 'P7').length} P7).`);

  if (APPLY) {
    let inserted = 0;
    for (const g of generated) {
      const { error } = await sb.from('passages').insert({
        title: g.title, content: g.content, year_group: g.year_group,
        difficulty: g.year_group === 'P6' ? 3 : 4, source: 'ai_generated_v2',
      });
      if (error) { console.log(`  insert failed (${g.title}): ${error.message}`); continue; }
      inserted++;
    }
    console.log(`Inserted ${inserted} passages. Next: node generate-passage-questions.mjs to add 7 MC + 6 written each.`);
  } else {
    console.log('(preview — re-run with --apply to insert these passages)');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
