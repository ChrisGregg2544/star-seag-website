/**
 * validate-all-ai.js
 * Runs the validate.html Claude validator against ALL validated MC questions.
 *
 * On completion:
 *   FAIL → validated=false + validator_verdict='fail'  (goes to review queue)
 *   WARN → validator_verdict='warn'  (stays visible to students, flagged for review)
 *   PASS → no DB change
 *
 * Usage:
 *   node scripts/validate-all-ai.js
 *   TOPIC=statistics   node scripts/validate-all-ai.js   ← single topic only
 *   YEAR=P6            node scripts/validate-all-ai.js   ← single year group
 *   LIMIT=100          node scripts/validate-all-ai.js   ← cap questions
 *   DRY_RUN=1          node scripts/validate-all-ai.js   ← no DB writes
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const SUPABASE_URL  = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY   = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = envVars.ANTHROPIC_API_KEY;
const DRY_RUN       = process.env.DRY_RUN === '1';
const FILTER_TOPIC  = process.env.TOPIC || '';
const FILTER_YEAR   = process.env.YEAR  || '';
const LIMIT         = process.env.LIMIT ? parseInt(process.env.LIMIT) : Infinity;
const PAGE_SIZE     = 200;
const CONCURRENCY   = 5;
const DELAY_MS      = 200;

if (!SERVICE_KEY)   { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }

const sbHeaders = {
  apikey:         SERVICE_KEY,
  Authorization:  `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// ── Topic standards (from validate.html) ──────────────────────────────────────
const STANDARD = {
  punctuation: `PUNCTUATION STANDARD:
Questions test punctuation and capitalisation errors in sentences.
Format may use "/" dividers (Catapult style) OR may present as a full sentence with one error to identify — both are valid.
Error types tested include: apostrophes, commas, colons, semicolons, capital letters, full stops, question marks, speech marks, and any other standard punctuation.
N = No mistakes is a valid correct answer ~20% of time.
VERDICT RULES: PASS if the marked correct answer contains a genuine punctuation error. FAIL ONLY if the marked correct answer is actually correct (no error there) or the question is broken.`,
  
  grammar: `REAL CATAPULT PAPERS GRAMMAR STANDARD:
Format: sentence with a blank, choose correct word/phrase from A/B/C/D/E.
Tests: had/have/has + past participle, connectives, prepositions, pronoun case, reflexive pronouns, verb tense/agreement, homophones.
VERDICT RULES: FAIL only if the marked correct answer is genuinely grammatically wrong. WARN only if two or more options are equally correct with identical meaning. NEVER warn because distractors seem incomplete — evaluate only whether the correct answer is right.`,

  spelling: `REAL CATAPULT PAPERS SPELLING STANDARD:
Format: short passage with 4 underlined words, one misspelled. Options A/B/C/D/N.
Tests: suffix rules, i-before-e, double consonants, homophones, commonly misspelled words.
N = No mistakes ~20% of time — do NOT warn/fail because N is the correct answer.
VERDICT RULES: PASS if the correct answer key points to the option containing the misspelled word. Do NOT verify phonics mnemonics in explanations — they are simplified teaching aids.`,

  vocabulary: `REAL CATAPULT PAPERS VOCABULARY STANDARD:
Always based on a short passage extract (3-5 sentences) provided within the question.
Question types: find a word meaning the same as X, what does this word mean in context, identify part of speech.
The passage must be original and the answer findable within it.`,

  comprehension_mc: `REAL CATAPULT PAPERS COMPREHENSION MC STANDARD:
Based on an original passage extract (5-8 lines in question or passage field).
Question types: main purpose/theme, how a character feels, word/phrase meaning in context, literary device, part of speech as used in passage, mood/tone, what character discovers.
CRITICAL RULE: Questions asking "what part of speech is word X?" are STANDARD and VALID. Do NOT fail these.
Literary devices: simile uses like/as, metaphor says IS, alliteration = repeated start sounds, personification = human traits to non-human things.`,

  comprehension_written: `REAL CATAPULT PAPERS COMPREHENSION WRITTEN STANDARD:
Based on an original passage extract. Written answer — no options.
Question types: find a specific word from text, copy simile/metaphor, identify compound word, name part of speech, give synonym, find line number.
Answer must be directly findable in the provided extract.`,

  arithmetic: `REAL CATAPULT PAPERS ARITHMETIC STANDARD:
P6 diff 2: operations up to 10,000, money, one or two steps, basic multiplication.
P7 diff 3-4: long multiplication (3-digit × 2-digit), division with remainders as decimals, multi-step word problems (shopping, travel, time, capacity).
Function machines: two sequential operations, find input or output.
ALL ARITHMETIC MUST BE VERIFIED CORRECT — double-check every calculation.`,

  fractions_decimals: `REAL CATAPULT PAPERS FRACTIONS/DECIMALS STANDARD:
Equivalent fractions: check by multiplying numerator and denominator by same number.
Fractions of amounts: divide by denominator then multiply by numerator.
Ordering decimals: compare tenths digit first.
Converting: 7/10=0.7, 3/8=0.375, 53/100=0.53, 7%=0.07.
Percentages: 25%=÷4, 20%=÷5, 10%=÷10, 75%=×3÷4.`,

  geometry: `REAL CATAPULT PAPERS GEOMETRY STANDARD:
Angles: straight line=180°, triangle=180°, quadrilateral=360°, full turn=360°.
Isosceles: two equal sides/angles. Equilateral: all 60°. Rhombus: adjacent angles add to 180°.
Compass: clockwise, quarter=90°, half=180°, three-quarter=270°. N→E→S→W clockwise.
3D shapes: triangular prism 5 faces/9 edges/6 vertices, cube 6/12/8, square pyramid 5/8/5.
Area: rectangle=l×w, triangle=base×height÷2. Volume: l×w×h. Nets: cross of 6 squares folds to cube.`,

  statistics: `REAL CATAPULT PAPERS STATISTICS STANDARD:
Pictograms: establish symbol value first from given data, then calculate.
Bar/line graphs: read values carefully (each interval may represent 2 or more units), find differences and totals.
Mean: add all values then divide by count. Mode: most frequent value. Range: max minus min.
Pie charts: sector angles (360°÷total×frequency). Probability: certain/likely/unlikely/impossible language.
P6: straightforward chart reading. P7: multi-step, calculate missing values, interpret trends.`,

  algebra_sequences: `REAL CATAPULT PAPERS ALGEBRA/SEQUENCES STANDARD:
Triangular numbers: 1,3,6,10,15,21,28,36,45,55 (differences +2,+3,+4...).
Square numbers: 1,4,9,16,25,36,49,64,81,100. Cube numbers: 1,8,27,64,125.
Pattern sequences: identify shape arrangement. Function machines: two sequential operations.
Missing terms: establish the rule from consecutive terms, then apply.`,

  measurement: `REAL CATAPULT PAPERS MEASUREMENT STANDARD:
Conversions: 1km=1000m, 1m=100cm, 1cm=10mm, 1kg=1000g, 1 litre=1000ml.
Reading scales: count divisions between labelled marks to find interval value.
Time: 12-hour to 24-hour (add 12 for pm after noon), time intervals, timetables.
Map scales: multiply cm measurement by scale factor for real distance.`,
};

const DIAGRAM_NOTE = `\nDIAGRAM RULE: Some questions require a visual diagram (nets, coordinate grids, bar charts, pie charts, pictograms, scale readings, shaded fractions). These are valid — diagrams are stored separately in the diagram field.
If a question CANNOT be answered from text alone because it requires reading a specific visual value, give WARN with reason "requires diagram". Do NOT give FAIL for this reason.
Only FAIL a question if the correct answer is mathematically/grammatically wrong.\n`;

const NPUNCSPELL_NOTE = `\nCRITICAL RULE: Do NOT issue WARN or FAIL solely because the correct answer is N (No mistake). N answers are intentional and valid in real Catapult Papers — they appear ~20% of the time.\n`;

// ── Prompt builder ─────────────────────────────────────────────────────────────
function buildPrompt(q) {
  const topic    = q.topic || '';
  const standard = STANDARD[topic] || `Check this question meets SEAG Transfer Test standard for Northern Ireland P6/P7 (ages 10-11).`;

  const isPunctSpell = topic === 'punctuation' || topic === 'spelling';
  const isComp       = topic.startsWith('comprehension');

  const optionsText = q.options
    ? Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join('\n')
    : 'Written answer (no options)';

  const passageSection = q.passage
    ? `\n${topic === 'punctuation' ? 'Full sentence' : 'Passage'}:\n${q.passage}\n`
    : '';

  const compNote = isComp
    ? (q.passage
        ? `\nIMPORTANT: The reading passage is in the Passage field above. Do NOT warn/fail because "no passage provided".\n`
        : `\nIMPORTANT: The reading passage is embedded inside question_text above. Do NOT warn/fail because "no passage provided".\n`)
    : topic === 'punctuation' && q.passage
      ? `\nIMPORTANT FOR PUNCTUATION: Full sentence with "/" dividers is in the Full sentence field. Options A/B/C/D show one section each.\n`
      : '';

  return `You are a quality checker for a Northern Ireland SEAG Transfer Test preparation platform (British English, UK curriculum).

Check this question against the REAL Catapult Papers standard:

${standard}
${compNote}${isPunctSpell ? NPUNCSPELL_NOTE : ''}${DIAGRAM_NOTE}
QUESTION:
Subject: ${q.subject} | Topic: ${topic} | Year: ${q.year_group} | Difficulty: ${q.difficulty}/5

Question text:
${q.question_text}
${passageSection}
Options:
${optionsText}

Correct answer: ${q.correct_answer}
Explanation: ${q.explanation || 'none'}

VERDICT CRITERIA:
PASS = correct answer is right, question is clear, difficulty appropriate for ${q.year_group}. Format does NOT need to match Catapult Papers exactly — AI-generated questions are valid even if phrased differently.
WARN = minor issues (awkward wording, explanation slightly off, requires diagram to read, format unusual but question is usable)
FAIL = ONLY these reasons: (1) correct answer is factually/mathematically wrong, (2) two or more options are equally correct making the question unanswerable, (3) question is complete gibberish/broken text. Do NOT fail for format differences.

NOTE: explanations may deliberately quote incorrect forms to contrast with correct ones. Do NOT treat this as an error.
NOTE: for spelling, only check the correct answer letter points to the option containing the misspelled word.
WARN (not FAIL) for wrong topic tag — the question is usable just miscategorised.

Do all reasoning silently. Output ONLY the JSON object below — no text before or after:
{"verdict":"PASS|WARN|FAIL","reason":"max 8 words"}`;
}

// ── Claude call ────────────────────────────────────────────────────────────────
async function askClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw  = (data.content?.[0]?.text || '').trim();
  const json = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/,'').trim();
  const m    = json.match(/\{[\s\S]*?\}/);
  if (!m) throw new Error(`No JSON in: ${raw.slice(0, 100)}`);
  const result = JSON.parse(m[0]);
  if (!['PASS','WARN','FAIL'].includes(result.verdict)) throw new Error(`Bad verdict: ${result.verdict}`);
  return result;
}

// ── Supabase helpers ───────────────────────────────────────────────────────────
async function fetchPage(offset) {
  let url = `${SUPABASE_URL}/rest/v1/questions`
    + `?validated=eq.true`
    + `&options=not.is.null`
    + `&select=id,subject,topic,year_group,difficulty,question_text,options,correct_answer,explanation,passage`
    + `&limit=${PAGE_SIZE}&offset=${offset}`;
  if (FILTER_TOPIC) url += `&topic=eq.${encodeURIComponent(FILTER_TOPIC)}`;
  if (FILTER_YEAR)  url += `&year_group=eq.${encodeURIComponent(FILTER_YEAR)}`;
  const res = await fetch(url, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function markFail(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`, {
    method:  'PATCH',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body:    JSON.stringify({ validated: false, validator_verdict: 'fail' }),
  });
  if (!res.ok) throw new Error(`PATCH failed for ${id}: ${await res.text()}`);
}

async function markWarn(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`, {
    method:  'PATCH',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body:    JSON.stringify({ validator_verdict: 'warn' }),
  });
  if (!res.ok) throw new Error(`PATCH warn for ${id}: ${await res.text()}`);
}

// ── Concurrency pool ──────────────────────────────────────────────────────────
async function processBatch(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const chunk   = items.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(fn));
    out.push(...results);
    if (i + CONCURRENCY < items.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }
  return out;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`validate-all-ai   DRY_RUN=${DRY_RUN}  CONCURRENCY=${CONCURRENCY}`);
  if (FILTER_TOPIC) console.log(`  topic filter: ${FILTER_TOPIC}`);
  if (FILTER_YEAR)  console.log(`  year filter:  ${FILTER_YEAR}`);
  console.log('');

  // Fetch all questions
  let allRows = [];
  let offset  = 0;
  process.stdout.write('Fetching questions...');
  while (true) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;
    allRows.push(...rows);
    process.stdout.write(` ${allRows.length}`);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log('\n');

  if (LIMIT < Infinity) allRows = allRows.slice(0, LIMIT);
  console.log(`Total to validate: ${allRows.length}`);
  console.log(`Estimated time   : ~${Math.ceil(allRows.length / CONCURRENCY * (2 + DELAY_MS/1000) / 60)} minutes\n`);

  // Counters
  const byTopic = {};
  const total   = { PASS: 0, WARN: 0, FAIL: 0, ERROR: 0 };
  const failIds = [];
  const failLog = [];
  const warnLog = [];
  let done = 0;
  const startTime = Date.now();

  await processBatch(allRows, async (row) => {
    const t = row.topic || 'unknown';
    if (!byTopic[t]) byTopic[t] = { PASS: 0, WARN: 0, FAIL: 0, ERROR: 0 };

    try {
      const result = await askClaude(buildPrompt(row));
      total[result.verdict]++;
      byTopic[t][result.verdict]++;
      done++;

      if (result.verdict === 'FAIL') {
        failIds.push(row.id);
        failLog.push({ id: row.id, topic: t, year: row.year_group, reason: result.reason, q: row.question_text.slice(0, 80) });
        if (!DRY_RUN) await markFail(row.id);
      }
      if (result.verdict === 'WARN') {
        warnLog.push({ id: row.id, topic: t, year: row.year_group, reason: result.reason, q: row.question_text.slice(0, 80) });
        if (!DRY_RUN) await markWarn(row.id);
      }

      if (done % 100 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate    = (done / elapsed).toFixed(1);
        const eta     = Math.round((allRows.length - done) / rate / 60);
        console.log(`  ${done}/${allRows.length}  PASS=${total.PASS}  WARN=${total.WARN}  FAIL=${total.FAIL}  ERR=${total.ERROR}  (${rate}/s, ETA ~${eta}m)`);
      }
    } catch (e) {
      total.ERROR++;
      byTopic[t].ERROR = (byTopic[t].ERROR || 0) + 1;
      done++;
      // Don't flood the console with every error — sample every 10th
      if (total.ERROR % 10 === 1) console.error(`  ERR ${row.id} [${t}] — ${e.message.slice(0, 80)}`);
    }
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nCompleted in ${Math.floor(elapsed/60)}m ${elapsed%60}s\n`);

  // ── Summary by topic ─────────────────────────────────────────────────────────
  console.log('── Results by topic ─────────────────────────────────────────────────');
  console.log(`${'Topic'.padEnd(28)} ${'Total'.padStart(6)} ${'PASS'.padStart(6)} ${'WARN'.padStart(6)} ${'FAIL'.padStart(6)} ${'ERR'.padStart(5)} ${'Pass%'.padStart(6)}`);
  console.log('─'.repeat(70));

  const allTopics = Object.entries(byTopic).sort(([a], [b]) => a.localeCompare(b));
  for (const [topic, counts] of allTopics) {
    const t = counts.PASS + counts.WARN + counts.FAIL + (counts.ERROR || 0);
    const pct = t > 0 ? Math.round(counts.PASS / t * 100) : 0;
    console.log(
      `${topic.padEnd(28)} ${String(t).padStart(6)} ${String(counts.PASS).padStart(6)} ${String(counts.WARN).padStart(6)} ${String(counts.FAIL).padStart(6)} ${String(counts.ERROR||0).padStart(5)} ${String(pct+'%').padStart(6)}`
    );
  }

  console.log('─'.repeat(70));
  const grand = allRows.length;
  const grandPct = grand > 0 ? Math.round(total.PASS / grand * 100) : 0;
  console.log(
    `${'TOTAL'.padEnd(28)} ${String(grand).padStart(6)} ${String(total.PASS).padStart(6)} ${String(total.WARN).padStart(6)} ${String(total.FAIL).padStart(6)} ${String(total.ERROR).padStart(5)} ${String(grandPct+'%').padStart(6)}`
  );

  // ── FAIL details ─────────────────────────────────────────────────────────────
  if (failLog.length > 0) {
    console.log(`\n── FAIL details (${failLog.length} total) ──────────────────────────────────`);
    const byTopicFail = {};
    for (const f of failLog) {
      if (!byTopicFail[f.topic]) byTopicFail[f.topic] = [];
      byTopicFail[f.topic].push(f);
    }
    for (const [t, items] of Object.entries(byTopicFail).sort()) {
      console.log(`\n  [${t}] — ${items.length} fails`);
      for (const f of items) {
        console.log(`    ${f.id}  [${f.year}]  ${f.reason}`);
        console.log(`    Q: ${f.q}`);
      }
    }
  }

  // ── WARN details ──────────────────────────────────────────────────────────────
  if (warnLog.length > 0) {
    console.log(`\n── WARN summary (${warnLog.length} total — NOT removed from student view) ─`);
    // Just count by reason pattern
    const reasonCounts = {};
    for (const w of warnLog) {
      const key = w.reason.slice(0, 40);
      reasonCounts[key] = (reasonCounts[key] || 0) + 1;
    }
    const sorted = Object.entries(reasonCounts).sort(([,a],[,b]) => b - a);
    for (const [reason, count] of sorted.slice(0, 15)) {
      console.log(`  ${String(count).padStart(4)}x  ${reason}`);
    }
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN — no DB changes made.');
  } else {
    console.log(`\n${failIds.length} questions marked validated=false + validator_verdict=fail.`);
    console.log(`${warnLog.length} questions marked validator_verdict=warn.`);
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
