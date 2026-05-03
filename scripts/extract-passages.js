/**
 * extract-passages.js
 * Extracts comprehension passages from a Catapult paper PDF and links
 * matching questions in reference_questions via passage_id.
 *
 * Prerequisites (run once in Supabase if columns are missing):
 *   ALTER TABLE passages ADD COLUMN IF NOT EXISTS title text;
 *   ALTER TABLE reference_questions ADD COLUMN IF NOT EXISTS passage_id uuid;
 *
 * Usage: node scripts/extract-passages.js "Warm Up 1 (2026).pdf" P6 1
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dir = dirname(fileURLToPath(import.meta.url));

const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const ANTHROPIC_API_KEY    = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL         = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const MODEL                = 'claude-sonnet-4-6';
const PAPERS_DIR           = resolve(__dir, '../catapult-papers');

const [, , paperFile, yearGroup, paperNumber] = process.argv;

if (!paperFile || !yearGroup) {
  console.error('Usage: node scripts/extract-passages.js "paper.pdf" P6 [paper_number]');
  process.exit(1);
}
if (!['P6', 'P7'].includes(yearGroup)) {
  console.error('year_group must be P6 or P7');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY)    { console.error('ANTHROPIC_API_KEY not set in .env');        process.exit(1); }
if (!SUPABASE_SERVICE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY not set in .env'); process.exit(1); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function supabaseHeaders(extra = {}) {
  return {
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
    ...extra,
  };
}

function extractFirstArray(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/im, '').replace(/```[\s\S]*$/, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through */ }
  const start = cleaned.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '[') depth++;
    else if (cleaned[i] === ']') {
      depth--;
      if (depth === 0) {
        try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { break; }
      }
    }
  }
  return null;
}

function normalize(text) {
  return (text || '')
    .trim()
    .replace(/[‘’‚‛′‵]/g, "'")  // curly single quotes → straight
    .replace(/[“”„‟″‶]/g, '"')  // curly double quotes → straight
    .replace(/–|—/g, '-')                            // en/em dash → hyphen
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function findMatch(questionText, candidates) {
  const n = normalize(questionText);
  for (const len of [60, 40, 30]) {
    const prefix = n.slice(0, len);
    const hit = candidates.find(r => normalize(r.question_text).startsWith(prefix));
    if (hit) return hit;
  }
  return null;
}

// ── Supabase ──────────────────────────────────────────────────────────────────

async function fetchComprehensionQuestions(yearGroup) {
  // Fetch ALL categories — comprehension questions are sometimes miscategorised
  // as grammar/vocabulary when extract-papers.js sees a language-focused question
  // that is actually about the passage.
  const url = `${SUPABASE_URL}/rest/v1/reference_questions`
    + `?year_group=eq.${yearGroup}`
    + `&select=id,question_text,category`
    + `&limit=2000`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error(`Supabase fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function findExistingPassage(title, yearGroup) {
  if (!title) return null;
  const url = `${SUPABASE_URL}/rest/v1/passages`
    + `?title=eq.${encodeURIComponent(title)}`
    + `&year_group=eq.${yearGroup}`
    + `&source=eq.catapult`
    + `&select=id`
    + `&limit=1`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.id || null;
}

async function insertPassage(row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/passages`, {
    method:  'POST',
    headers: supabaseHeaders({ Prefer: 'return=minimal' }),
    body:    JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`passages INSERT failed (${res.status}): ${await res.text()}`);
}

async function patchPassageId(questionId, passageId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reference_questions?id=eq.${questionId}`,
    {
      method:  'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body:    JSON.stringify({ passage_id: passageId }),
    },
  );
  if (!res.ok) throw new Error(`reference_questions PATCH failed (${res.status}): ${await res.text()}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pNum      = paperNumber || '1';
  const paperPath = resolve(PAPERS_DIR, paperFile);

  console.log(`Paper:      ${paperPath}`);
  console.log(`Year group: ${yearGroup}  Paper: ${pNum}\n`);

  const paperBase64 = readFileSync(paperPath).toString('base64');

  console.log(`Fetching comprehension questions for ${yearGroup} from Supabase...`);
  const candidates = await fetchComprehensionQuestions(yearGroup);
  console.log(`Found ${candidates.length} comprehension questions available for linking\n`);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const prompt = `Extract ALL comprehension passages from this paper.

Return JSON array:
[
  {
    "title": "passage title if visible, else null",
    "content": "full passage text with line breaks preserved as \\n",
    "question_numbers": [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
    "question_texts": [
      "full exact text of question 16 as printed in the paper",
      "full exact text of question 17 as printed in the paper",
      "...one entry per question number, in the same order as question_numbers..."
    ]
  }
]

CRITICAL:
- Preserve exact passage text including all line breaks (\\n)
- Number the lines if not already numbered
- question_texts must be the COMPLETE question text exactly as printed (no options/answers)
- question_numbers and question_texts must be parallel arrays (same length, same order)
- Include ALL multiple-choice AND written questions that refer to this passage
- Return ONLY the JSON array, no other text`;

  console.log('Calling Claude Sonnet to extract passages...');

  const response = await client.beta.messages.create({
    model:      MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: paperBase64 } },
        { type: 'text', text: prompt },
      ],
    }],
    betas: ['pdfs-2024-09-25'],
  });

  const raw      = response.content?.[0]?.text || '';
  const passages = extractFirstArray(raw);

  if (!passages) {
    console.error('Failed to parse passages JSON. Raw response (first 500 chars):');
    console.error(raw.slice(0, 500));
    process.exit(1);
  }

  console.log(`Extracted ${passages.length} passage(s)\n`);

  let totalPassages = 0, totalLinked = 0, totalMissed = 0;

  for (const p of passages) {
    const questionTexts   = Array.isArray(p.question_texts)   ? p.question_texts   : [];
    const questionNumbers = Array.isArray(p.question_numbers) ? p.question_numbers : [];

    console.log(`─── "${p.title || '(untitled)'}"  [${questionTexts.length} questions]`);

    // Skip insert if this passage already exists (safe to re-run)
    const existingId = await findExistingPassage(p.title, yearGroup);
    const passageId  = existingId || randomUUID();

    if (existingId) {
      console.log(`  (passage already exists — reusing ${existingId})`);
    } else {
      await insertPassage({
        id:         passageId,
        title:      p.title  || null,
        content:    p.content,
        year_group: yearGroup,
        source:     'catapult',
      });
      totalPassages++;
    }

    for (let i = 0; i < questionTexts.length; i++) {
      const qt  = questionTexts[i];
      const qn  = questionNumbers[i] ?? '?';
      const hit = findMatch(qt, candidates);

      if (hit) {
        await patchPassageId(hit.id, passageId);
        candidates.splice(candidates.indexOf(hit), 1); // consume — prevent double-match
        totalLinked++;
        console.log(`  Q${qn} ✓  ${qt.slice(0, 70)}`);
      } else {
        totalMissed++;
        console.log(`  Q${qn} ✗  NO MATCH: "${qt.slice(0, 70)}"`);
      }
    }

    console.log();
  }

  console.log('══════════════════════════════════════════════════');
  console.log(`Passages inserted:  ${totalPassages}`);
  console.log(`Questions linked:   ${totalLinked}`);
  if (totalMissed) {
    console.log(`Unmatched:          ${totalMissed}  ← re-check question_text in DB`);
  } else {
    console.log('All questions linked successfully.');
  }
  console.log('══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
