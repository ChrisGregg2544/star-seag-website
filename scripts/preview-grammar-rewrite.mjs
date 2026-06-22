import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SUPA_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fetchRows(offset, size) {
  const r = await fetch(
    `${SUPA_URL}/rest/v1/questions?select=id,question_text,options,correct_answer,explanation,year_group&subject=eq.english&topic=eq.grammar&validated=eq.true`,
    { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Range: `${offset}-${offset + size - 1}` } }
  );
  return r.json();
}

async function fetchAll() {
  let all = [];
  for (let offset = 0; ; offset += 500) {
    const rows = await fetchRows(offset, 500);
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    if (rows.length < 500) break;
  }
  return all;
}

const GAP = /_+|\[[ _]*\]|\(\s*\)|\.\.\./;

function buildPrompt(q) {
  return `You are rewriting a grammar question for the Northern Ireland SEAG Transfer Test (${q.year_group}, ages 10-11).

This question was generated in the WRONG FORMAT — it looks like a punctuation/error-spotting question where a complete sentence is split into segments A/B/C/D with an N="No mistake" option. Convert it to a proper grammar FILL-IN-THE-BLANK format.

RULES:
- Write a sentence containing ___ exactly once where the tested word/phrase goes
- Provide exactly 5 options: A, B, C, D, E — each a single word or short phrase (2-4 words max)
- One option is clearly correct; the other four are plausible distractors testing the same grammar concept
- No N option, no "No mistake"
- Language appropriate for age 10-11
- Preserve the grammar concept from the explanation

ORIGINAL QUESTION:
Question text: ${q.question_text}
Options: ${JSON.stringify(q.options)}
Correct answer: ${q.correct_answer}
Explanation: ${q.explanation || 'No explanation provided'}

Return ONLY valid JSON, no markdown:
{"question_text":"sentence with ___ in it","options":{"A":"word1","B":"word2","C":"word3","D":"word4","E":"word5"},"correct_answer":"A","explanation":"one sentence explanation"}`;
}

const rows = await fetchAll();
const wrong = rows.filter(r => !GAP.test(r.question_text) && r.options && 'N' in r.options);

console.log(`Total wrong-format: ${wrong.length}`);

// Pick 5 diverse samples
const longOpt  = wrong.find(r => Object.values(r.options).some(v => v.length > 30));
const slashQ   = wrong.find(r => r.question_text.includes(' / '));
const shortSegs = wrong.filter(r => !r.question_text.includes(' / ') && Object.values(r.options).every(v => v.length <= 30));
const ansN     = wrong.find(r => r.correct_answer === 'N');
const samples  = [longOpt, slashQ, shortSegs[0], shortSegs[5], ansN].filter(Boolean);

for (let i = 0; i < samples.length; i++) {
  const q = samples[i];
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`SAMPLE ${i + 1}`);
  console.log(`BEFORE:`);
  console.log(`  Q: ${q.question_text.substring(0, 120)}`);
  console.log(`  Opts: ${JSON.stringify(q.options)}`);
  console.log(`  Ans: ${q.correct_answer}`);
  console.log(`  Expl: ${(q.explanation || '').substring(0, 100)}`);

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: buildPrompt(q) }],
  });

  try {
    const result = JSON.parse(msg.content[0].text.trim());
    console.log(`AFTER:`);
    console.log(`  Q: ${result.question_text}`);
    console.log(`  Opts: ${JSON.stringify(result.options)}`);
    console.log(`  Ans: ${result.correct_answer}`);
    console.log(`  Expl: ${result.explanation}`);
  } catch (e) {
    console.log(`  PARSE ERROR: ${msg.content[0].text.substring(0, 300)}`);
  }
}
