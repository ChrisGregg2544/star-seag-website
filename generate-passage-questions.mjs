/**
 * STAR — Comprehension Question Generator
 * Generates 7 MC + 6 written questions for each passage in the passages table.
 *
 * Run with:
 *   node generate-passage-questions.mjs
 *
 * Options:
 *   --dry-run   Print questions without inserting
 *   --from N    Start from passage index N (0-based)
 *   --limit N   Process at most N passages
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { lintQuestion } from './scripts/question-contract.mjs';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL      = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
if (!SUPABASE_KEY)      { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const DRY_RUN = process.argv.includes('--dry-run');
const fromArg  = process.argv.indexOf('--from');
const limitArg = process.argv.indexOf('--limit');
const FROM  = fromArg  !== -1 ? parseInt(process.argv[fromArg  + 1], 10) : 0;
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const sb        = createClient(SUPABASE_URL, SUPABASE_KEY);

const BATCH_SIZE = 3;
const DELAY_MS   = 3000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Fetch passages that have no linked v2 questions ───────────────────────────
async function fetchPassages() {
  const { data: passages, error } = await sb
    .from('passages')
    .select('id, year_group, content')
    .order('year_group')
    .order('id');

  if (error) throw new Error('Failed to fetch passages: ' + error.message);

  // Check which already have v2 questions
  const { data: existing } = await sb
    .from('questions')
    .select('passage_id')
    .eq('source', 'ai_generated_v2')
    .eq('validated', true)
    .not('passage_id', 'is', null);

  const coveredIds = new Set((existing || []).map(r => r.passage_id));
  return passages.filter(p => !coveredIds.has(p.id));
}

// ── Generate questions for one passage via Claude ─────────────────────────────
async function generateForPassage(passage) {
  const ageDesc = passage.year_group === 'P6'
    ? 'Primary 6 (age 10, first year of SEAG prep)'
    : 'Primary 7 (age 11, sitting the SEAG transfer test this year)';

  const prompt = `You are writing reading comprehension questions for the Northern Ireland SEAG Transfer Test (${passage.year_group}, ${ageDesc}).

Read this passage carefully:

---
${passage.content}
---

Generate EXACTLY:
- 7 multiple choice questions that mirror Q16–Q22 of the real SEAG paper
- 6 free response questions that mirror Q23–Q28 of the real SEAG paper

STRICT RULES:
- Every question MUST refer specifically to something in this passage — no generic questions
- MC questions: 5 options (A/B/C/D/E), exactly one correct, others plausible but clearly wrong on reading
- Written questions: require 1–3 sentence answers drawn from the passage
- Model answers for written questions should be clear and specific to the passage
- Difficulty appropriate for ${passage.year_group} (not too easy, not too hard)
- Do NOT number the questions — just provide the question_text
- Do NOT include "According to the passage..." as the start of every question — vary the phrasing

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "mc": [
    {
      "question_text": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
      "correct_answer": "A",
      "explanation": "Brief reason why this is correct"
    }
  ],
  "written": [
    {
      "question_text": "...",
      "model_answer": "Full model answer a marker would accept"
    }
  ]
}`;

  const response = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 4000,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const json = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(json);
}

// ── Build Supabase row objects from parsed response ───────────────────────────
function buildRows(passage, parsed) {
  const base = {
    subject:    'english',
    year_group: passage.year_group,
    passage:    passage.content,   // store the passage text on each row (contract requires it)
    passage_id: passage.id,
    source:     'ai_generated_v2',
    active:     true,
    validated:  true,
    difficulty: passage.year_group === 'P6' ? 3 : 4,
    times_used: 0,
  };

  const mcRows = (parsed.mc || []).slice(0, 7).map(q => ({
    ...base,
    topic:         'comprehension_mc',
    question_type: 'Multiple_Choice',
    question_text: q.question_text,
    options:       q.options,
    correct_answer:q.correct_answer,
    explanation:   q.explanation || null,
  }));

  const wrRows = (parsed.written || []).slice(0, 6).map(q => ({
    ...base,
    topic:         'comprehension_written',
    question_type: 'written',
    question_text: q.question_text,
    options:       null,
    correct_answer:null,
    explanation:   q.model_answer || null,
  }));

  return [...mcRows, ...wrRows];
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Fetching passages with no linked V2 questions…');
  const all = await fetchPassages();
  const passages = all.slice(FROM, FROM + LIMIT);

  console.log(`\nFound ${all.length} passages needing questions.`);
  console.log(`Processing ${passages.length} (from index ${FROM}).\n`);
  if (DRY_RUN) console.log('DRY RUN — nothing will be inserted.\n');

  let totalInserted = 0;
  let totalFailed   = 0;

  for (let i = 0; i < passages.length; i += BATCH_SIZE) {
    const batch = passages.slice(i, i + BATCH_SIZE);
    console.log(`\n── Batch ${Math.floor(i / BATCH_SIZE) + 1} (passages ${i + 1}–${Math.min(i + BATCH_SIZE, passages.length)} of ${passages.length}) ──`);

    for (const passage of batch) {
      const preview = passage.content.slice(0, 80).replace(/\n/g, ' ');
      console.log(`\n  [${passage.year_group}] ${preview}…`);
      console.log(`  ID: ${passage.id}`);

      try {
        const parsed = await generateForPassage(passage);
        const rows   = buildRows(passage, parsed);

        const mcCount = rows.filter(r => r.topic === 'comprehension_mc').length;
        const wrCount = rows.filter(r => r.topic === 'comprehension_written').length;
        console.log(`  Generated: ${mcCount} MC + ${wrCount} written`);

        if (mcCount < 7) console.warn(`  WARNING: only ${mcCount}/7 MC questions`);
        if (wrCount < 6) console.warn(`  WARNING: only ${wrCount}/6 written questions`);

        // Contract gate — refuse to insert any row that violates question-contract.mjs
        const cleanRows = [];
        for (const r of rows) {
          const violations = lintQuestion(r);
          if (violations.length > 0) {
            console.warn(`  ⚠️  Skipped ${r.topic}: ${violations.join(', ')}`);
            continue;
          }
          cleanRows.push(r);
        }

        if (!DRY_RUN) {
          if (cleanRows.length === 0) { console.warn('  No rows passed the contract — skipping passage'); continue; }
          const { error } = await sb.from('questions').insert(cleanRows);
          if (error) {
            console.error(`  INSERT failed: ${error.message}`);
            totalFailed++;
          } else {
            console.log(`  Inserted ${cleanRows.length} rows ✓`);
            totalInserted += cleanRows.length;
          }
        } else {
          console.log(`  [DRY RUN] Would insert ${rows.length} rows`);
          console.log('  Sample MC:', JSON.stringify(parsed.mc?.[0], null, 2));
        }
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
        totalFailed++;
      }

      await sleep(DELAY_MS);
    }

    if (i + BATCH_SIZE < passages.length) {
      console.log(`\nBatch complete. Pausing 5s before next batch…`);
      await sleep(5000);
    }
  }

  console.log('\n══════════════════════════════');
  console.log(`Done. Inserted: ${totalInserted} rows. Failed passages: ${totalFailed}.`);
  console.log('══════════════════════════════');
}

main().catch(err => { console.error(err); process.exit(1); });
