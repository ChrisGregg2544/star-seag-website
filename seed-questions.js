/**
 * STAR AI Tutor — Question Bank Generator
 * 
 * Generates ~500 SEAG-style questions and inserts them into Supabase.
 * Run with: node generate-questions.js
 * 
 * Requirements:
 *   npm install @anthropic-ai/sdk @supabase/supabase-js
 * 
 * Set these env vars before running (or paste values directly below):
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (use service role key, not anon key)
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

// ── Config ────────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY  || 'YOUR_KEY_HERE';
const SUPABASE_URL       = process.env.SUPABASE_URL       || 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPABASE_KEY       = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY_HERE';

const BATCH_SIZE = 5;          // questions per API call
const DELAY_MS   = 4000;       // ms between batches (avoid rate limits)

// ── Clients ───────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Question targets ──────────────────────────────────────────────────────────
// Each entry: [subject, topic, year_group, difficulty, count]
// Total = 500 questions
const TARGETS = [
  // ── P6 English (Warm-Up level) ──────────────────────────────────
  ['english', 'punctuation',            'P6', 2, 15],
  ['english', 'punctuation',            'P6', 3, 10],
  ['english', 'grammar',                'P6', 2, 15],
  ['english', 'grammar',                'P6', 3, 10],
  ['english', 'spelling',               'P6', 2, 15],
  ['english', 'spelling',               'P6', 3, 10],
  ['english', 'vocabulary',             'P6', 2, 10],
  ['english', 'comprehension_mc',       'P6', 2, 10],
  ['english', 'comprehension_written',  'P6', 2, 10],

  // ── P7 English (Main Series level) ─────────────────────────────
  ['english', 'punctuation',            'P7', 3, 15],
  ['english', 'punctuation',            'P7', 4, 10],
  ['english', 'grammar',                'P7', 3, 15],
  ['english', 'grammar',                'P7', 4, 10],
  ['english', 'spelling',               'P7', 3, 15],
  ['english', 'spelling',               'P7', 4, 10],
  ['english', 'vocabulary',             'P7', 3, 10],
  ['english', 'comprehension_mc',       'P7', 3, 10],
  ['english', 'comprehension_written',  'P7', 3, 10],

  // ── P6 Maths (Warm-Up level) ────────────────────────────────────
  ['maths', 'arithmetic',               'P6', 2, 15],
  ['maths', 'fractions_decimals',       'P6', 2, 15],
  ['maths', 'geometry',                 'P6', 2, 15],
  ['maths', 'statistics',               'P6', 2, 10],
  ['maths', 'algebra_sequences',        'P6', 2, 10],
  ['maths', 'measurement',              'P6', 2, 10],

  // ── P7 Maths (Main Series level) ───────────────────────────────
  ['maths', 'arithmetic',               'P7', 3, 15],
  ['maths', 'arithmetic',               'P7', 4, 10],
  ['maths', 'fractions_decimals',       'P7', 3, 15],
  ['maths', 'fractions_decimals',       'P7', 4, 10],
  ['maths', 'geometry',                 'P7', 3, 15],
  ['maths', 'geometry',                 'P7', 4, 10],
  ['maths', 'statistics',               'P7', 3, 10],
  ['maths', 'algebra_sequences',        'P7', 3, 10],
  ['maths', 'measurement',              'P7', 3, 10],
];

// ── Prompt builders ───────────────────────────────────────────────────────────
function buildPrompt(subject, topic, yearGroup, difficulty, count) {
  const diffLabel = { 1: 'very easy', 2: 'easy', 3: 'moderate', 4: 'challenging', 5: 'very hard' }[difficulty];
  const level = yearGroup === 'P6' ? 'P6 (Warm-Up level — slightly easier SEAG prep)' : 'P7 (Main Series — full SEAG exam standard)';

  const englishTopicGuide = {
    punctuation: `Identify the sentence with a punctuation error (apostrophes for contraction/possession, speech marks, commas, question marks, capital letters). Options A–D show variations of the sentence; option N = no mistake. Focus on: apostrophes in contractions (wasn't, it's), possessive apostrophes, speech mark placement (comma/punctuation before closing speech mark), question marks in direct speech.`,
    grammar: `Choose the correct word or phrase to complete the sentence. Test: past participles after had/have/has (sang vs sung, wrote vs written), pronoun case (me vs I, who vs whom), verb tense consistency, connectives (either/or, neither/nor, whether/if), prepositions (on, at, in, upon), comparative vs superlative (taller vs tallest for two vs many).`,
    spelling: `Four words are underlined in a passage extract; one is misspelled. Common targets: words with silent letters, double consonants, -ance/-ence endings, i-before-e rule, -ful suffix (never double l), -tion/-sion endings, homophones (their/there/they're, whose/who's). Option N = no mistake.`,
    vocabulary: `Based on a short passage extract (2-3 sentences provided in the question), find a word that means the same as a given word, or identify what a word/phrase means in context. Also: identify part of speech (noun/verb/adjective/adverb) of an underlined word.`,
    comprehension_mc: `Based on a short passage extract (provide 4-6 lines of original fictional or non-fiction text in the question itself). Ask about: mood/atmosphere, character feelings, author's purpose, meaning of a word/phrase in context, literary devices (simile uses 'like' or 'as', metaphor says one thing IS another, alliteration = repeated starting sounds, personification = giving human traits to non-human things).`,
    comprehension_written: `Based on a short passage extract (provide 4-6 lines of original text). Ask for: a specific word/phrase from the text, a line number where something occurs, what a word means, naming a literary device, identifying a part of speech.`,
  };

  const mathsTopicGuide = {
    arithmetic: `Operations with whole numbers, decimals, money. Mental strategies: rounding to estimate, place value (units/tens/hundreds/thousands/tenths/hundredths), multiplying/dividing by 10/100/1000, order of operations. Function machines (two operations, test both pairs of numbers). Written addition/subtraction up to 6 digits. Long multiplication (3-digit × 2-digit). Division with remainders converted to decimals.`,
    fractions_decimals: `Equivalent fractions, simplifying, comparing fractions (convert to same denominator). Fractions of amounts. Mixed numbers and improper fractions. Adding/subtracting fractions. Converting fractions to decimals (1/4=0.25, 1/8=0.125, 3/8=0.375). Percentages: 10%=÷10, 25%=÷4, 20%=÷5, 75%=3/4. Finding a percentage of an amount. Expressing as percentage. Ordering decimals (compare tenths first, then hundredths).`,
    geometry: `2D shapes: area of rectangles (l×w), area of triangles (base×height÷2), area of compound shapes (subtract missing corner). Perimeter. Angles: angles on a straight line = 180°, in a triangle = 180°, in a quadrilateral = 360°, in a full turn = 360°. Properties: isosceles (two equal sides/angles), equilateral (all 60°), rhombus (opposite angles equal, adjacent add to 180°). 3D shapes: faces/edges/vertices of cube(6/12/8), cuboid, triangular prism(5/9/6), square pyramid(5/8/5), triangular pyramid(4/6/4), hexagonal prism(8/18/12). Volume = l×w×h. Nets of 3D shapes. Lines of symmetry. Coordinates (x,y). Reflections. Compass directions and turns (N/S/E/W/NE etc, 90°=quarter turn).`,
    statistics: `Bar charts and line graphs: read values, find difference, calculate totals. Pie charts: sector angles (360°÷total). Mean (add all ÷ count). Pictograms (each symbol = multiple items). Tally charts. Probability language (certain/likely/unlikely/impossible). Distance/conversion tables.`,
    algebra_sequences: `Number sequences: find the rule (+n, ×n, square numbers 1,4,9,16,25..., triangular numbers 1,3,6,10,15..., cube numbers 1,8,27,64,125..., Fibonacci-style). Find missing terms. Function machines with two operations. Simple algebra: find the value of a letter. Word problems: form and solve equations. Patterns: count shapes/lines in nth pattern.`,
    measurement: `Unit conversions: 1km=1000m, 1m=100cm, 1cm=10mm, 1kg=1000g, 1 litre=1000ml. Time: 12-hour/24-hour conversion, time intervals (adding/subtracting hours and minutes), timetables. Scale: map scales (e.g. 1cm=4km). Perimeter of irregular shapes. Reading scales (thermometers, rulers, jugs — identify interval value).`,
  };

  const topicGuide = subject === 'english' ? englishTopicGuide[topic] : mathsTopicGuide[topic];

  const mcFormat = subject === 'english' && (topic === 'punctuation' || topic === 'spelling')
    ? `Multiple choice with options A, B, C, D, N (where N = "No mistakes").`
    : subject === 'english' && topic === 'comprehension_written'
    ? `Written answer (no options — student writes the answer).`
    : `Multiple choice with options A, B, C, D, E.`;

  return `You are generating ${count} original exam questions for STAR AI Tutor, a Northern Ireland SEAG Transfer Test preparation platform for P6/P7 pupils (ages 10-11).

YEAR GROUP: ${level}
SUBJECT: ${subject.toUpperCase()}
TOPIC: ${topic}
DIFFICULTY: ${diffLabel} (${difficulty}/5)
FORMAT: ${mcFormat}

TOPIC GUIDANCE:
${topicGuide}

SEAG FORMAT RULES:
- Each test has 56 questions total (28 English Q1-28, 28 Maths Q29-56)
- English Q1-5 and Q11-15: punctuation/spelling errors, options A/B/C/D/N
- English Q6-10: grammar/word choice, options A/B/C/D/E  
- English Q16-22: comprehension multiple choice, options A/B/C/D/E
- English Q23-28: comprehension written answers
- Maths Q29-50: multiple choice A/B/C/D/E
- Maths Q51-56: written answers (numerical)
- Questions must be self-contained — no external passage needed EXCEPT comprehension questions which must include a short passage

CRITICAL RULES:
1. Never copy from Catapult Papers or any published material
2. All questions must be completely original
3. For P6: slightly easier vocabulary, simpler sentence structures, smaller numbers
4. For P7: full exam difficulty, more complex language, harder calculations
5. Explanations must be brief (2 lines max) and parent-friendly
6. For punctuation/spelling questions: provide the sentence with a deliberate error in one option, and make N (no mistakes) correct about 20% of the time
7. For maths: all answers must be verified correct — double-check your arithmetic

Respond with ONLY a valid JSON array. No markdown, no backticks, no preamble. Example structure:

[
  {
    "question_text": "Choose the sentence that contains a punctuation mistake.",
    "question_type": "mc",
    "options": {
      "A": "The dog wasn't allowed inside the house.",
      "B": "She said, 'I'll be back by six o'clock.'",
      "C": "Its a lovely day for a walk in the park.",
      "D": "They couldn't find their coats anywhere.",
      "N": "No mistakes"
    },
    "correct_answer": "C",
    "explanation": "Its should be It's — a contraction of it is. The apostrophe replaces the letter i from the word is."
  }
]

For written answer questions, set options to null and correct_answer to the expected answer string.

Now generate ${count} questions for ${subject} / ${topic} / ${yearGroup} / difficulty ${difficulty}:`;
}

// ── Insert to Supabase ────────────────────────────────────────────────────────
async function insertQuestions(questions, subject, topic, yearGroup, difficulty) {
  const rows = questions.map(q => ({
    subject,
    topic,
    year_group: yearGroup,
    difficulty,
    question_type: q.question_type || (q.options ? 'mc' : 'written'),
    question_text: q.question_text,
    options: q.options || null,
    correct_answer: q.correct_answer,
    explanation: q.explanation || null,
    validated: false,
    source: 'ai_generated',
  }));

  const { error, data } = await supabase.from('questions').insert(rows).select('id');
  if (error) throw new Error(`Supabase insert error: ${error.message}`);
  return data.length;
}

// ── Generate one batch ────────────────────────────────────────────────────────
async function generateBatch(subject, topic, yearGroup, difficulty, count) {
  const prompt = buildPrompt(subject, topic, yearGroup, difficulty, count);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();

  // Strip any accidental markdown fences
  const clean = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();

  let questions;
  try {
    questions = JSON.parse(clean);
  } catch (e) {
    console.error('JSON parse failed. Raw response:', raw.substring(0, 500));
    throw new Error(`Failed to parse JSON: ${e.message}`);
  }

  if (!Array.isArray(questions)) throw new Error('Response was not a JSON array');
  return questions;
}

// ── Sleep helper ──────────────────────────────────────────────────────────────
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 STAR AI Tutor — Question Bank Generator');
  console.log('==========================================');

  let totalInserted = 0;
  let totalErrors   = 0;

  for (const [subject, topic, yearGroup, difficulty, count] of TARGETS) {
    const batches = Math.ceil(count / BATCH_SIZE);
    console.log(`\n📝 ${yearGroup} ${subject} / ${topic} / diff:${difficulty} — ${count} questions (${batches} batches)`);

    let inserted = 0;
    let remaining = count;

    for (let b = 0; b < batches; b++) {
      const batchCount = Math.min(BATCH_SIZE, remaining);
      process.stdout.write(`   Batch ${b + 1}/${batches} (${batchCount} questions)... `);

      try {
        const questions = await generateBatch(subject, topic, yearGroup, difficulty, batchCount);
        const n = await insertQuestions(questions, subject, topic, yearGroup, difficulty);
        inserted  += n;
        remaining -= batchCount;
        totalInserted += n;
        console.log(`✅ inserted ${n}`);
      } catch (err) {
        totalErrors++;
        console.log(`❌ ERROR: ${err.message}`);
      }

      if (b < batches - 1) await sleep(DELAY_MS);
    }

    console.log(`   → ${inserted}/${count} inserted for this target`);
  }

  console.log('\n==========================================');
  console.log(`✅ Done! Total inserted: ${totalInserted}`);
  if (totalErrors > 0) console.log(`⚠️  Batches with errors: ${totalErrors} (re-run to retry)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
