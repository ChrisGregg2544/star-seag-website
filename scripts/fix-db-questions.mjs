/**
 * fix-db-questions.mjs
 * 1. Deletes 21 self-answering questions and reseeds replacements
 * 2. Fixes 4 hardcoded pictogram diagrams (sets diagram = null)
 *
 * Usage: node scripts/fix-db-questions.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { lintQuestion } from './question-contract.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const KEY  = envVars.ANTHROPIC_API_KEY;
const SB   = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SK   = envVars.SUPABASE_SERVICE_ROLE_KEY;
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1dGNnb2dteGhhcWdheGt6bnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjE4MTQsImV4cCI6MjA4OTMzNzgxNH0.o0plRQzH8ezfttG_sEeWu3F4IUtKnyzcXtPEGJ9xRF0';

// ── IDs to delete ──────────────────────────────────────────────────────────────
const DELETE_IDS = [
  // fractions_decimals P7 — answer given in question text
  '615c5498-1c70-4b0a-af53-f71ab2e138d6',  // "201.04" in "which is smallest? 210.004, 201.04..."
  '08dd9b3e-9e85-4ec2-a52c-46579fbd0e0f',  // "7/15" in "What is 2/5 + 7/15 − 1/3?"
  // grammar P7 — "read" appears in question text
  'd03852ba-a32e-4f2c-888e-09de21ab3390',
  // statistics P6 — category name that is the answer is directly readable from the data
  'e2edb94c-fa48-42af-99b3-7720bcec7b1a',  // Tennis (lowest in chart, answer is "Tennis")
  'f67809b6-9670-43a1-baed-82c52b521851',  // Chloe
  '8d02c847-d1d6-46a6-ba98-b3d2563a537b',  // "4 ice creams"
  'c180dba1-f5c3-47d3-9956-896e4b195c6e',  // Sofia
  '55b1f97c-d0d3-4080-a41f-9712f680301d',  // "5 apples"
  '02fa450c-683a-4545-bf24-1fc50658959b',  // Friday
  'aea9788a-6a62-4e77-962e-bafe85e64f56',  // Football
  '76dcb66e-129d-4546-ac09-f6a7074ca37f',  // Tennis (dup)
  '8bbaf0a7-80bd-4d5e-9bc4-f477ef70cd63',  // "15°C" statistics P7
  '70418994-d8d5-417e-9f5b-94b8450e0b29',  // "Year 3" statistics P6 d3
  '8c0df70d-6c77-4863-ba97-ab77daafdf7f',  // "5 sweets" statistics P6 d4
  // comprehension_written — answer word given directly in question_text
  '81c5e85a-a03e-4127-8fab-8483ecf7a49c',  // "jagged and sharp" — answer: jagged
  '65852721-ceb8-423e-885e-92144dc96a6a',  // "flat" in "What part of speech is 'flat'..."
  'd811538a-5103-48fe-ae9e-6642959f8d58',  // "reproduce" in "Find a word that means 'reproduce'"
  'e2a804ae-9076-4e99-97a0-bf90d35f3482',  // "steer" in "Find a word that means 'steer or guide'"
  '9b038d5a-857b-4528-bbb8-4a9bbf8eecfb',  // "indifferent" in question
  '31d621b6-4639-4488-b490-08fba885c960',  // "endure" in question
  'ddf7c39a-a8c5-4eb8-905d-609faff0b66a',  // "remote" in question
];

// Hardcoded pictogram diagrams to null out (diagram contains Cats/Dogs/Birds but wrong data)
const PICTOGRAM_FIX_IDS_QUERY = "diagram.like.*Cats*";

// ── Helpers ────────────────────────────────────────────────────────────────────
async function sbGet(path) {
  const r = await fetch(SB + path, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
  return r.json();
}

async function sbDelete(ids) {
  const r = await fetch(SB + '/rest/v1/questions?id=in.(' + ids.join(',') + ')', {
    method: 'DELETE',
    headers: { apikey: SK, Authorization: 'Bearer ' + SK },
  });
  return r.status;
}

async function sbPatch(filter, updates) {
  const r = await fetch(SB + '/rest/v1/questions?' + filter, {
    method: 'PATCH',
    headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(updates),
  });
  return r.status;
}

async function sbInsert(rows) {
  // Contract gate — refuse to insert any question that violates question-contract.mjs
  const clean = [];
  for (const r of rows) {
    const violations = lintQuestion(r);
    if (violations.length > 0) {
      console.warn(`   ⚠️  Skipped ${r.topic} ${r.year_group}: ${violations.join(', ')}`);
      continue;
    }
    clean.push(r);
  }
  if (clean.length === 0) { console.warn('   ⚠️  No questions passed the contract — nothing inserted'); return; }

  const r = await fetch(SB + '/rest/v1/questions', {
    method: 'POST',
    headers: { apikey: SK, Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(clean),
  });
  if (!r.ok) throw new Error(await r.text());
}

async function callClaude(prompt, maxTokens = 2000) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await r.json();
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return Array.isArray(parsed) ? parsed : (parsed.questions || [parsed]);
}

function toRow(q, subject, topic, year, diff) {
  let opts = q.options || {};
  if (Array.isArray(opts)) {
    const keys = ['A','B','C','D','E'];
    const o = {};
    opts.forEach((v, i) => { if (keys[i]) o[keys[i]] = v; });
    opts = o;
  }
  const ans = (q.correct_answer || q.answer || '').trim().toUpperCase();
  const isWritten = !q.options || q.question_type === 'written';
  if (!isWritten && !opts[ans]) return null;
  return {
    subject, topic, year_group: year, difficulty: diff,
    question_type: isWritten ? 'written' : 'mc',
    question_text: (q.question_text || q.text || '').trim(),
    options: isWritten ? null : opts,
    correct_answer: isWritten ? (q.correct_answer || '').trim() : ans,
    explanation: (q.explanation || '').trim().slice(0, 250),
    passage: q.passage || null,
    source: 'ai_generated_v3',
    validated: false, diagram: null, times_used: 0,
  };
}

// ── Prompts ────────────────────────────────────────────────────────────────────

function statsPrompt(year, diff, n) {
  const level = year === 'P6' ? 'P6 (age 10)' : 'P7 (age 11)';
  const diffNote = { 1:'very easy', 2:'easy', 3:'moderate', 4:'challenging' }[diff];
  return `Generate exactly ${n} STATISTICS multiple-choice questions for ${level}, difficulty: ${diffNote}.

CRITICAL RULE: The question must NOT directly state the answer in the data.
- BAD: "Football: 9, Tennis: 2. Which sport is least popular?" (answer Tennis is obvious from data)
- GOOD: "The bar chart shows: Football: 9, Tennis: 6, Swimming: 4, Basketball: 7. How many more pupils chose Football than Swimming?" (requires calculation)
- GOOD: "Scores: 12, 15, 8, 11, 14. What is the range?" (answer requires range = max - min calculation)
- GOOD: "5 pupils scored: 14, 18, 12, 20, 16. What is the mean?" (requires summing and dividing)

Topics: mean/range calculations, reading bar charts requiring arithmetic (difference/total/average), probability, tally charts (total counting), pie charts (fraction of total).
Each has 5 options A/B/C/D/E. Pre-calculate every answer.
Include "difficulty" field (integer 1-4).
Return JSON array: [{"difficulty":${diff},"question_text":"...","options":{"A":"","B":"","C":"","D":"","E":""},"correct_answer":"B","explanation":"..."}]`;
}

function fractionsPrompt(year, diff, n) {
  return `Generate exactly ${n} FRACTIONS/DECIMALS/PERCENTAGES multiple-choice questions for P7 (age 11), difficulty: ${diff === 3 ? 'moderate' : 'challenging'}.

CRITICAL RULE: The correct answer must NOT appear anywhere in the question text.
- BAD: "Which is smallest? 201.04, 210.4, 204.1" → answer 201.04 is listed
- GOOD: "Write 3/8 as a decimal." (answer 0.375 not in question)
- GOOD: "What is 15% of 240?" (answer 36 not in question)
- GOOD: "Simplify 18/24." (answer 3/4 not in question)

Topics: fraction/decimal/percentage conversions, simplifying fractions, percentages of amounts, ordering fractions.
Each has 5 options A/B/C/D/E. Pre-calculate every answer.
Include "difficulty" field.
Return JSON array: [{"difficulty":${diff},"question_text":"...","options":{"A":"","B":"","C":"","D":"","E":""},"correct_answer":"C","explanation":"..."}]`;
}

function grammarPrompt(diff, n) {
  return `Generate exactly ${n} GRAMMAR multiple-choice questions for P7 (age 11), difficulty: challenging.

Format: question_text is a sentence with a _____ blank. Options A-E are words/phrases to fill it.
CRITICAL: The correct answer word must NOT appear in the question_text.
- BAD: "She had read the book, and she ___ it was good." answer "read" — "read" already in question
- GOOD: "By the time we arrived, the film had already _____." options: A:begin B:began C:begun D:beginned E:beginning → answer C

Test: had + past participle (had eaten/written/driven/sworn/chosen/fallen/grown/spoken/stolen/woven).
Include "difficulty" field.
Return JSON array: [{"difficulty":4,"question_text":"...","options":{"A":"","B":"","C":"","D":"","E":""},"correct_answer":"C","explanation":"..."}]`;
}

function compWrittenPrompt(year, diff, n) {
  const level = year === 'P6' ? 'P6 (age 10), simpler vocabulary' : 'P7 (age 11), richer vocabulary';
  return `Generate exactly ${n} COMPREHENSION WRITTEN-ANSWER questions for ${level}, difficulty: ${diff === 2 ? 'easy' : 'moderate'}.

Each question requires:
1. A short original reading passage (4-6 sentences, prose fiction or non-fiction)
2. ONE written-answer question about the passage

CRITICAL RULES:
- The question must NOT give away the answer — ask for a SYNONYM not the actual word
  BAD: "Find a word that means 'dangerous or hazardous'." when answer is "treacherous" — a pupil could guess from "hazardous"
  BAD: "What part of speech is 'flat'?" → answer "flat" is in the question
  GOOD: "Find a word in the passage that means 'full of life and activity'." → answer might be "bustling"
  GOOD: "Copy the simile from the passage." → answer is the simile phrase
  GOOD: "What part of speech is the word highlighted in bold?" → answer not given in question
- The correct_answer must be an exact word or phrase from the passage
- passage field = full passage text; question_text = question only (NO passage text here)

Return JSON array: [{"passage":"Full passage here...","question_text":"Question only here...","question_type":"written","options":null,"correct_answer":"exact word from passage","explanation":"Brief explanation..."}]`;
}

// ── Step 1: Fix hardcoded pictogram diagrams ───────────────────────────────────
async function fixPictogramDiagrams() {
  console.log('\n── Fixing hardcoded pictogram diagrams ──');
  const status = await sbPatch('diagram=like.*Cats*', { diagram: null });
  console.log(`  PATCH status: ${status} (set diagram=null for pictogram rows with hardcoded Cats data)`);
}

// ── Step 2: Delete self-answering questions ────────────────────────────────────
async function deleteSelfAnswering() {
  console.log('\n── Deleting self-answering questions ──');
  const status = await sbDelete(DELETE_IDS);
  console.log(`  DELETE status: ${status} (${DELETE_IDS.length} rows)`);
}

// ── Step 3: Reseed replacements ────────────────────────────────────────────────
async function reseed() {
  console.log('\n── Reseeding replacements ──');

  const batches = [
    { label: 'statistics P6 d1 ×5',    fn: () => statsPrompt('P6', 1, 5),    subject:'maths', topic:'statistics',         year:'P6', diff:1, n:5 },
    { label: 'statistics P6 d2 ×3',    fn: () => statsPrompt('P6', 2, 3),    subject:'maths', topic:'statistics',         year:'P6', diff:2, n:3 },
    { label: 'statistics P6 d3 ×1',    fn: () => statsPrompt('P6', 3, 1),    subject:'maths', topic:'statistics',         year:'P6', diff:3, n:1 },
    { label: 'statistics P6 d4 ×1',    fn: () => statsPrompt('P6', 4, 1),    subject:'maths', topic:'statistics',         year:'P6', diff:4, n:1 },
    { label: 'statistics P7 d2 ×1',    fn: () => statsPrompt('P7', 2, 1),    subject:'maths', topic:'statistics',         year:'P7', diff:2, n:1 },
    { label: 'fractions P7 d3 ×1',     fn: () => fractionsPrompt('P7', 3, 1),subject:'maths', topic:'fractions_decimals', year:'P7', diff:3, n:1 },
    { label: 'fractions P7 d4 ×1',     fn: () => fractionsPrompt('P7', 4, 1),subject:'maths', topic:'fractions_decimals', year:'P7', diff:4, n:1 },
    { label: 'grammar P7 d4 ×1',       fn: () => grammarPrompt(4, 1),         subject:'english',topic:'grammar',          year:'P7', diff:4, n:1 },
    { label: 'comp_written P6 d2 ×4',  fn: () => compWrittenPrompt('P6', 2, 4),subject:'english',topic:'comprehension_written',year:'P6',diff:2,n:4 },
    { label: 'comp_written P7 d3 ×3',  fn: () => compWrittenPrompt('P7', 3, 3),subject:'english',topic:'comprehension_written',year:'P7',diff:3,n:3 },
  ];

  for (const b of batches) {
    process.stdout.write(`  ${b.label}... `);
    try {
      const qs = await callClaude(b.fn(), 3000);
      const rows = qs.map(q => toRow(q, b.subject, b.topic, b.year, b.diff)).filter(Boolean);
      if (rows.length === 0) { console.log('no valid rows'); continue; }
      await sbInsert(rows);
      console.log(`✓ inserted ${rows.length}`);
    } catch (e) {
      console.log(`✗ ${e.message.slice(0, 100)}`);
    }
    await new Promise(r => setTimeout(r, 600));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
await fixPictogramDiagrams();
await deleteSelfAnswering();
await reseed();
console.log('\n✅ Done');
