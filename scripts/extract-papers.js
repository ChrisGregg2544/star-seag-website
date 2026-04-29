import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Manual .env parsing — no dotenv dependency
const envPath = resolve(__dir, '../.env');
const envVars = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const ANTHROPIC_API_KEY   = envVars.ANTHROPIC_API_KEY;
const SUPABASE_URL        = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const HAIKU_MODEL         = 'claude-haiku-4-5-20251001';
const PAPERS_DIR          = resolve(__dir, '../catapult-papers');

// Usage: node scripts/extract-papers.js "paper.pdf" "answers.pdf" P6 [paper_number]
const [, , paperFile, answersFile, yearGroup, paperNumber] = process.argv;

if (!paperFile || !answersFile || !yearGroup) {
  console.error('Usage: node scripts/extract-papers.js "paper.pdf" "answers.pdf" P6 [paper_number]');
  process.exit(1);
}
if (!['P6', 'P7'].includes(yearGroup)) {
  console.error('year_group must be P6 or P7');
  process.exit(1);
}

function salvagePartial(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;
  const lastClose = text.lastIndexOf('}');
  if (lastClose === -1) return null;
  const candidate = text.slice(start, lastClose + 1) + ']';
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function parseJsonArray(rawText) {
  try {
    return { items: JSON.parse(rawText), truncated: false };
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/);
    if (match) {
      try { return { items: JSON.parse(match[0]), truncated: false }; }
      catch { /* fall through */ }
    }
    const salvaged = salvagePartial(rawText);
    if (salvaged) return { items: salvaged, truncated: true };
    return null;
  }
}

async function main() {
  if (!ANTHROPIC_API_KEY)    { console.error('ANTHROPIC_API_KEY not set in .env');          process.exit(1); }
  if (!SUPABASE_URL)          { console.error('NEXT_PUBLIC_SUPABASE_URL not set in .env');    process.exit(1); }
  if (!SUPABASE_SERVICE_KEY)  { console.error('SUPABASE_SERVICE_ROLE_KEY not set in .env');   process.exit(1); }

  const pNum        = paperNumber || '1';
  const paperPath   = resolve(PAPERS_DIR, paperFile);
  const answersPath = resolve(PAPERS_DIR, answersFile);

  console.log(`Paper:   ${paperPath}`);
  console.log(`Answers: ${answersPath}`);

  const paperBase64   = readFileSync(paperPath).toString('base64');
  const answersBase64 = readFileSync(answersPath).toString('base64');

  const systemPrompt = `You are an expert at analysing SEAG transfer test papers for Northern Ireland P6 and P7 pupils (ages 10-11). You will be given a question paper PDF and an official answer sheet. Extract every question and return a JSON array.`;

  const instruction = `Year group: ${yearGroup}
Paper: ${pNum}

The first document is the question paper. The second document is the official answer sheet with correct answers and explanations.

Extract all 56 questions. For each question return:
- question_text: full question text from the PDF
- correct_answer: exact answer from the answer sheet (letter A/B/C/D/E/N for MC, or exact text for written answers)
- explanation: the explanation from the answer sheet for why this answer is correct (copy it accurately)
- category: one of: punctuation, grammar, spelling, vocabulary, comprehension_mc, comprehension_written, arithmetic, geometry, fractions_decimals, measurement, statistics, algebra_sequences
- difficulty: easy, medium, or hard
- needs_diagram: true for ANY geometry, measurement, or statistics question that involves shapes, graphs, charts, tables, pictograms, number lines, grids, clocks, or visual representations. Default to true for these categories unless purely calculation-based.
- diagram_description: DETAILED description for SVG generation. Include: exact shapes (triangle/rectangle/circle/cuboid), all dimensions with units (5cm, 12mm, 3.5m), labels, orientations, and any special features (right angle, parallel sides). Example: "Right-angled triangle with base 6cm, height 8cm, hypotenuse 10cm, right angle marked at bottom-left"

CRITICAL: Use the answer sheet as the source of truth for correct_answer and explanation. Do not guess answers.

For punctuation and spelling questions: correct_answer must be A, B, C, D, or N only. Never E.

Return ONLY a valid JSON array. No preamble, no markdown.`;

  console.log(`\nExtracting questions from ${yearGroup} paper ${pNum}...`);

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const response = await client.beta.messages.create({
    model:      HAIKU_MODEL,
    max_tokens: 16000,
    system:     systemPrompt,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: paperBase64 } },
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: answersBase64 } },
        { type: 'text', text: instruction },
      ],
    }],
    betas: ['pdfs-2024-09-25'],
  });

  const rawText = response.content?.[0]?.text || '';
  const parsed  = parseJsonArray(rawText);

  if (!parsed) {
    console.error('JSON parse failed. Raw response (first 500 chars):');
    console.error(rawText.slice(0, 500));
    process.exit(1);
  }

  if (parsed.truncated) {
    console.warn(`Warning: truncated response — salvaged ${parsed.items.length} questions`);
  }

  console.log(`Extracted ${parsed.items.length} questions`);

  if (parsed.items.length === 0) {
    console.error('No questions extracted. Aborting save.');
    process.exit(1);
  }

  const paperSource = `catapult_${yearGroup.toLowerCase()}_paper${pNum}`;

  const rows = parsed.items.map(q => ({
    question_text:       q.question_text,
    correct_answer:      q.correct_answer,
    category:            q.category,
    difficulty:          q.difficulty || 'medium',
    year_group:          yearGroup,
    paper_source:        paperSource,
    explanation:         q.explanation         || null,
    needs_diagram:       q.needs_diagram       || false,
    diagram_description: q.diagram_description || null,
  }));

  console.log(`Saving ${rows.length} questions to Supabase (${paperSource})...`);

  const saveResp = await fetch(`${SUPABASE_URL}/rest/v1/reference_questions`, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(rows),
  });

  if (!saveResp.ok) {
    const errText = await saveResp.text();
    console.error(`Supabase insert failed: ${saveResp.status} ${errText}`);
    process.exit(1);
  }

  console.log(`Done! Saved ${rows.length} reference questions from ${paperSource}`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
