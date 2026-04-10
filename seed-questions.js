/**
 * STAR AI Tutor — Question Bank Generator v3
 * Fixed: grammar sentences, maths MC options, comprehension passages
 *
 * Run with:
 * !ANTHROPIC_API_KEY=sk-ant-... SUPABASE_SERVICE_KEY=eyJ... node seed-questions.js
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { generateDiagram } from './diagram-generator.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY  || 'YOUR_KEY_HERE';
const SUPABASE_URL      = process.env.SUPABASE_URL       || 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY_HERE';

const BATCH_SIZE = 5;
const DELAY_MS   = 4000;

// CLI: --limit N  → only run N targets; --from N → start from target index N
const limitArg = process.argv.indexOf('--limit');
const fromArg  = process.argv.indexOf('--from');
const TARGET_LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;
const TARGET_FROM  = fromArg  !== -1 ? parseInt(process.argv[fromArg  + 1], 10) : 0;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_KEY);

// Topic names MUST match these exactly — do not change
const TARGETS = [
  ['english', 'punctuation',           'P6', 2, 15],
  ['english', 'punctuation',           'P6', 3, 10],
  ['english', 'grammar',               'P6', 2, 15],
  ['english', 'grammar',               'P6', 3, 10],
  ['english', 'spelling',              'P6', 2, 15],
  ['english', 'spelling',              'P6', 3, 10],
  ['english', 'vocabulary',            'P6', 2, 10],
  ['english', 'comprehension_mc',      'P6', 2, 10],
  ['english', 'comprehension_written', 'P6', 2, 10],

  ['english', 'punctuation',           'P7', 3, 15],
  ['english', 'punctuation',           'P7', 4, 10],
  ['english', 'grammar',               'P7', 3, 15],
  ['english', 'grammar',               'P7', 4, 10],
  ['english', 'spelling',              'P7', 3, 15],
  ['english', 'spelling',              'P7', 4, 10],
  ['english', 'vocabulary',            'P7', 3, 10],
  ['english', 'comprehension_mc',      'P7', 3, 10],
  ['english', 'comprehension_written', 'P7', 3, 10],

  ['maths', 'arithmetic',              'P6', 2, 15],
  ['maths', 'fractions_decimals',      'P6', 2, 15],
  ['maths', 'geometry',                'P6', 2, 15],
  ['maths', 'statistics',              'P6', 2, 10],
  ['maths', 'algebra_sequences',       'P6', 2, 10],
  ['maths', 'measurement',             'P6', 2, 10],

  ['maths', 'arithmetic',              'P7', 3, 15],
  ['maths', 'arithmetic',              'P7', 4, 10],
  ['maths', 'fractions_decimals',      'P7', 3, 15],
  ['maths', 'fractions_decimals',      'P7', 4, 10],
  ['maths', 'geometry',                'P7', 3, 15],
  ['maths', 'geometry',                'P7', 4, 10],
  ['maths', 'statistics',              'P7', 3, 10],
  ['maths', 'algebra_sequences',       'P7', 3, 10],
  ['maths', 'measurement',             'P7', 3, 10],

  // ── Top-up targets (April 2026) ── fill thin topics to ~40 per topic ──────────
  // P7 maths top-ups (diff:5 — new level, starts at 0 existing)
  ['maths', 'arithmetic',              'P7', 5, 15],
  ['maths', 'fractions_decimals',      'P7', 5, 17],
  ['maths', 'geometry',                'P7', 5, 18],
  // P7 english top-ups (diff:5 — new level)
  ['english', 'grammar',               'P7', 5, 17],
  ['english', 'spelling',              'P7', 5, 17],
  // P6 english top-ups (diff:4 — new level)
  ['english', 'grammar',               'P6', 4, 15],
  ['english', 'punctuation',           'P6', 4, 15],
  ['english', 'spelling',              'P6', 4, 16],
  // P6 vocabulary needs largest top-up — split across diff:3 and diff:4
  ['english', 'vocabulary',            'P6', 3, 10],
  ['english', 'vocabulary',            'P6', 4, 10],

  // ── Round 2 top-up (April 2026) — fill to 40 per topic after dedup cleanup ─
  ['english', 'punctuation',           'P6', 5, 25],  // 15→40
  ['english', 'grammar',               'P6', 5,  3],  // 39→40+ (small buffer)
  ['english', 'spelling',              'P6', 5,  3],  // 39→40+
  ['english', 'vocabulary',            'P6', 5,  5],  // 38→40+
  ['english', 'vocabulary',            'P7', 5, 12],  // 29→40+
  ['english', 'spelling',              'P7', 3, 15],  // refill diff:3 (12 exist → +3)
];

// ── Topic guidance ─────────────────────────────────────────────────────────────
const ENGLISH_GUIDE = {
  punctuation: `
PUNCTUATION QUESTION FORMAT:
- passage: the FULL sentence shown at the top of the question, with "/" marks dividing it into 4 sections (e.g. "Its raining heavily / outside today, / so we stayed / indoors.")
- question_text: "Find the section with the punctuation or capital letter mistake. If there are no mistakes, choose N."
- Options A, B, C, D each contain ONLY the text of that one section (no full sentence, no slashes) — e.g. A: "Its raining heavily"  B: "outside today,"  C: "so we stayed"  D: "indoors."
- N: "No mistakes"
- Test ONLY: apostrophe for contraction (wasn't, it's, I'll), possessive apostrophe (dog's, everyone's), missing full stop, missing question mark in speech, capital letter for proper nouns (Paris, Monday, Easter)
- NEVER test comma placement — too ambiguous
- N = No mistakes should be correct ~20% of time
- P6: simple apostrophe/capital errors. P7: speech mark placement, possessive vs contraction distinctions`,

  grammar: `
GRAMMAR QUESTION FORMAT:
- question_text: A COMPLETE SENTENCE WITH A BLANK represented by "___"
- The blank is where the pupil must choose the correct word
- Options A, B, C, D, E are single words or short phrases to fill the blank
- DOMINANT PATTERN: had/have/has + past participle — e.g. "She had ___ the whole cake." → A ate  B eaten  C eat  D eated  E eating → Answer: B (eaten)
- Other patterns: pronoun case (He/Him, I/me), whose/who's, their/there/they're, prepositions (upon/on/in), whether/if, raise/rise
- The blank must make it obvious what grammatical choice is being tested
- P6: simpler grammar (apostrophes in pronouns, basic past tense). P7: had + past participle dominates`,

  spelling: `
SPELLING QUESTION FORMAT:
- question_text: A short passage (2-3 sentences) with four underlined words marked as [A], [B], [C], [D]
- One of the underlined words is misspelled; N = no mistakes (~20% of time)
- Options: A, B, C, D, N
- Test: suffix rules (-ment keeps e: requirement; -ful never doubles l: respectful; -tion: situation), i-before-e (believed, received), double consonants (beginning not openning), homophones (weather/whether, would/wood), commonly misspelled words (tomorrow, excellent, immediately, criminals, vegetarian)
- P6: common everyday words. P7: more complex suffix and rule-based spellings`,

  vocabulary: `
VOCABULARY QUESTION FORMAT:
- question_text: Provide 3-4 sentences of original passage text, then ask: "Find a word in the passage that means [synonym]" OR "What does the word [X] mean in this passage?" OR "What part of speech is the word [X] in line 2?"
- Options A, B, C, D, E are possible answers
- The answer must be findable directly in the provided passage text
- Part of speech: noun=thing, verb=doing word, adjective=describes noun, adverb=describes verb/adjective`,

  comprehension_mc: `
COMPREHENSION MC FORMAT:
- passage: MUST include 6-8 lines of original passage text (fiction or non-fiction) — put the passage here, NOT in question_text
- question_text: ask ONE question about the passage (no passage text here — just the question)
- Options A, B, C, D, E — one clearly correct from the passage
- Ask about: main theme/purpose, character feelings, word meaning in context, literary devices (simile uses like/as, metaphor says IS, alliteration=repeated starting sounds, personification=human traits to non-human)
- The passage must be self-contained and the answer findable within it`,

  comprehension_written: `
COMPREHENSION WRITTEN FORMAT:
- passage: MUST include 6-8 lines of original passage text — put the passage here, NOT in question_text
- question_text: ask ONE written-answer question about the passage (no passage text here — just the question)
- options: null (written answer, no choices)
- correct_answer: the exact word/phrase from the passage
- Question types: "Find a word in line X that means [synonym]", "Copy the simile from the passage", "What part of speech is [word]?", "Find a compound word in the passage"
- The answer must be directly findable in the provided passage text`,
};

const MATHS_GUIDE = {
  arithmetic: `
ARITHMETIC FORMAT:
- question_text: A clear maths question or word problem
- Options A, B, C, D, E — five distinct numerical answers, one correct
- P6: operations up to 10,000, money, one or two steps, basic multiplication
- P7: long multiplication (3-digit × 2-digit), multi-step word problems, function machines with two operations
- VERIFY all arithmetic is correct before including`,

  fractions_decimals: `
FRACTIONS/DECIMALS FORMAT:
- question_text: A clear question about fractions, decimals, or percentages
- Options A, B, C, D, E — five distinct answers, one correct
- P6: equivalent fractions, fractions of amounts (3/4 of 16), ordering decimals, simple percentages (25%, 50%)
- P7: complex equivalence, multi-step percentage problems, converting between forms
- VERIFY all calculations are correct`,

  geometry: `
GEOMETRY FORMAT:
- question_text: A clear geometry question (angles, shapes, coordinates, area, perimeter, volume)
- Options A, B, C, D, E — five distinct answers, one correct
- P6: basic angle facts (straight line=180°, triangle=180°), area of rectangles, simple shapes, coordinates
- P7: compound areas, 3D shapes (faces/edges/vertices), reflex angles, volume=l×w×h, nets
- VERIFY all geometry facts and calculations are correct`,

  statistics: `
STATISTICS FORMAT:
- question_text: A question with data provided (describe a bar chart, pictogram, or list of numbers in the question itself — no images needed)
- Options A, B, C, D, E — five distinct answers, one correct
- Include the actual data values in the question text so it is self-contained
- P6: reading simple charts, basic mean, probability language (certain/likely/unlikely/impossible)
- P7: multi-step interpretation, calculating mean/range, pictogram symbol values`,

  algebra_sequences: `
ALGEBRA/SEQUENCES FORMAT:
- question_text: A clear sequence or algebra question
- Options A, B, C, D, E — five distinct answers, one correct
- P6: simple +n or ×n sequences, square numbers, find next term
- P7: triangular numbers (1,3,6,10,15...), cube numbers (1,8,27,64,125...), two-operation function machines, nth term patterns
- VERIFY the sequence rule and answer are correct`,

  measurement: `
MEASUREMENT FORMAT:
- question_text: A clear measurement/conversion/time question
- Options A, B, C, D, E — five distinct answers, one correct
- P6: straightforward unit conversions (kg to g, m to cm), simple time intervals, reading scales
- P7: multi-step time problems (24-hour clock, timetables), map scales, complex scale reading
- VERIFY all conversions and time calculations are correct`,
};

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(subject, topic, yearGroup, difficulty, count) {
  const diffLabel = { 1:'very easy', 2:'easy', 3:'moderate', 4:'challenging', 5:'very hard' }[difficulty];
  const level = yearGroup === 'P6'
    ? 'P6 Warm-Up level — slightly easier SEAG prep for 10-year-olds'
    : 'P7 Main Series — full SEAG exam standard for 11-year-olds';

  const guide = subject === 'english' ? ENGLISH_GUIDE[topic] : MATHS_GUIDE[topic];

  // Topic-specific JSON examples
  const examples = {
    punctuation: `[
  {
    "passage": "Its raining heavily / outside today, / so we stayed / indoors.",
    "question_text": "Find the section with the punctuation or capital letter mistake. If there are no mistakes, choose N.",
    "question_type": "mc",
    "options": {
      "A": "Its raining heavily",
      "B": "outside today,",
      "C": "so we stayed",
      "D": "indoors.",
      "N": "No mistakes"
    },
    "correct_answer": "A",
    "explanation": "Its should be It's — a contraction of 'it is'. The apostrophe replaces the missing letter i."
  }
]`,

    grammar: `[
  {
    "question_text": "By the time we arrived at the theatre, the play had already ___.",
    "question_type": "mc",
    "options": {
      "A": "begin",
      "B": "began",
      "C": "begun",
      "D": "beginned",
      "E": "beginning"
    },
    "correct_answer": "C",
    "explanation": "Had + past participle: had begun is correct. The simple past (began) cannot follow had."
  }
]`,

    spelling: `[
  {
    "question_text": "Read the passage below. One of the underlined words is spelled incorrectly. Choose the letter of the misspelled word, or N if there are no mistakes.\\n\\nThe [A]scientists made an [B]remarkable discovery when they found [C]ancient fossils buried deep [D]beneath the rock.",
    "question_type": "mc",
    "options": {
      "A": "scientists",
      "B": "remarkable",
      "C": "ancient",
      "D": "beneath",
      "N": "No mistakes"
    },
    "correct_answer": "N",
    "explanation": "All four words are spelled correctly. Remarkable, ancient and beneath are commonly misspelled but are correct here."
  }
]`,

    vocabulary: `[
  {
    "question_text": "Read the passage below, then answer the question.\\n\\nThe old lighthouse stood at the edge of the cliff, its beam cutting through the dense fog. Every night, the keeper would climb the narrow staircase to ensure the light was working. Without it, ships would have no way to navigate the treacherous rocks below.\\n\\nFind a word in the passage that means 'dangerous'.",
    "question_type": "mc",
    "options": {
      "A": "dense",
      "B": "narrow",
      "C": "treacherous",
      "D": "navigate",
      "E": "ensure"
    },
    "correct_answer": "C",
    "explanation": "Treacherous means dangerous or hazardous. It describes the rocks that could damage ships."
  }
]`,

    comprehension_mc: `[
  {
    "passage": "The Arctic tern makes the longest migration of any creature on Earth. Each year, it travels from the Arctic to the Antarctic and back again — a round trip of nearly 90,000 kilometres. This remarkable bird experiences more daylight than any other animal, spending summer in both polar regions. Despite weighing less than 125 grams, the Arctic tern is built for endurance, with long, narrow wings that slice through the air with minimal effort.",
    "question_text": "What is the main purpose of this passage?",
    "question_type": "mc",
    "options": {
      "A": "To explain why Arctic terns are endangered",
      "B": "To describe the extraordinary migration of the Arctic tern",
      "C": "To compare the Arctic tern with other migrating birds",
      "D": "To argue that Arctic terns should be protected",
      "E": "To explain how birds navigate long distances"
    },
    "correct_answer": "B",
    "explanation": "The passage focuses entirely on describing the Arctic tern's remarkable migration journey and its physical adaptations."
  }
]`,

    comprehension_written: `[
  {
    "passage": "The old lighthouse stood at the edge of the cliff, its beam cutting through the dense fog like a silver sword. Every night, the keeper would trudge up the narrow staircase to ensure the light was working. Without it, ships would have no way to navigate the treacherous rocks below. The keeper had tended the light for thirty years, and the sea had become his oldest companion.",
    "question_text": "Find a simile in the passage and copy it exactly.",
    "question_type": "written",
    "options": null,
    "correct_answer": "like a silver sword",
    "explanation": "A simile compares two things using like or as. The beam is compared to a silver sword using the word like."
  }
]`,

    arithmetic: `[
  {
    "question_text": "A school orders 24 boxes of pencils. Each box contains 36 pencils. How many pencils are there altogether?",
    "question_type": "mc",
    "options": {
      "A": "764",
      "B": "824",
      "C": "864",
      "D": "884",
      "E": "924"
    },
    "correct_answer": "C",
    "explanation": "24 × 36 = 864. Multiply 24 × 30 = 720, then 24 × 6 = 144. Add: 720 + 144 = 864."
  }
]`,

    fractions_decimals: `[
  {
    "question_text": "What is 3/8 of 64?",
    "question_type": "mc",
    "options": {
      "A": "18",
      "B": "20",
      "C": "24",
      "D": "28",
      "E": "32"
    },
    "correct_answer": "C",
    "explanation": "Divide by 8 first: 64 ÷ 8 = 8. Then multiply by 3: 8 × 3 = 24."
  }
]`,

    geometry: `[
  {
    "question_text": "In a triangle, two angles measure 47° and 86°. What is the size of the third angle?",
    "question_type": "mc",
    "options": {
      "A": "37°",
      "B": "43°",
      "C": "47°",
      "D": "53°",
      "E": "57°"
    },
    "correct_answer": "C",
    "explanation": "Angles in a triangle add up to 180°. 47 + 86 = 133. 180 − 133 = 47°."
  }
]`,

    statistics: `[
  {
    "question_text": "Five pupils scored these marks in a spelling test: 14, 18, 12, 20, 16. What is their mean score?",
    "question_type": "mc",
    "options": {
      "A": "14",
      "B": "15",
      "C": "16",
      "D": "17",
      "E": "18"
    },
    "correct_answer": "C",
    "explanation": "Add all scores: 14 + 18 + 12 + 20 + 16 = 80. Divide by 5: 80 ÷ 5 = 16."
  }
]`,

    algebra_sequences: `[
  {
    "question_text": "What is the next number in this sequence? 3, 6, 10, 15, 21, ___",
    "question_type": "mc",
    "options": {
      "A": "25",
      "B": "26",
      "C": "27",
      "D": "28",
      "E": "29"
    },
    "correct_answer": "D",
    "explanation": "These are triangular numbers. The differences increase by 1 each time: +3, +4, +5, +6, +7. So 21 + 7 = 28."
  }
]`,

    measurement: `[
  {
    "question_text": "A film starts at 14:35 and lasts 1 hour 55 minutes. What time does it end?",
    "question_type": "mc",
    "options": {
      "A": "16:20",
      "B": "16:25",
      "C": "16:30",
      "D": "16:35",
      "E": "16:40"
    },
    "correct_answer": "C",
    "explanation": "Add 1 hour to 14:35 → 15:35. Add 55 minutes: 15:35 + 55 = 16:30."
  }
]`,
  };

  const exampleJson = examples[topic] || examples.arithmetic;
  const isWritten = subject === 'english' && topic === 'comprehension_written';
  const isPunctSpell = subject === 'english' && (topic === 'punctuation' || topic === 'spelling');
  const formatNote = isPunctSpell
    ? 'Multiple choice: options A, B, C, D, N (N = No mistakes)'
    : isWritten
    ? 'Written answer: options is null, correct_answer is the exact expected answer string'
    : 'Multiple choice: options A, B, C, D, E';

  const topicExtra = isPunctSpell
    ? `\nCRITICAL: Every question MUST use a completely different, original sentence. Never reuse any sentence, name, or scenario from another question in this batch or any previous batch. Each sentence must feature different characters, places and situations.\n`
    : '';

  return `You are generating ${count} original SEAG Transfer Test questions for STAR AI Tutor (Northern Ireland, P6/P7 pupils aged 10-11).

YEAR GROUP: ${level}
SUBJECT: ${subject.toUpperCase()}
TOPIC: ${topic}
DIFFICULTY: ${diffLabel} (${difficulty}/5)
FORMAT: ${formatNote}

${guide}

CRITICAL RULES:
1. All questions must be 100% original — never copy from any published source
2. P6: simpler vocabulary, smaller numbers, shorter sentences
3. P7: full exam difficulty, harder calculations, more complex language
4. Explanations: 2 lines MAX — brief and parent-friendly
5. Grammar questions MUST have a sentence with a ___ blank in question_text
6. Comprehension questions MUST put the passage in the "passage" field, NOT in question_text
7. Maths questions MUST have 5 options (A,B,C,D,E) with verified correct arithmetic
8. Punctuation/spelling questions use options A,B,C,D,N
${topicExtra}
Before responding, check that all your questions are completely distinct from each other — different sentences, different scenarios, different vocabulary. Remove any that are too similar and replace with unique alternatives.

Here is an example of the EXACT JSON format required:
${exampleJson}

IMPORTANT: Respond with ONLY a valid JSON array of ${count} questions. No markdown, no backticks, no explanation — just the JSON array starting with [ and ending with ].

Generate ${count} questions for: ${subject} / ${topic} / ${yearGroup} / difficulty ${difficulty}`;
}

// ── Diagram attachment ────────────────────────────────────────────────────────

// Extract all measurements (e.g. "8 cm", "3.5 m", "12mm") from text in order.
// Returns array of formatted strings like "8 cm", or empty string for missing slots.
function extractMeasurements(text, count) {
  const pat = /(\d+(?:\.\d+)?)\s*(cm|m|mm|km)/g;
  const found = [];
  let m;
  while ((m = pat.exec(text)) !== null && found.length < count) {
    found.push(`${m[1]} ${m[2]}`);
  }
  // Pad to requested count with empty strings
  while (found.length < count) found.push('');
  return found;
}

// Extract degree values (e.g. "70°", "60 degrees") from text in order.
// Returns array of formatted strings like "70°", or empty string for missing slots.
function extractAngles(text, count) {
  const pat = /(\d+(?:\.\d+)?)\s*(?:°|degrees?)/g;
  const found = [];
  let m;
  while ((m = pat.exec(text)) !== null && found.length < count) {
    found.push(`${m[1]}°`);
  }
  while (found.length < count) found.push('');
  return found;
}

function attachDiagram(q) {
  const text = ((q.question_text || '') + ' ' + (q.topic || '')).toLowerCase();

  if (/right[- ]angled/.test(text) && /triangle/.test(text)) {
    const [sideA, sideB, sideC] = extractMeasurements(text, 3);
    const [, angleB, angleC] = extractAngles(text, 3); // skip [0]: right angle vertex
    return generateDiagram('triangle', { subtype: 'right-angled', sideA, sideB, sideC, angleB, angleC, unknownAngle: /\ba°|unknown/.test(text) });
  }
  if (/equilateral/.test(text) && /triangle/.test(text)) {
    const [sideA] = extractMeasurements(text, 1);
    return generateDiagram('triangle', { subtype: 'equilateral', sideA, sideB: sideA, sideC: sideA });
  }
  if (/isosceles/.test(text) && /triangle/.test(text)) {
    const [sideA, sideB] = extractMeasurements(text, 2);
    const [angleA, angleB, angleC] = extractAngles(text, 3);
    return generateDiagram('triangle', { subtype: 'isosceles', sideA, sideB, sideC: sideB, angleA, angleB, angleC });
  }
  if (/\btriangle\b/.test(text)) {
    const [sideA, sideB, sideC] = extractMeasurements(text, 3);
    const [angleA, angleB, angleC] = extractAngles(text, 3);
    return generateDiagram('triangle', { subtype: 'scalene', sideA, sideB, sideC, angleA, angleB, angleC, unknownAngle: /\ba°|unknown/.test(text) });
  }

  if (/\bsquare\b/.test(text) && !/square number/.test(text)) {
    const [width] = extractMeasurements(text, 1);
    return generateDiagram('shape', { subtype: 'square', width });
  }
  if (/\brectangle\b/.test(text)) {
    const [width, height] = extractMeasurements(text, 2);
    return generateDiagram('shape', { subtype: 'rectangle', width, height });
  }
  if (/\bhexagon\b/.test(text)) {
    return generateDiagram('shape', { subtype: 'hexagon' });
  }
  if (/\bpentagon\b/.test(text)) {
    return generateDiagram('shape', { subtype: 'pentagon' });
  }
  if (/\boctagon\b/.test(text)) {
    return generateDiagram('shape', { subtype: 'octagon' });
  }
  if (/\bparallelogram\b/.test(text)) {
    const [width, height] = extractMeasurements(text, 2);
    return generateDiagram('shape', { subtype: 'parallelogram', width, height });
  }
  if (/\brhombus\b/.test(text)) {
    return generateDiagram('shape', { subtype: 'rhombus' });
  }
  if (/\btrapezium\b/.test(text)) {
    // diagram-generator only labels the top edge (width) for trapezium
    const [width] = extractMeasurements(text, 1);
    return generateDiagram('shape', { subtype: 'trapezium', width });
  }

  if (/\bangle\b|\bdegrees?\b|\bprotractor\b/.test(text))
    return generateDiagram('angle', { unknown: /unknown|a°|find/.test(text) });

  if (/\bnet\b|\bunfold/.test(text))
    return generateDiagram('net', {});

  if (/shaded|fraction.*grid|grid.*fraction/.test(text))
    return generateDiagram('fraction-grid', {});

  if (/bar chart|bar graph|\bfrequency\b/.test(text))
    return generateDiagram('bar-chart', {});

  if (/line graph/.test(text))
    return generateDiagram('line-graph', {});

  if (/\bcoordinates?\b|\bplotted\b|\b(?:on a|using a|the)\s+grid\b/.test(text) && !/fraction.*grid|grid.*fraction|shaded/.test(text)) {
    const ptPat = /\(\s*(\d+)\s*,\s*(\d+)\s*\)/g;
    const pts = [];
    let ptm;
    while ((ptm = ptPat.exec(text)) !== null) {
      const px = parseInt(ptm[1]), py = parseInt(ptm[2]);
      if (px >= 0 && px <= 10 && py >= 0 && py <= 10) pts.push({ x: px, y: py });
    }
    return generateDiagram('coordinate-grid', { points: pts });
  }

  if (/\bpictogram\b/.test(text)) {
    // Try to extract key value (e.g. "each symbol = 2", "key: ● = 4")
    const keyMatch = text.match(/(?:key|symbol|each\s+(?:symbol|picture|icon|star|image))[^=:\d]*[=:]\s*(\d+)/i)
                  || text.match(/represents?\s+(\d+)/i)
                  || text.match(/worth\s+(\d+)/i);
    const keyValue = keyMatch ? (parseInt(keyMatch[1]) || 1) : 1;

    // Extract label: count pairs — try "Label: N" / "Label = N" patterns
    const data = [];
    const dpat = /([A-Z][a-zA-Z ]{1,20}?)\s*[:=]\s*(\d+)(?:\s*(?:symbol|book|pet|pupil|child|student|vote|point)s?)?/g;
    let dm;
    while ((dm = dpat.exec(text)) !== null) {
      const label = dm[1].trim();
      if (['key', 'answer', 'note'].includes(label.toLowerCase())) continue;
      const count = parseInt(dm[2]);
      if (count >= 0 && count <= 20 && data.length < 8) data.push({ label, count });
    }

    if (data.length >= 2) return generateDiagram('pictogram', { data, keyValue });
    return null;  // can't extract reliably — show no diagram rather than wrong one
  }

  if (/number line|missing number/.test(text))
    return generateDiagram('number-line', {});

  if (/\bruler\b|\bthermometer\b|\bweighs?\b|\bweighing\b/.test(text))
    return generateDiagram('measurement-scale', { type: /therm/.test(text) ? 'thermometer' : /weigh/.test(text) ? 'weighing-dial' : 'ruler' });

  // cuboid: must come before generic 3D shape checks
  if (/\bcuboid\b|\brectangular prism\b/.test(text)) {
    const [width, height, depth] = extractMeasurements(text, 3);
    return generateDiagram('cuboid', { width, height, depth });
  }

  // pie chart: try to extract up to 5 label/value pairs
  if (/pie chart|pie graph/.test(text)) {
    const data = [];
    // Match "Label: N%" or "Label N%" or "Label: N" patterns
    const pctPat = /([A-Za-z][a-zA-Z ]{1,20}?)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/g;
    let pm;
    while ((pm = pctPat.exec(text)) !== null && data.length < 5) {
      const label = pm[1].trim();
      if (['key', 'answer', 'note', 'total'].includes(label.toLowerCase())) continue;
      data.push({ label, value: parseFloat(pm[2]) });
    }
    // Fall back to plain "Label: N" pairs if no percentages found
    if (data.length < 2) {
      const valPat = /([A-Z][a-zA-Z ]{1,20}?)\s*[:=]\s*(\d+)/g;
      let vm;
      while ((vm = valPat.exec(text)) !== null && data.length < 5) {
        const label = vm[1].trim();
        if (['key', 'answer', 'note', 'total'].includes(label.toLowerCase())) continue;
        data.push({ label, value: parseInt(vm[2]) });
      }
    }
    if (data.length >= 2) return generateDiagram('pie-chart', { data });
    // No data extracted — render a generic 4-segment placeholder
    return generateDiagram('pie-chart', {
      data: [
        { label: 'A', value: 35 },
        { label: 'B', value: 25 },
        { label: 'C', value: 22 },
        { label: 'D', value: 18 },
      ],
    });
  }

  return null;
}

// ── Insert ─────────────────────────────────────────────────────────────────────
async function insertQuestions(questions, subject, topic, yearGroup, difficulty, passageId = null) {
  const rows = questions.map(q => ({
    subject,
    topic,      // always from TARGETS — never from generated JSON
    year_group: yearGroup,
    difficulty,
    question_type: q.question_type || (q.options ? 'mc' : 'written'),
    question_text: q.question_text,
    passage: q.passage || null,
    passage_id: passageId,
    options: q.options || null,
    correct_answer: String(q.correct_answer),
    explanation: q.explanation || null,
    diagram: attachDiagram(q),
    validated: false,
    source: 'ai_generated_v3',
  }));

  // Validate before inserting
  const valid = rows.filter(r => r.question_text && r.question_text.trim().length > 10);
  if (valid.length < rows.length) {
    console.warn(`   ⚠️  Skipped ${rows.length - valid.length} questions with empty question_text`);
  }
  if (valid.length === 0) throw new Error('All questions had empty question_text — skipping batch');

  const { error, data } = await supabase.from('questions').insert(valid).select('id');
  if (error) throw new Error(`Supabase insert error: ${error.message}`);
  return data.length;
}

// ── Passage-group prompt ───────────────────────────────────────────────────────
function buildPassageGroupPrompt(yearGroup, difficulty) {
  const diffLabel = { 1:'very easy', 2:'easy', 3:'moderate', 4:'challenging', 5:'very hard' }[difficulty];
  const level = yearGroup === 'P6'
    ? 'P6 Warm-Up level — slightly easier SEAG prep for 10-year-olds'
    : 'P7 Main Series — full SEAG exam standard for 11-year-olds';

  return `You are generating one original reading passage and two questions about it for the SEAG Transfer Test (Northern Ireland, P6/P7 pupils aged 10-11).

YEAR GROUP: ${level}
DIFFICULTY: ${diffLabel} (${difficulty}/5)

PASSAGE: Write an original 6-8 sentence passage (fiction or non-fiction).
Topics: nature, science, history, sport, adventure, biography, everyday life.
No copyright material. UK English spelling only.

MC QUESTION (comprehension_mc):
- question_text: ONE question about the passage — theme/purpose, word meaning in context, or literary device (simile uses like/as, metaphor says IS, alliteration=same starting letter, personification=human trait to non-human)
- options: A, B, C, D, E — one clearly correct from the passage, others plausible
- correct_answer: one of A/B/C/D/E

WRITTEN QUESTION (comprehension_written):
- question_text: "Find a word in the passage that means [synonym]", OR "Copy the simile from the passage", OR "What part of speech is the word [X]?", OR "Find a compound word in the passage"
- options: null
- correct_answer: the EXACT word or short phrase copied directly from the passage

RULES:
1. The passage MUST contain a simile (using like/as) OR a strong vocabulary word — so the written question is answerable
2. P6: simpler vocabulary, shorter sentences. P7: more complex language, richer vocabulary
3. Explanations: 2 lines MAX, parent-friendly
4. The correct_answer for the written question must appear verbatim in the passage content

CRITICAL: Every question must reference specific content from THIS passage only — specific names, places, events, or direct quotes from the text. Never generate generic questions like 'What is the main purpose of this passage?' or 'Copy a simile from the passage' that could apply to any passage.

Before responding, check that all your questions are completely distinct from each other — different sentences, different scenarios, different vocabulary. Remove any that are too similar and replace with unique alternatives.

Respond with ONLY this JSON object (no markdown fences, no backticks):
{
  "title": "Short 3-5 word title",
  "content": "Full passage text here...",
  "mc_question": {
    "question_text": "...",
    "question_type": "mc",
    "options": {"A":"...", "B":"...", "C":"...", "D":"...", "E":"..."},
    "correct_answer": "B",
    "explanation": "..."
  },
  "written_question": {
    "question_text": "...",
    "question_type": "written",
    "options": null,
    "correct_answer": "exact word or phrase from passage",
    "explanation": "..."
  }
}`;
}

// ── Generate one passage group (passage + MC + written) ────────────────────────
async function generatePassageGroup(yearGroup, difficulty) {
  const prompt = buildPassageGroupPrompt(yearGroup, difficulty);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();

  let group;
  try {
    group = JSON.parse(clean);
  } catch(e) {
    throw new Error(`Passage group JSON parse failed: ${e.message} — raw: ${raw.substring(0, 200)}`);
  }

  if (!group.title || !group.content || !group.mc_question || !group.written_question) {
    throw new Error('Passage group missing required fields (title/content/mc_question/written_question)');
  }
  return group;
}

// ── Count passages ─────────────────────────────────────────────────────────────
async function countPassages(yearGroup, difficulty) {
  const { count, error } = await supabase
    .from('passages')
    .select('id', { count: 'exact', head: true })
    .eq('year_group', yearGroup)
    .eq('difficulty', difficulty)
    .eq('source', 'ai_generated_v3');
  if (error) throw new Error(`Passage count failed: ${error.message}`);
  return count || 0;
}

// ── Seed comprehension passage-aware ──────────────────────────────────────────
async function seedComprehension(yearGroup, difficulty, mcTarget, writtenTarget) {
  const label = `${yearGroup} comprehension diff:${difficulty}`;

  // Remove legacy comprehension questions that have no passage_id (they were generated independently)
  const { error: delErr } = await supabase
    .from('questions')
    .delete()
    .eq('subject', 'english')
    .in('topic', ['comprehension_mc', 'comprehension_written'])
    .eq('year_group', yearGroup)
    .eq('difficulty', difficulty)
    .eq('source', 'ai_generated_v3')
    .is('passage_id', null);
  if (delErr) throw new Error(`Failed to remove legacy comprehension: ${delErr.message}`);

  const existingPassages = await countPassages(yearGroup, difficulty);
  const passagesNeeded = Math.max(0, Math.max(mcTarget, writtenTarget, 10) - existingPassages);

  if (passagesNeeded === 0) {
    console.log(`\n✓  ${label} — already has ${existingPassages} passages, skipping`);
    return { inserted: 0, skipped: 1, errors: 0 };
  }

  console.log(`\n📖 ${label} — generating ${passagesNeeded} passages (${passagesNeeded} MC + ${passagesNeeded} written)`);

  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < passagesNeeded; i++) {
    process.stdout.write(`   Passage ${i+1}/${passagesNeeded}... `);
    try {
      const group = await generatePassageGroup(yearGroup, difficulty);

      // Insert passage record
      const { data: passageRow, error: pErr } = await supabase
        .from('passages')
        .insert({
          title: group.title,
          content: group.content,
          year_group: yearGroup,
          difficulty,
          source: 'ai_generated_v3',
        })
        .select('id')
        .single();
      if (pErr) throw new Error(`Passage insert failed: ${pErr.message}`);
      const passageId = passageRow.id;

      // Insert MC question
      const mcQ = { ...group.mc_question, passage: group.content };
      await insertQuestions([mcQ], 'english', 'comprehension_mc', yearGroup, difficulty, passageId);

      // Insert written question
      const wrQ = { ...group.written_question, passage: group.content };
      await insertQuestions([wrQ], 'english', 'comprehension_written', yearGroup, difficulty, passageId);

      inserted += 2;
      console.log(`✅ passage ${passageId.substring(0,8)}… inserted`);
    } catch(err) {
      errors++;
      console.log(`❌ ${err.message}`);
    }

    if (i < passagesNeeded - 1) await sleep(DELAY_MS);
  }

  const totalPassages = (await countPassages(yearGroup, difficulty));
  console.log(`   → ${totalPassages} passages, ~${totalPassages} MC + ~${totalPassages} written for ${label}`);
  return { inserted, skipped: 0, errors };
}

// ── Per-passage question targets ───────────────────────────────────────────────
const MC_PER_PASSAGE      = 7;
const WRITTEN_PER_PASSAGE = 6;

// ── Raw Claude call returning a parsed JSON array ──────────────────────────────
async function callClaude(prompt, maxTokens = 4000) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const raw   = response.content[0].text.trim();
  const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch(e) {
    throw new Error(`JSON parse failed: ${e.message} — raw: ${raw.substring(0, 300)}`);
  }
  if (!Array.isArray(parsed)) throw new Error('Response was not a JSON array');
  return parsed;
}

// ── Top-up prompt builder ──────────────────────────────────────────────────────
function buildTopUpPrompt(passageContent, yearGroup, difficulty, questionType, count, existingQTexts) {
  const diffLabel = { 1:'very easy', 2:'easy', 3:'moderate', 4:'challenging', 5:'very hard' }[difficulty];
  const level = yearGroup === 'P6'
    ? 'P6 Warm-Up level (10-year-olds)'
    : 'P7 Main Series — full SEAG exam standard (11-year-olds)';

  const alreadyAsked = existingQTexts.length
    ? `\nALREADY ASKED FOR THIS PASSAGE — do NOT repeat or overlap:\n${existingQTexts.map((q,i) => `${i+1}. ${q}`).join('\n')}\n`
    : '';

  if (questionType === 'mc') {
    return `Generate ${count} multiple-choice comprehension questions for this SEAG reading passage (${level}, difficulty: ${diffLabel}).

PASSAGE:
"${passageContent}"
${alreadyAsked}
Each question must test a DIFFERENT aspect. Use varied types across the set:
- Word meaning in context: "What does the word [X] mean/suggest in this passage?"
- Inference: "What do we learn about [subject] from this passage?"
- Literary device: "What technique is used in the phrase '[quote from passage]'?"
- Character/author attitude: "How does [character/author] feel about [X]?"
- Main theme or purpose: "What is the main purpose of this passage?"

Rules:
- question_text: the question only — no passage text, no 'Read the passage' instruction
- options A–E: one clearly correct answer from the passage; other four plausible but wrong
- correct_answer: one of A/B/C/D/E
- explanation: 2 lines MAX, UK English spelling

CRITICAL: Every question must reference specific content from THIS passage only — specific names, places, events, or direct quotes from the text. Never generate generic questions like 'What is the main purpose of this passage?' that could apply to any passage.

Before responding, check that all your questions are completely distinct from each other — different aspects of the passage, different vocabulary. Remove any that are too similar and replace with unique alternatives.

Respond with ONLY a valid JSON array of ${count} objects — no markdown, no backticks:
[{"question_text":"...","question_type":"mc","options":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"correct_answer":"B","explanation":"..."}]`;
  }

  return `Generate ${count} written-answer comprehension questions for this SEAG reading passage (${level}, difficulty: ${diffLabel}).

PASSAGE:
"${passageContent}"
${alreadyAsked}
Each answer MUST be a word or short phrase copied VERBATIM from the passage above.
Use varied question types across the set:
- Vocabulary: "Find a word in the passage that means [synonym]." (answer = exact word from passage)
- Literary device: "Copy the [simile / metaphor / alliteration / personification] from the passage." (answer = exact quote)
- Word class: "What part of speech is the word [X]?" (answer = noun / verb / adjective / adverb)
- Compound word: "Find a compound word in the passage." (answer = the compound word)
- Evidence phrase: "Copy a phrase from the passage that shows [X]." (answer = exact short quote)

Rules:
- question_text: the question only — no passage text, no 'Read the passage' instruction
- options: null
- correct_answer: the EXACT word or phrase — it must appear verbatim in the passage text above
- explanation: 2 lines MAX, UK English spelling

CRITICAL: Every question must reference specific content from THIS passage only — specific words, quotes, or details from the text. Never generate generic questions like 'Copy a simile from the passage' or 'Find a compound word in the passage' that could apply to any passage without referencing this one specifically.

Before responding, check that all your questions are completely distinct from each other — different aspects of the passage, different vocabulary. Remove any that are too similar and replace with unique alternatives.

Respond with ONLY a valid JSON array of ${count} objects — no markdown, no backticks:
[{"question_text":"...","question_type":"written","options":null,"correct_answer":"exact phrase","explanation":"..."}]`;
}

// ── Top up every passage to MC_PER_PASSAGE MC + WRITTEN_PER_PASSAGE written ────
async function topUpPassages() {
  const { data: passages, error } = await supabase
    .from('passages')
    .select('id, title, content, year_group, difficulty')
    .eq('source', 'ai_generated_v3')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Failed to fetch passages: ${error.message}`);

  console.log(`\n\n── Passage top-up (target: ${MC_PER_PASSAGE} MC + ${WRITTEN_PER_PASSAGE} written per passage) ──`);
  console.log(`   ${passages.length} passages found`);

  let totalInserted = 0;
  let totalErrors   = 0;

  for (let pi = 0; pi < passages.length; pi++) {
    const p = passages[pi];

    const { data: existing, error: qErr } = await supabase
      .from('questions')
      .select('topic, question_text')
      .eq('passage_id', p.id)
      .eq('source', 'ai_generated_v3');
    if (qErr) throw new Error(`Failed to fetch questions for passage ${p.id}: ${qErr.message}`);

    const existingMC      = (existing||[]).filter(q => q.topic === 'comprehension_mc');
    const existingWritten = (existing||[]).filter(q => q.topic === 'comprehension_written');
    const neededMC        = Math.max(0, MC_PER_PASSAGE      - existingMC.length);
    const neededWritten   = Math.max(0, WRITTEN_PER_PASSAGE - existingWritten.length);

    if (neededMC === 0 && neededWritten === 0) {
      console.log(`\n✓  [${pi+1}/${passages.length}] "${p.title}" — already complete`);
      continue;
    }

    console.log(`\n📄 [${pi+1}/${passages.length}] "${p.title}" (${p.year_group} diff:${p.difficulty}) — need +${neededMC} MC, +${neededWritten} written`);

    if (neededMC > 0) {
      process.stdout.write(`   Generating ${neededMC} MC... `);
      try {
        const prompt    = buildTopUpPrompt(p.content, p.year_group, p.difficulty, 'mc', neededMC, existingMC.map(q => q.question_text));
        const questions = await callClaude(prompt, 3000);
        const tagged    = questions.map(q => ({ ...q, passage: p.content }));
        const n         = await insertQuestions(tagged, 'english', 'comprehension_mc', p.year_group, p.difficulty, p.id);
        totalInserted  += n;
        console.log(`✅ ${n} inserted`);
      } catch(err) {
        totalErrors++;
        console.log(`❌ ${err.message}`);
      }
      await sleep(DELAY_MS);
    }

    if (neededWritten > 0) {
      process.stdout.write(`   Generating ${neededWritten} written... `);
      try {
        const prompt    = buildTopUpPrompt(p.content, p.year_group, p.difficulty, 'written', neededWritten, existingWritten.map(q => q.question_text));
        const questions = await callClaude(prompt, 2000);
        const tagged    = questions.map(q => ({ ...q, passage: p.content }));
        const n         = await insertQuestions(tagged, 'english', 'comprehension_written', p.year_group, p.difficulty, p.id);
        totalInserted  += n;
        console.log(`✅ ${n} inserted`);
      } catch(err) {
        totalErrors++;
        console.log(`❌ ${err.message}`);
      }
      if (pi < passages.length - 1) await sleep(DELAY_MS);
    }
  }

  console.log(`\n   Top-up complete — inserted: ${totalInserted}  errors: ${totalErrors}`);
  return { inserted: totalInserted, errors: totalErrors };
}

// ── Generate batch ─────────────────────────────────────────────────────────────
async function generateBatch(subject, topic, yearGroup, difficulty, count) {
  const prompt = buildPrompt(subject, topic, yearGroup, difficulty, count);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  const clean = raw.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();

  let questions;
  try {
    questions = JSON.parse(clean);
  } catch(e) {
    console.error('JSON parse failed:', raw.substring(0, 300));
    throw new Error(`JSON parse failed: ${e.message}`);
  }

  if (!Array.isArray(questions)) throw new Error('Response was not a JSON array');
  return questions;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Count existing ────────────────────────────────────────────────────────────
async function countExisting(subject, topic, yearGroup, difficulty) {
  const { count, error } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('subject', subject)
    .eq('topic', topic)
    .eq('year_group', yearGroup)
    .eq('difficulty', difficulty)
    .eq('source', 'ai_generated_v3');
  if (error) throw new Error(`Count query failed: ${error.message}`);
  return count || 0;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 STAR AI Tutor — Question Bank Generator v3');
  console.log('=============================================');

  let totalInserted = 0;
  let totalSkipped  = 0;
  let totalErrors   = 0;

  for (const [subject, topic, yearGroup, difficulty, target] of TARGETS.slice(TARGET_FROM, TARGET_FROM + TARGET_LIMIT)) {

    // Comprehension topics are handled passage-aware below — skip here
    if (topic === 'comprehension_mc' || topic === 'comprehension_written') continue;

    const existing = await countExisting(subject, topic, yearGroup, difficulty);
    const needed   = Math.max(0, target - existing);

    if (needed === 0) {
      console.log(`\n✓  ${yearGroup} ${subject}/${topic} diff:${difficulty} — already at ${existing}/${target}, skipping`);
      totalSkipped++;
      continue;
    }

    const batches = Math.ceil(needed / BATCH_SIZE);
    console.log(`\n📝 ${yearGroup} ${subject}/${topic} diff:${difficulty} — need ${needed} more (have ${existing}/${target}) — ${batches} batch${batches>1?'es':''}`);

    let inserted  = 0;
    let remaining = needed;

    for (let b = 0; b < batches; b++) {
      const batchCount = Math.min(BATCH_SIZE, remaining);
      process.stdout.write(`   Batch ${b+1}/${batches} (${batchCount})... `);

      try {
        const questions = await generateBatch(subject, topic, yearGroup, difficulty, batchCount);
        const n = await insertQuestions(questions, subject, topic, yearGroup, difficulty);
        inserted  += n;
        remaining -= batchCount;
        totalInserted += n;
        console.log(`✅ ${n} inserted`);
      } catch(err) {
        totalErrors++;
        console.log(`❌ ${err.message}`);
      }

      if (b < batches - 1) await sleep(DELAY_MS);
    }

    console.log(`   → ${existing + inserted}/${target} for this target`);
  }

  // ── Comprehension: passage-aware seeding ──────────────────────────────────────
  // Paired targets: each year group gets min 10 passages, each yielding 1 MC + 1 written
  const COMPREHENSION_SETS = [
    { yearGroup: 'P6', difficulty: 2, mcTarget: 10, writtenTarget: 10 },
    { yearGroup: 'P7', difficulty: 3, mcTarget: 10, writtenTarget: 10 },
  ];

  console.log('\n\n── Comprehension (passage-aware) ──────────────────────────────────────');
  for (const { yearGroup, difficulty, mcTarget, writtenTarget } of COMPREHENSION_SETS) {
    try {
      const { inserted, skipped, errors } = await seedComprehension(yearGroup, difficulty, mcTarget, writtenTarget);
      totalInserted += inserted;
      totalSkipped  += skipped;
      totalErrors   += errors;
    } catch(err) {
      totalErrors++;
      console.error(`❌ seedComprehension ${yearGroup} diff:${difficulty} failed: ${err.message}`);
    }
  }

  // ── Passage top-up ────────────────────────────────────────────────────────────
  try {
    const { inserted, errors } = await topUpPassages();
    totalInserted += inserted;
    totalErrors   += errors;
  } catch(err) {
    totalErrors++;
    console.error(`❌ topUpPassages failed: ${err.message}`);
  }

  console.log('\n=============================================');
  console.log(`✅ Done! Inserted: ${totalInserted}  Skipped: ${totalSkipped}  Errors: ${totalErrors}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
