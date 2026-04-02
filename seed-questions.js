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
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_KEY_HERE';

const BATCH_SIZE = 5;
const DELAY_MS   = 4000;

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

Here is an example of the EXACT JSON format required:
${exampleJson}

IMPORTANT: Respond with ONLY a valid JSON array of ${count} questions. No markdown, no backticks, no explanation — just the JSON array starting with [ and ending with ].

Generate ${count} questions for: ${subject} / ${topic} / ${yearGroup} / difficulty ${difficulty}`;
}

// ── Diagram attachment ────────────────────────────────────────────────────────
function attachDiagram(q) {
  const text = ((q.question_text || '') + ' ' + (q.topic || '')).toLowerCase();

  if (/right[- ]angled/.test(text) && /triangle/.test(text))
    return generateDiagram('triangle', { subtype: 'right-angled', unknownAngle: /\ba°|unknown/.test(text) });
  if (/equilateral/.test(text) && /triangle/.test(text))
    return generateDiagram('triangle', { subtype: 'equilateral' });
  if (/isosceles/.test(text) && /triangle/.test(text))
    return generateDiagram('triangle', { subtype: 'isosceles' });
  if (/\btriangle\b/.test(text))
    return generateDiagram('triangle', { subtype: 'scalene', unknownAngle: /\ba°|unknown/.test(text) });

  if (/\bsquare\b/.test(text) && !/square number/.test(text))
    return generateDiagram('shape', { subtype: 'square' });
  if (/\brectangle\b/.test(text))
    return generateDiagram('shape', { subtype: 'rectangle' });
  if (/\bhexagon\b/.test(text))
    return generateDiagram('shape', { subtype: 'hexagon' });
  if (/\bpentagon\b/.test(text))
    return generateDiagram('shape', { subtype: 'pentagon' });
  if (/\boctagon\b/.test(text))
    return generateDiagram('shape', { subtype: 'octagon' });
  if (/\bparallelogram\b/.test(text))
    return generateDiagram('shape', { subtype: 'parallelogram' });
  if (/\brhombus\b/.test(text))
    return generateDiagram('shape', { subtype: 'rhombus' });
  if (/\btrapezium\b/.test(text))
    return generateDiagram('shape', { subtype: 'trapezium' });

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

  if (/\bpictogram\b/.test(text))
    return generateDiagram('pictogram', {});

  if (/number line|missing number/.test(text))
    return generateDiagram('number-line', {});

  if (/\bruler\b|\bthermometer\b|\bweighs?\b|\bweighing\b/.test(text))
    return generateDiagram('measurement-scale', { type: /therm/.test(text) ? 'thermometer' : /weigh/.test(text) ? 'weighing-dial' : 'ruler' });

  return null;
}

// ── Insert ─────────────────────────────────────────────────────────────────────
async function insertQuestions(questions, subject, topic, yearGroup, difficulty) {
  const rows = questions.map(q => ({
    subject,
    topic,      // always from TARGETS — never from generated JSON
    year_group: yearGroup,
    difficulty,
    question_type: q.question_type || (q.options ? 'mc' : 'written'),
    question_text: q.question_text,
    passage: q.passage || null,
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

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 STAR AI Tutor — Question Bank Generator v3');
  console.log('=============================================');

  let totalInserted = 0;
  let totalErrors = 0;

  for (const [subject, topic, yearGroup, difficulty, count] of TARGETS) {
    const batches = Math.ceil(count / BATCH_SIZE);
    console.log(`\n📝 ${yearGroup} ${subject}/${topic} diff:${difficulty} — ${count} questions (${batches} batches)`);

    let inserted = 0;
    let remaining = count;

    for (let b = 0; b < batches; b++) {
      const batchCount = Math.min(BATCH_SIZE, remaining);
      process.stdout.write(`   Batch ${b+1}/${batches} (${batchCount})... `);

      try {
        const questions = await generateBatch(subject, topic, yearGroup, difficulty, batchCount);
        const n = await insertQuestions(questions, subject, topic, yearGroup, difficulty);
        inserted += n;
        remaining -= batchCount;
        totalInserted += n;
        console.log(`✅ ${n} inserted`);
      } catch(err) {
        totalErrors++;
        console.log(`❌ ${err.message}`);
      }

      if (b < batches - 1) await sleep(DELAY_MS);
    }

    console.log(`   → ${inserted}/${count} for this target`);
  }

  console.log('\n=============================================');
  console.log(`✅ Done! Total inserted: ${totalInserted}`);
  if (totalErrors > 0) console.log(`⚠️  Errors: ${totalErrors}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
