/**
 * P7 Mock Paper Assembly Test — read-only
 * Verifies a complete 56-question P7 paper can be built from the question bank.
 */
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://iutcgogmxhaqgaxkznxu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Paper spec ────────────────────────────────────────────────────────────────
const SECTIONS = [
  { qs: 'Q1–5',   label: 'Punctuation',          subject: 'english', topic: 'punctuation',           need: 5 },
  { qs: 'Q6–10',  label: 'Grammar',               subject: 'english', topic: 'grammar',               need: 5 },
  { qs: 'Q11–15', label: 'Spelling',              subject: 'english', topic: 'spelling',              need: 5 },
  { qs: 'Q16–22', label: 'Comprehension MC',      subject: 'english', topic: 'comprehension_mc',      need: 7, passageBound: true },
  { qs: 'Q23–28', label: 'Comprehension Written', subject: 'english', topic: 'comprehension_written', need: 6, passageBound: true },
  { qs: 'Q29–35', label: 'Arithmetic',            subject: 'maths',   topic: 'arithmetic',            need: 7 },
  { qs: 'Q36–42', label: 'Geometry',              subject: 'maths',   topic: 'geometry',              need: 7 },
  { qs: 'Q43–48', label: 'Fractions/Decimals',    subject: 'maths',   topic: 'fractions_decimals',    need: 6 },
  { qs: 'Q49–52', label: 'Measurement',           subject: 'maths',   topic: 'measurement',           need: 4 },
  { qs: 'Q53–54', label: 'Statistics',            subject: 'maths',   topic: 'statistics',            need: 2 },
  { qs: 'Q55–56', label: 'Algebra/Sequences',     subject: 'maths',   topic: 'algebra_sequences',     need: 2 },
];

// ── 1. Pick a random P7 passage ───────────────────────────────────────────────
const { data: passages, error: pErr } = await sb
  .from('passages')
  .select('id, title, content')
  .eq('year_group', 'P7')
  .eq('source', 'ai_generated_v3');
if (pErr) { console.error('Failed to fetch passages:', pErr.message); process.exit(1); }

const chosenPassage = passages[Math.floor(Math.random() * passages.length)];

console.log('P7 Mock Paper Assembly Test');
console.log('='.repeat(62));
console.log(`Passage: "${chosenPassage.title}" (${chosenPassage.id.substring(0,8)}...)`);
console.log(`Preview: ${chosenPassage.content.substring(0, 110)}...`);
console.log('='.repeat(62));
console.log('');

// ── 2. Assemble each section ──────────────────────────────────────────────────
const assembled = [];
let totalFound  = 0;
let totalNeeded = 0;
let anyShort    = false;

for (const sec of SECTIONS) {
  let rows;

  if (sec.passageBound) {
    const { data } = await sb
      .from('questions')
      .select('id, question_text, question_type, topic, difficulty, correct_answer, options, passage')
      .eq('passage_id', chosenPassage.id)
      .eq('topic', sec.topic)
      .eq('source', 'ai_generated_v3');
    rows = data || [];
  } else {
    // Fetch a broad pool then shuffle + trim to needed count
    const { data } = await sb
      .from('questions')
      .select('id, question_text, question_type, topic, difficulty, correct_answer, options')
      .eq('subject', sec.subject)
      .eq('topic', sec.topic)
      .eq('year_group', 'P7')
      .eq('source', 'ai_generated_v3')
      .limit(sec.need * 6);
    const shuffled = (data || []).sort(() => Math.random() - 0.5);
    rows = shuffled.slice(0, sec.need);
  }

  const found = rows.length;
  const short = found < sec.need;
  if (short) anyShort = true;
  totalFound  += found;
  totalNeeded += sec.need;

  const badge = short ? 'SHORT' : 'OK   ';
  const icon  = short ? 'X' : 'v';
  console.log(`[${icon}] ${sec.qs.padEnd(8)} ${sec.label.padEnd(26)} found ${found}/${sec.need}  ${short ? '<-- SHORT' : ''}`);

  if (rows.length > 0) {
    const q       = rows[0];
    const preview = q.question_text.replace(/\n/g, ' ').substring(0, 72);
    const optStr  = q.options
      ? Object.entries(q.options).map(([k, v]) => `${k}:${String(v).substring(0, 12)}`).join('  ')
      : '(written — no options)';
    console.log(`         diff:${q.difficulty} type:${q.question_type}`);
    console.log(`         Q: "${preview}..."`);
    console.log(`         ${optStr}`);
    console.log(`         Ans: ${q.correct_answer}`);
  }
  console.log('');

  assembled.push({ ...sec, found, rows });
}

// ── 3. Comprehension passage integrity ───────────────────────────────────────
const mcSec      = assembled.find(s => s.topic === 'comprehension_mc');
const writtenSec = assembled.find(s => s.topic === 'comprehension_written');

const allSamePassage = [
  ...mcSec.rows,
  ...writtenSec.rows,
].every(q => q.passage && q.passage.substring(0, 60) === chosenPassage.content.substring(0, 60));

console.log('Comprehension integrity');
console.log('-'.repeat(62));
console.log(`  Passage:                  "${chosenPassage.title}"`);
console.log(`  MC questions found:       ${mcSec.found} / 7   ${mcSec.found === 7 ? '[OK]' : '[SHORT]'}`);
console.log(`  Written questions found:  ${writtenSec.found} / 6   ${writtenSec.found === 6 ? '[OK]' : '[SHORT]'}`);
console.log(`  All 13 share same passage: ${allSamePassage ? '[OK]' : '[FAIL - passage text mismatch]'}`);
console.log('');

// ── 4. Format sanity checks ───────────────────────────────────────────────────
console.log('Format sanity checks');
console.log('-'.repeat(62));

const checks = [];

// Written comprehension must have options=null
const allWrittenNull = writtenSec.rows.every(q => q.options === null);
checks.push(['comprehension_written all options=null', allWrittenNull]);

// Punctuation must have N option
const punctSec  = assembled.find(s => s.topic === 'punctuation');
const punctHasN = punctSec.rows.filter(q => q.options && 'N' in q.options).length;
checks.push([`punctuation has N option (${punctHasN}/${punctSec.rows.length})`, punctHasN === punctSec.rows.length]);

// Spelling must have N option
const spellSec  = assembled.find(s => s.topic === 'spelling');
const spellHasN = spellSec.rows.filter(q => q.options && 'N' in q.options).length;
checks.push([`spelling has N option (${spellHasN}/${spellSec.rows.length})`, spellHasN === spellSec.rows.length]);

// Grammar must have 5 options (A-E)
const grammarSec  = assembled.find(s => s.topic === 'grammar');
const grammar5opt = grammarSec.rows.filter(q => q.options && Object.keys(q.options).length === 5).length;
checks.push([`grammar 5-option MC (${grammar5opt}/${grammarSec.rows.length})`, grammar5opt === grammarSec.rows.length]);

// Maths sections must have 5 options (A-E)
const mathsSections = assembled.filter(s => s.subject === 'maths');
for (const ms of mathsSections) {
  const has5 = ms.rows.filter(q => q.options && Object.keys(q.options).length === 5).length;
  checks.push([`${ms.topic} 5-option MC (${has5}/${ms.rows.length})`, has5 === ms.rows.length]);
}

// Correct_answer must be non-empty for all questions
const allHaveAnswer = assembled
  .flatMap(s => s.rows)
  .every(q => q.correct_answer && String(q.correct_answer).trim().length > 0);
checks.push(['all questions have correct_answer', allHaveAnswer]);

// Total question count
checks.push([`total assembled = 56 (got ${totalFound})`, totalFound === 56]);

for (const [label, ok] of checks) {
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${label}`);
}

// ── 5. Difficulty distribution ────────────────────────────────────────────────
console.log('');
console.log('Difficulty distribution');
console.log('-'.repeat(62));
const allQs = assembled.flatMap(s => s.rows);
const diffCounts = {};
for (const q of allQs) {
  diffCounts[q.difficulty] = (diffCounts[q.difficulty] || 0) + 1;
}
for (const [d, n] of Object.entries(diffCounts).sort()) {
  console.log(`  Difficulty ${d}: ${n} questions`);
}

// ── 6. Final verdict ──────────────────────────────────────────────────────────
console.log('');
console.log('='.repeat(62));
console.log(`Total assembled: ${totalFound} / ${totalNeeded}`);
const allChecksPass = checks.every(([, ok]) => ok);
if (!anyShort && allChecksPass) {
  console.log('RESULT: PASS -- full 56-question P7 paper assembled successfully');
} else {
  if (anyShort) {
    const shorts = assembled.filter(s => s.found < s.need).map(s => `${s.label} (${s.found}/${s.need})`);
    console.log(`RESULT: FAIL -- short sections: ${shorts.join(', ')}`);
  }
  if (!allChecksPass) {
    const failed = checks.filter(([, ok]) => !ok).map(([label]) => label);
    console.log(`RESULT: FAIL -- failed checks: ${failed.join('; ')}`);
  }
}
console.log('='.repeat(62));
