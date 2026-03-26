/* ══════════════════════════════════════════════════════
   RESOURCE LOOKUP TABLES
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 60 };
const corbettLookup = {
  'addition':                    'https://corbettmathsprimary.com/2018/07/17/addition-video/',
  'subtraction':                 'https://corbettmathsprimary.com/2018/07/17/subtraction-video/',
  'multiplication':              'https://corbettmathsprimary.com/2018/07/21/multiplication-video/',
  'division':                    'https://corbettmathsprimary.com/2018/07/17/division-video/',
  'place value':                 'https://corbettmathsprimary.com/2018/07/17/place-value-video/',
  'rounding':                    'https://corbettmathsprimary.com/2018/07/17/rounding-video/',
  'negative numbers':            'https://corbettmathsprimary.com/2018/07/17/negative-numbers-video/',
  'ordering numbers':            'https://corbettmathsprimary.com/2018/07/17/ordering-numbers-video/',
  'number sequences':            'https://corbettmathsprimary.com/2018/07/31/sequences-video/',
  'sequences':                   'https://corbettmathsprimary.com/2018/07/31/sequences-video/',
  'prime numbers':               'https://corbettmathsprimary.com/2018/07/17/prime-numbers-video/',
  'square numbers':              'https://corbettmathsprimary.com/2018/07/17/square-numbers-video/',
  'cube numbers':                'https://corbettmathsprimary.com/2018/07/17/cube-numbers-video/',
  'factors':                     'https://corbettmathsprimary.com/2018/07/17/factors-video/',
  'multiples':                   'https://corbettmathsprimary.com/2018/07/17/multiples-video/',
  'fractions':                   'https://corbettmathsprimary.com/2018/07/17/fractions-of-amounts-video/',
  'fractions of amounts':        'https://corbettmathsprimary.com/2018/07/17/fractions-of-amounts-video/',
  'equivalent fractions':        'https://corbettmathsprimary.com/2018/07/17/equivalent-fractions-video/',
  'adding fractions':            'https://corbettmathsprimary.com/2018/07/17/adding-fractions-video/',
  'subtracting fractions':       'https://corbettmathsprimary.com/2018/07/17/subtracting-fractions-video/',
  'fractions decimals percentages': 'https://corbettmathsprimary.com/2018/07/17/fractions-decimals-percentages-video/',
  'decimals':                    'https://corbettmathsprimary.com/2018/07/17/decimals-video/',
  'percentages':                 'https://corbettmathsprimary.com/2018/07/18/percentages-of-amounts-video/',
  'percentages of amounts':      'https://corbettmathsprimary.com/2018/07/18/percentages-of-amounts-video/',
  'ratio':                       'https://corbettmathsprimary.com/2018/07/17/ratio-video/',
  'proportion':                  'https://corbettmathsprimary.com/2018/07/17/proportion-video/',
  'algebra':                     'https://corbettmathsprimary.com/2018/07/17/algebra-video/',
  'function machines':           'https://corbettmathsprimary.com/2018/07/17/function-machines-video/',
  'measurement':                 'https://corbettmathsprimary.com/2018/07/17/measurement-video/',
  'metric units':                'https://corbettmathsprimary.com/2018/07/17/metric-units-video/',
  'converting units':            'https://corbettmathsprimary.com/2018/07/17/metric-units-video/',
  'length':                      'https://corbettmathsprimary.com/2018/07/17/measurement-video/',
  'weight':                      'https://corbettmathsprimary.com/2018/07/17/measurement-video/',
  'mass':                        'https://corbettmathsprimary.com/2018/07/17/measurement-video/',
  'capacity':                    'https://corbettmathsprimary.com/2018/07/17/measurement-video/',
  'volume':                      'https://corbettmathsprimary.com/2018/07/17/volume-video/',
  'area':                        'https://corbettmathsprimary.com/2018/07/17/area-video/',
  'perimeter':                   'https://corbettmathsprimary.com/2018/07/17/perimeter-video/',
  'temperature':                 'https://corbettmathsprimary.com/2018/07/17/negative-numbers-video/',
  'time':                        'https://corbettmathsprimary.com/2018/07/31/time-video/',
  'timetables':                  'https://corbettmathsprimary.com/2018/07/31/time-video/',
  '24 hour clock':               'https://corbettmathsprimary.com/2018/07/31/time-video/',
  'analogue clock':              'https://corbettmathsprimary.com/2018/07/31/time-video/',
  'money':                       'https://corbettmathsprimary.com/2018/07/24/money-video/',
  'change':                      'https://corbettmathsprimary.com/2018/07/24/money-video/',
  'shapes':                      'https://corbettmathsprimary.com/2018/07/17/2d-shapes-video/',
  '2d shapes':                   'https://corbettmathsprimary.com/2018/07/17/2d-shapes-video/',
  '3d shapes':                   'https://corbettmathsprimary.com/2018/07/17/3d-shapes-video/',
  'angles':                      'https://corbettmathsprimary.com/2018/07/17/angles-video/',
  'symmetry':                    'https://corbettmathsprimary.com/2018/07/17/symmetry-video/',
  'lines of symmetry':           'https://corbettmathsprimary.com/2018/07/17/symmetry-video/',
  'reflection':                  'https://corbettmathsprimary.com/2018/07/17/reflection-video/',
  'coordinates':                 'https://corbettmathsprimary.com/2018/07/17/coordinates-video/',
  'translation':                 'https://corbettmathsprimary.com/2018/07/17/translation-video/',
  'data handling':               'https://corbettmathsprimary.com/2018/07/17/bar-charts-video/',
  'bar charts':                  'https://corbettmathsprimary.com/2018/07/17/bar-charts-video/',
  'bar chart':                   'https://corbettmathsprimary.com/2018/07/17/bar-charts-video/',
  'pictograms':                  'https://corbettmathsprimary.com/2018/07/17/pictograms-video/',
  'pictogram':                   'https://corbettmathsprimary.com/2018/07/17/pictograms-video/',
  'line graphs':                 'https://corbettmathsprimary.com/2018/07/17/line-graphs-video/',
  'pie charts':                  'https://corbettmathsprimary.com/2018/07/17/pie-charts-video/',
  'venn diagrams':               'https://corbettmathsprimary.com/2018/07/17/venn-diagrams-video/',
  'mean':                        'https://corbettmathsprimary.com/2018/07/17/mean-video/',
  'mean and range':              'https://corbettmathsprimary.com/2018/07/17/mean-video/',
  'range':                       'https://corbettmathsprimary.com/2018/07/17/mean-video/',
  'probability':                 'https://corbettmathsprimary.com/2018/07/17/probability-video/',
};

const bbcLookup = {
  'apostrophe':                  'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zx9ydxs',
  'possessive apostrophe':       'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zx9ydxs',
  'apostrophes':                 'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zx9ydxs',
  'contraction':                 'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zx9ydxs',
  'contractions':                'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zx9ydxs',
  'speech marks':                'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/ztcp97h',
  'inverted commas':             'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/ztcp97h',
  'direct speech':               'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/ztcp97h',
  'comma':                       'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zc773k7',
  'commas':                      'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zc773k7',
  'exclamation mark':            'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/z3dcmsg',
  'question mark':               'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zcm3qhv',
  'brackets':                    'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zg6xb82',
  'hyphen':                      'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zg8gbk7',
  'capital letter':              'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'capital letters':             'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'proper noun':                 'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'proper nouns':                'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'full stop':                   'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'punctuation':                 'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'noun':                        'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrcy6rd',
  'verb':                        'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z34tjfr',
  'verbs':                       'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z34tjfr',
  'tense':                       'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'tenses':                      'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'past tense':                  'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'present tense':               'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'subject verb agreement':      'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/znfbf82',
  'adjective':                   'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zcvcs82',
  'adjectives':                  'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zcvcs82',
  'adverb':                      'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zgsgxfr',
  'pronoun':                     'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/z37xrwx',
  'preposition':                 'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z96fxg8',
  'prepositions':                'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z96fxg8',
  'conjunction':                 'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zhgk3qt',
  'conjunctions':                'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zhgk3qt',
  'modal verb':                  'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zps4pbk',
  'modal verbs':                 'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zps4pbk',
  'synonym':                     'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrhgnk7',
  'synonyms':                    'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrhgnk7',
  'comparative':                 'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zcvcs82',
  'grammar':                     'https://www.bbc.co.uk/bitesize/topics/znxjfdm',
  'spelling':                    'https://www.bbc.co.uk/bitesize/topics/zt78p9q',
  'homophone':                   'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zc84cwx',
  'homophones':                  'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zc84cwx',
  'silent letter':               'https://www.bbc.co.uk/bitesize/topics/zt78p9q/articles/zy4fdxs',
  'comprehension':               'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrcy6rd',
  'inference':                   'https://www.bbc.co.uk/bitesize/topics/zd43qyc/articles/zqmyw6f',
  'reading':                     'https://www.bbc.co.uk/bitesize/topics/zd43qyc',
  'fiction':                     'https://www.bbc.co.uk/bitesize/topics/zjkg239',
  'non-fiction':                 'https://www.bbc.co.uk/bitesize/topics/zw9b7v4',
  'poetry':                      'https://www.bbc.co.uk/bitesize/topics/z7dcxg8',
  'metaphor':                    'https://www.bbc.co.uk/bitesize/topics/zvnxg2p/articles/z9tkxfr',
  'simile':                      'https://www.bbc.co.uk/bitesize/topics/zvnxg2p/articles/z9tkxfr',
  'alliteration':                'https://www.bbc.co.uk/bitesize/topics/zvnxg2p/articles/zq4c7p3',
};

function getCorbettUrl(topic) {
  if (!topic) return 'https://corbettmathsprimary.com/content/';
  const key = topic.toLowerCase().trim();
  if (corbettLookup[key]) return corbettLookup[key];
  for (const [k, url] of Object.entries(corbettLookup)) {
    if (key.includes(k) || k.includes(key)) return url;
  }
  return `https://corbettmathsprimary.com/?s=${encodeURIComponent(topic)}`;
}

function getBBCUrl(topic) {
  if (!topic) return 'https://www.bbc.co.uk/bitesize/subjects/zfw9bdm';
  const key = topic.toLowerCase().trim();
  if (bbcLookup[key]) return bbcLookup[key];
  for (const [k, url] of Object.entries(bbcLookup)) {
    if (key.includes(k) || k.includes(key)) return url;
  }
  return 'https://www.bbc.co.uk/bitesize/subjects/zfw9bdm';
}

/* ══════════════════════════════════════════════════════
   ANTHROPIC HELPER — one prompt → array of question objects
   Kept separate so mock_maths / mock_english can fire two
   calls in parallel via Promise.all instead of one slow call.
══════════════════════════════════════════════════════ */
async function callClaude(apiKey, systemPrompt, userPrompt, maxTokens, label) {
  console.log(`[generate-questions] callClaude(${label}) maxTokens=${maxTokens}`);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[generate-questions] ${label} HTTP ${response.status}:`, errorText.slice(0, 300));
    throw new Error(`Anthropic HTTP ${response.status} for ${label}`);
  }
  const data = await response.json();
  console.log(`[generate-questions] ${label} stop_reason=${data.stop_reason} output_tokens=${data.usage?.output_tokens}`);
  if (!data.content || !data.content.length) throw new Error(`Empty response for ${label}`);
  const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const clean = text.replace(/```json|```/g, '').trim();
  let parsed;
  try { parsed = JSON.parse(clean); } catch(e) {
    console.error(`[generate-questions] ${label} JSON parse error:`, e.message, 'preview:', clean.slice(0, 200));
    throw new Error(`JSON parse failed for ${label}`);
  }
  if (Array.isArray(parsed)) parsed = { questions: parsed };
  if (!parsed.questions || !Array.isArray(parsed.questions)) throw new Error(`Invalid format for ${label}`);
  console.log(`[generate-questions] ${label} → ${parsed.questions.length} questions`);
  return parsed.questions;
}

/* ══════════════════════════════════════════════════════
   MAIN HANDLER
══════════════════════════════════════════════════════ */
export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { track, topic, mode } = req.body || {};
  const level          = track === 'P7' ? 'P7' : 'P6';
  const topicMode      = mode === 'topic' && topic;
  const mockPractice   = mode === 'mock_practice';
  const mockEnglish    = mode === 'mock_english';
  const mockMaths      = mode === 'mock_maths';

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  /* ══════════════════════════════════════
     SYSTEM PROMPT
  ══════════════════════════════════════ */
  const systemPrompt = `You are STAR, a professional SEAG Transfer Test examiner for Northern Ireland.
You generate 100% ORIGINAL exam questions based on the official SEAG specification and NI KS2 curriculum.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 COPYRIGHT — NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEAG papers are copyright GL Assessment. NEVER copy scenarios, names, passages or questions from any published paper.
Every scenario, name, sentence, number and passage must be entirely original.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ ACCURACY MANDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Punctuation/Spelling 5th option: ALWAYS exactly "N. No mistake" — NEVER "E. No mistake"
- Answer for no-mistake: ALWAYS exactly "N" — NEVER "E"
- NEVER contradict between answer field and explanation
- Maths: pre-calculate every answer twice; correct answer MUST be in options

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PUNCTUATION FORMAT (real SEAG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sentence split into 4 labelled segments (A, B, C, D).
segments array has 4 items. options array has 5 items:
["A. [first segment]", "B. [second segment]", "C. [third segment]", "D. [fourth segment]", "N. No mistake"]
Answer: A, B, C, D, or N.

Only test UNAMBIGUOUS errors:
✓ Missing capital at sentence start
✓ Missing capital for proper noun (name, place, day, month)
✓ Common noun wrongly capitalised mid-sentence
✓ Missing full stop at end of statement
✓ Missing question mark at end of question
✓ Missing apostrophe in contraction (don't, can't, I'm, it's, we've, they're)
✓ Apostrophe wrongly added to simple plural (apple's instead of apples)
✓ Missing speech marks around direct speech
NEVER: comma placement, Oxford comma, optional style choices

text field instruction:
- Capital letter error → "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N."
- Punctuation mark error → "Find the section with the punctuation mistake. If there is no mistake, mark N."
- No mistake → "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 GRAMMAR FORMAT (real SEAG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
context field: sentence with _____ marking the blank gap
options array: exactly 5 single words or short phrases (A/B/C/D/E)
segments array: empty []
text field: "Choose the best word to complete the sentence."
Answer: A, B, C, D, or E

Test: verb tense, subject-verb agreement, pronoun choice, preposition, conjunction, comparative/superlative

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPELLING FORMAT (real SEAG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Same segment format as Punctuation. text = "Find the section with the spelling mistake. If there is no mistake, mark N."
UK English only. Clear misspellings: I-before-E, double consonants, silent letters, irregular spellings, homophones.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 COMPREHENSION FORMAT (real SEAG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONE original reading passage (~400-500 words, prose fiction or non-fiction, suitable for P6/P7).
passage field: full text of the passage (same in every comprehension question).

Multiple choice (Q16-22): options A/B/C/D/E. Literal, inferential, and language questions.
Free response (Q23-28): options array EMPTY []. Answer field = exact short expected answer.
Free response types: word/phrase extraction from passage, counting, grammar identification, phrase meaning.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 MATHS FORMAT (real SEAG)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${level === 'P6' ? `P6: whole numbers, basic fractions (halves/quarters/thirds/eighths), decimals to 2dp, simple percentages (10/25/50/75%), time, money up to £10, metric measurement, bar charts/pictograms, sequences, 2D shapes, symmetry` : `P7: all number ops with decimals, percentages of amounts, fractions/decimals/percentages equivalence, ratio/proportion, area/perimeter, volume by counting cubes, mean/range, probability, coordinates (first quadrant), algebra (letter for number), prime/square/cube numbers, negative numbers, metric conversion, 24-hour clock/timetables, bar/line/pie charts, Venn diagrams, 2D/3D shapes, reflection`}

Each question asks exactly ONE thing. NEVER two-part questions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ SAFE CONTENT — AGES 9-11
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
APPROVED: sports, nature, animals, science, space, school trips, cooking, music, hobbies, history, geography.
FORBIDDEN: violence, theft, bullying, danger, alcohol, gambling.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JSON FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid raw JSON. No markdown, no code fences.
Root: {"questions": [...]}
Every question has: level, type, topic, marks, text, segments, context, passage, options, answer, explanation, steps, hint, videoTopic, videoSource`;

  /* ══════════════════════════════════════
     USER PROMPT BY MODE
  ══════════════════════════════════════ */
  let userPrompt;
  let maxTokens = 4000;

  if (mockPractice) {
    userPrompt = `Generate exactly 10 PRACTICE SECTION warm-up questions for ${level}. Slightly easier than main test — build confidence.

5 English (mix of punctuation, grammar, spelling — 1-2 each):
- Punctuation: segments format, A/B/C/D/N
- Grammar: context with _____ gap, 5 word options
- Spelling: segments format, A/B/C/D/N

5 Maths: varied basic topics, standard A/B/C/D/E multiple choice

CHECKS: 5th option on Punctuation/Spelling = exactly "N. No mistake". Answer = "N" for no-mistake questions.
Return {"questions": [...10 questions...]}`;

  } else if (mockEnglish) {
    // Split into 2 parallel calls: language (15 q) + comprehension (13 q)
    // Each call ~3000 tokens — much faster than one 8000-token call
    userPrompt = '__split_english__';

  } else if (mockMaths) {
    // Split into 4 parallel calls: part1 (7 MC), part2 (7 MC), part3 (6 MC), part4 (5 FR)
    // Max 7 questions per call at 2000 tokens — avoids truncation on all parts
    userPrompt = '__split_maths__';

  } else if (topicMode) {
    userPrompt = `Generate exactly 10 questions ALL focused on: "${topic}" for ${level}.
ALL 10 must be about this topic. Vary difficulty start easy build to harder. Use correct SEAG formats.
CHECKS: 5th option = "N. No mistake" for Punctuation/Spelling. Maths answers in options.
Return {"questions": [...10 questions...]}`;

  } else {
    // Default mini sprint
    userPrompt = `Generate exactly 10 questions for ${level}: 2 Punctuation, 1 Grammar, 2 Spelling, 5 Maths (varied topics).

Use correct SEAG formats:
- Punctuation/Spelling: segments A/B/C/D + "N. No mistake" as 5th option
- Grammar: context field with _____ gap + 5 word options
- Maths: A/B/C/D/E multiple choice

CHECKS: 5th option = exactly "N. No mistake". Maths correct answer in options. No comma-placement errors.
Return {"questions": [...10 questions...]}`;
  }

  /* ══════════════════════════════════════
     API CALL(S)
  ══════════════════════════════════════ */
  try {
    console.log(`[generate-questions] START mode=${mode} level=${level}`);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    let allQuestions;

    if (mockMaths) {
      // Four parallel calls — max 7 questions each at 2000 tokens, well within limit
      const p1 = `Generate exactly 7 MATHS MULTIPLE CHOICE questions for ${level}.
Each has exactly 5 options A/B/C/D/E. Topics: number operations ×4, fractions/decimals/percentages ×3.
Full SEAG difficulty. Pre-calculate every answer twice. Correct answer MUST appear in A/B/C/D/E.
Return {"questions": [...7 questions...]}`;

      const p2 = `Generate exactly 7 MATHS MULTIPLE CHOICE questions for ${level}.
Each has exactly 5 options A/B/C/D/E. Topics: measurement/metric units ×3, sequences/patterns ×2, 2D/3D shapes ×2.
Full SEAG difficulty. Pre-calculate every answer twice. Correct answer MUST appear in A/B/C/D/E.
Return {"questions": [...7 questions...]}`;

      const p3 = `Generate exactly 6 MATHS MULTIPLE CHOICE questions for ${level}.
Each has exactly 5 options A/B/C/D/E. Topics: data/graphs ×2, word problems ×2, area/perimeter ×1, probability ×1.
Full SEAG difficulty. Pre-calculate every answer twice. Correct answer MUST appear in A/B/C/D/E.
Return {"questions": [...6 questions...]}`;

      const p4 = `Generate exactly 5 MATHS FREE RESPONSE questions for ${level}.
options field must be exactly []. Each question requires an exact numeric answer; state units clearly in the question text.
Topics: money calculations ×2, time problems ×1, multi-step word problem ×2.
Pre-calculate every answer twice. No multiple choice — free response only.
Return {"questions": [...5 questions...]}`;

      const [part1, part2, part3, part4] = await Promise.all([
        callClaude(apiKey, systemPrompt, p1, 2000, 'maths-part1'),
        callClaude(apiKey, systemPrompt, p2, 2000, 'maths-part2'),
        callClaude(apiKey, systemPrompt, p3, 2000, 'maths-part3'),
        callClaude(apiKey, systemPrompt, p4, 2000, 'maths-part4')
      ]);
      allQuestions = [...part1, ...part2, ...part3, ...part4];
      console.log(`[generate-questions] mock_maths merged: ${allQuestions.length} questions`);

    } else if (mockEnglish) {
      // Two parallel calls: language skills (15 q) + comprehension (13 q)
      const pLang = `Generate exactly 15 ENGLISH questions for ${level} in SEAG format:
Q1-5 PUNCTUATION: sentence split into 4 segments A/B/C/D, options ["A. seg","B. seg","C. seg","D. seg","N. No mistake"], answer A/B/C/D/N. Vary: apostrophes, capitals, missing punctuation, no-mistake questions.
Q6-10 GRAMMAR: context field has sentence with _____ gap, 5 word options A/B/C/D/E, text "Choose the best word to complete the sentence." Vary: prepositions, conjunctions, pronouns, verb tenses.
Q11-15 SPELLING: same segment format as punctuation, text "Find the section with the spelling mistake. If there is no mistake, mark N." Use real UK English spelling errors.
CHECKS: Q1-5 and Q11-15 fifth option exactly "N. No mistake". No-mistake answers exactly "N".
Return {"questions": [...15 questions...]}`;

      const pComp = `Generate exactly 9 COMPREHENSION questions for ${level} based on ONE original reading passage.
Write ONE original passage ~200 words (prose fiction or non-fiction, suitable for ages 10-12).
IMPORTANT: Include the full passage text in the passage field of Q1 ONLY. For Q2-9 set passage to empty string "". The server will copy it automatically.
Q1-5: 5 multiple choice A/B/C/D/E (literal, inferential, language effect questions).
Q6-9: 4 free response — options: [] — answer: exact short expected word/phrase from passage.
Types for FR: word extraction, phrase extraction, counting, grammar identification.
FR answers are exact expected values found in the passage.
Return {"questions": [...9 questions...]}`;

      const [partLang, partComp] = await Promise.all([
        callClaude(apiKey, systemPrompt, pLang, 3500, 'english-language'),
        callClaude(apiKey, systemPrompt, pComp, 3000, 'english-comprehension')
      ]);
      allQuestions = [...partLang, ...partComp];
      console.log(`[generate-questions] mock_english merged: ${allQuestions.length} questions`);

    } else {
      // Single call for all other modes (practice, topic sprint, mini sprint)
      allQuestions = await callClaude(apiKey, systemPrompt, userPrompt, maxTokens, mode);
    }

    const parsed = { questions: allQuestions };
    console.log(`[generate-questions] Total questions: ${parsed.questions.length} for mode=${mode}`);

    /* ══════════════════════════════════════
       SERVER-SIDE SAFETY VALIDATION
    ══════════════════════════════════════ */
    parsed.questions.forEach((q, idx) => {

      // Layer 1: Force "N. No mistake"
      if (q.topic === 'Punctuation' || q.topic === 'Spelling') {
        if (q.options && Array.isArray(q.options)) {
          q.options = q.options.map((opt, i) => {
            const lower = (opt || '').toLowerCase().trim();
            if (lower.includes('no mistake')) {
              const thisLetter = ['A','B','C','D','E'][i];
              if (q.answer === thisLetter) q.answer = 'N';
              return 'N. No mistake';
            }
            return opt;
          });
        }
        if (q.answer === 'E' && q.options && q.options.length === 5) {
          const last = (q.options[4] || '').toLowerCase();
          if (last.includes('no mistake')) { q.answer = 'N'; q.options[4] = 'N. No mistake'; }
        }
      }

      // Layer 2: Explanation contradicts answer
      if (q.topic === 'Punctuation' || q.topic === 'Spelling') {
        const exp = (q.explanation || '').toLowerCase();
        const noMistake = exp.includes('no mistake') || exp.includes('all spelling') ||
          exp.includes('all punctuation') || exp.includes('correctly spelled') ||
          exp.includes('there is no error') || exp.includes('no errors') ||
          exp.includes('are all correct');
        if (noMistake && q.answer !== 'N') q.answer = 'N';
      }

      // Layer 3: Video URLs
      const videoTopic = (q.videoTopic || q.topic || '').toLowerCase().trim();
      const source     = (q.videoSource || '').trim();
      q.videoUrl = source === 'CorbettMaths' ? getCorbettUrl(videoTopic) : getBBCUrl(videoTopic);

      // Layer 4: Fix instruction text for capital letter questions
      if (q.topic === 'Punctuation') {
        const exp = (q.explanation || '').toLowerCase();
        const isCapitalError = exp.includes('capital letter') || exp.includes('proper noun') ||
          exp.includes('should be capitalised') || exp.includes('should have a capital');
        const textField = (q.text || '').toLowerCase();
        if (isCapitalError && !textField.includes('capital')) {
          q.text = 'Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.';
        }
      }

      // Normalise type to 'english' | 'maths' based on topic
      const topicLc = (q.topic || '').toLowerCase();
      q.type = ['punctuation', 'grammar', 'spelling', 'comprehension'].some(t => topicLc.includes(t))
        ? 'english' : 'maths';

      // Ensure required fields
      if (!q.hint)     q.hint     = 'Think carefully about each option.';
      if (!q.steps)    q.steps    = [];
      if (!q.segments) q.segments = [];
      if (!q.context)  q.context  = '';
      if (!q.passage)  q.passage  = '';
    });

    // Propagate comprehension passage from first question that has one to all others
    let sharedPassage = '';
    parsed.questions.forEach(q => {
      if ((q.topic || '').toLowerCase().includes('comprehension') && q.passage && !sharedPassage) {
        sharedPassage = q.passage;
      }
    });
    if (sharedPassage) {
      parsed.questions.forEach(q => {
        if ((q.topic || '').toLowerCase().includes('comprehension') && !q.passage) {
          q.passage = sharedPassage;
        }
      });
      console.log(`[generate-questions] Propagated passage to comprehension questions (${sharedPassage.length} chars)`);
    }

    console.log(`[generate-questions] DONE mode=${mode} level=${level} questions=${parsed.questions.length}`);
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('Unexpected server error:', error);
    return res.status(500).json({ error: 'Server error — please try again', detail: error.message });
  }
}
