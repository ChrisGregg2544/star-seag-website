/* ══════════════════════════════════════════════════════
   RESOURCE LOOKUP TABLES
   Exact URLs from CorbettMathsPrimary and BBC Bitesize.
   Falls back to search/subject page if no match found.
══════════════════════════════════════════════════════ */

// ── CorbettMaths Primary — topic → exact video URL ──
const corbettLookup = {
  // NUMBER
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
  // FRACTIONS, DECIMALS, PERCENTAGES
  'fractions':                   'https://corbettmathsprimary.com/2018/07/17/fractions-of-amounts-video/',
  'fractions of amounts':        'https://corbettmathsprimary.com/2018/07/17/fractions-of-amounts-video/',
  'equivalent fractions':        'https://corbettmathsprimary.com/2018/07/17/equivalent-fractions-video/',
  'adding fractions':            'https://corbettmathsprimary.com/2018/07/17/adding-fractions-video/',
  'subtracting fractions':       'https://corbettmathsprimary.com/2018/07/17/subtracting-fractions-video/',
  'fractions decimals percentages': 'https://corbettmathsprimary.com/2018/07/17/fractions-decimals-percentages-video/',
  'decimals':                    'https://corbettmathsprimary.com/2018/07/17/decimals-video/',
  'percentages':                 'https://corbettmathsprimary.com/2018/07/18/percentages-of-amounts-video/',
  'percentages of amounts':      'https://corbettmathsprimary.com/2018/07/18/percentages-of-amounts-video/',
  // RATIO & PROPORTION
  'ratio':                       'https://corbettmathsprimary.com/2018/07/17/ratio-video/',
  'proportion':                  'https://corbettmathsprimary.com/2018/07/17/proportion-video/',
  'scaling':                     'https://corbettmathsprimary.com/2018/07/17/proportion-video/',
  // ALGEBRA
  'algebra':                     'https://corbettmathsprimary.com/2018/07/17/algebra-video/',
  'function machines':           'https://corbettmathsprimary.com/2018/07/17/function-machines-video/',
  // MEASUREMENT
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
  // TIME
  'time':                        'https://corbettmathsprimary.com/2018/07/31/time-video/',
  'timetables':                  'https://corbettmathsprimary.com/2018/07/31/time-video/',
  '24 hour clock':               'https://corbettmathsprimary.com/2018/07/31/time-video/',
  'analogue clock':              'https://corbettmathsprimary.com/2018/07/31/time-video/',
  // MONEY
  'money':                       'https://corbettmathsprimary.com/2018/07/24/money-video/',
  'change':                      'https://corbettmathsprimary.com/2018/07/24/money-video/',
  // SHAPE & SPACE
  'shapes':                      'https://corbettmathsprimary.com/2018/07/17/2d-shapes-video/',
  '2d shapes':                   'https://corbettmathsprimary.com/2018/07/17/2d-shapes-video/',
  '3d shapes':                   'https://corbettmathsprimary.com/2018/07/17/3d-shapes-video/',
  'angles':                      'https://corbettmathsprimary.com/2018/07/17/angles-video/',
  'symmetry':                    'https://corbettmathsprimary.com/2018/07/17/symmetry-video/',
  'lines of symmetry':           'https://corbettmathsprimary.com/2018/07/17/symmetry-video/',
  'reflection':                  'https://corbettmathsprimary.com/2018/07/17/reflection-video/',
  'coordinates':                 'https://corbettmathsprimary.com/2018/07/17/coordinates-video/',
  'translation':                 'https://corbettmathsprimary.com/2018/07/17/translation-video/',
  // DATA
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
  // PROBABILITY
  'probability':                 'https://corbettmathsprimary.com/2018/07/17/probability-video/',
};

// ── BBC Bitesize — topic → exact article/topic URL ──
const bbcLookup = {
  // PUNCTUATION
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
  'comma in a list':             'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zxvcrdm',
  'exclamation mark':            'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/z3dcmsg',
  'question mark':               'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zcm3qhv',
  'question marks':              'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zcm3qhv',
  'semi-colon':                  'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zshfdxs',
  'semicolon':                   'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zshfdxs',
  'brackets':                    'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zg6xb82',
  'hyphen':                      'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zg8gbk7',
  'dash':                        'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zg8gbk7',
  'ellipsis':                    'https://www.bbc.co.uk/bitesize/topics/zpmws82/articles/zpgjy4j',
  'capital letter':              'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'capital letters':             'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'proper noun':                 'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'proper nouns':                'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'full stop':                   'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  'punctuation':                 'https://www.bbc.co.uk/bitesize/topics/zpmws82',
  // GRAMMAR
  'noun':                        'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrcy6rd',
  'nouns':                       'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrcy6rd',
  'verb':                        'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z34tjfr',
  'verbs':                       'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z34tjfr',
  'tense':                       'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'tenses':                      'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'past tense':                  'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'present tense':               'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'future tense':                'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'verb tense':                  'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zh4thbk',
  'subject verb agreement':      'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/znfbf82',
  'adjective':                   'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zcvcs82',
  'adjectives':                  'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zcvcs82',
  'adverb':                      'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zgsgxfr',
  'adverbs':                     'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zgsgxfr',
  'pronoun':                     'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/z37xrwx',
  'pronouns':                    'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/z37xrwx',
  'preposition':                 'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z96fxg8',
  'prepositions':                'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z96fxg8',
  'conjunction':                 'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zhgk3qt',
  'conjunctions':                'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zhgk3qt',
  'coordinating conjunction':    'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/z9wvqhv',
  'subordinating conjunction':   'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zqk37p3',
  'modal verb':                  'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zps4pbk',
  'modal verbs':                 'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zps4pbk',
  'passive verb':                'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zsx2b82',
  'relative clause':             'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zsrt4qt',
  'prefix':                      'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/z9hjwxs',
  'prefixes':                    'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/z9hjwxs',
  'suffix':                      'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zwgbcwx',
  'suffixes':                    'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zwgbcwx',
  'synonym':                     'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrhgnk7',
  'synonyms':                    'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrhgnk7',
  'antonym':                     'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrhgnk7',
  'comparative':                 'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zcvcs82',
  'superlative':                 'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zcvcs82',
  'grammar':                     'https://www.bbc.co.uk/bitesize/topics/znxjfdm',
  // SPELLING
  'spelling':                    'https://www.bbc.co.uk/bitesize/topics/zt78p9q',
  'homophone':                   'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zc84cwx',
  'homophones':                  'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zc84cwx',
  'their there':                 'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/z3cxrwx',
  "they're":                     'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/z3cxrwx',
  'to too two':                  'https://www.bbc.co.uk/bitesize/topics/znxjfdm/articles/zc4jpbk',
  'silent letter':               'https://www.bbc.co.uk/bitesize/topics/zt78p9q/articles/zy4fdxs',
  'silent letters':              'https://www.bbc.co.uk/bitesize/topics/zt78p9q/articles/zy4fdxs',
  'tion':                        'https://www.bbc.co.uk/bitesize/topics/zt78p9q/articles/zyv4qhv',
  'sion':                        'https://www.bbc.co.uk/bitesize/topics/zt78p9q/articles/zyv4qhv',
  'cious':                       'https://www.bbc.co.uk/bitesize/topics/zt78p9q/articles/zp7dk7h',
  'tious':                       'https://www.bbc.co.uk/bitesize/topics/zt78p9q/articles/zp7dk7h',
  'ough':                        'https://www.bbc.co.uk/bitesize/topics/zt78p9q/articles/z9f2b82',
  'double consonant':            'https://www.bbc.co.uk/bitesize/topics/zt78p9q',
  'double consonants':           'https://www.bbc.co.uk/bitesize/topics/zt78p9q',
  'proofreading':                'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/z738b7h',
  // COMPREHENSION & READING
  'comprehension':               'https://www.bbc.co.uk/bitesize/topics/zxtm8p3/articles/zrcy6rd',
  'inference':                   'https://www.bbc.co.uk/bitesize/topics/zd43qyc/articles/zqmyw6f',
  'reading':                     'https://www.bbc.co.uk/bitesize/topics/zd43qyc',
  'fiction':                     'https://www.bbc.co.uk/bitesize/topics/zjkg239',
  'non-fiction':                 'https://www.bbc.co.uk/bitesize/topics/zw9b7v4',
  'poetry':                      'https://www.bbc.co.uk/bitesize/topics/z7dcxg8',
  'poem':                        'https://www.bbc.co.uk/bitesize/topics/z7dcxg8',
  'metaphor':                    'https://www.bbc.co.uk/bitesize/topics/zvnxg2p/articles/z9tkxfr',
  'simile':                      'https://www.bbc.co.uk/bitesize/topics/zvnxg2p/articles/z9tkxfr',
  'alliteration':                'https://www.bbc.co.uk/bitesize/topics/zvnxg2p/articles/zq4c7p3',
  'onomatopoeia':                'https://www.bbc.co.uk/bitesize/topics/zvnxg2p/articles/z8t3g82',
};

/* ──────────────────────────────────────────────────────
   LOOKUP HELPER FUNCTIONS
────────────────────────────────────────────────────── */
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
   MAIN HANDLER
══════════════════════════════════════════════════════ */
export default async function handler(req, res) {

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { track, topic, mode } = req.body || {};
  const level = track === 'P7' ? 'P7' : 'P6';
  const topicMode = mode === 'topic' && topic;
  const mockMode  = mode === 'mock';

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const systemPrompt = `You are STAR, a professional SEAG Transfer Test examiner for Northern Ireland.
You generate 100% ORIGINAL exam questions based on the official SEAG specification
and NI KS2 curriculum. Every question must be entirely your own creation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 COPYRIGHT PROTECTION — NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The SEAG practice papers are copyright GL Assessment.
You MUST NEVER:
- Copy or reproduce any question, sentence, passage or scenario from any published SEAG paper
- Use the same names or scenarios from published papers (e.g. the Conjurer story,
  Mr Mitchell's pizza bar, Tom and his cat, Shona and the bus, Maya and Tamlyn's crisps,
  the milkshake pictogram, the sports challenge table, Ben and his sisters)
- Mirror the structure of any specific published question even if you change the numbers

Every question scenario, name, sentence and number must be entirely original.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ IRONCLAD ACCURACY MANDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZERO-TOLERANCE ERROR RULE: An incorrect answer key is a critical failure.

NO MISTAKE OPTION — MOST IMPORTANT RULE:
- The 5th option is ALWAYS written as exactly "N. No mistake" — NEVER "E. No mistake"
- The answer field for no-mistake questions is ALWAYS exactly "N" — NEVER "E"
- If your explanation says no mistake or all correct then answer MUST be "N"
- NEVER contradict yourself between the answer field and the explanation

MATHS ACCURACY:
- Pre-calculate every answer twice before writing the question
- The correct answer MUST be listed in the A/B/C/D/E options

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PUNCTUATION — EXAMINER RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Only test errors that are 100% UNAMBIGUOUS and universally agreed to be wrong.
NEVER test punctuation that is a matter of style or opinion.

APPROVED errors — use ONLY these:
✓ Missing capital letter at the start of a sentence
✓ Missing capital letter for a proper noun (person name, place, day, month)
✓ A common noun wrongly given a capital letter mid-sentence
✓ Missing full stop at the end of a statement
✓ Missing question mark at the end of a question
✓ Missing apostrophe in a contraction (don't, can't, I'm, it's, we've, they're)
✓ Apostrophe wrongly added to a simple plural (apple's instead of apples)
✓ Missing speech marks around direct speech

NEVER use these — always debatable:
✗ Comma after an introductory phrase — FORBIDDEN (always optional)
✗ Any comma placement — FORBIDDEN (too debatable at KS2)
✗ Oxford comma — FORBIDDEN
✗ Semicolons — FORBIDDEN for P6, only very obvious cases for P7

⚠️ CRITICAL INSTRUCTION TEXT RULE — READ CAREFULLY:
The "text" field in each punctuation question MUST match the type of error being tested:

- If the error is a CAPITAL LETTER mistake (missing capital, wrong capital):
  text MUST be: "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N."

- If the error is a PUNCTUATION mark only (apostrophe, full stop, question mark, speech marks):
  text MUST be: "Find the section with the punctuation mistake. If there is no mistake, mark N."

- If there is NO mistake in the sentence:
  text MUST be: "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N."

NEVER write "punctuation mistake" when the error is a capital letter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 SPELLING — EXAMINER RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UK English only. Test clear-cut misspellings:
✓ I before E except after C (receive, believe, ceiling, achieve)
✓ Double consonants (beginning, running, stopped, sitting)
✓ Silent letters (knight, wrong, knee, gnome, write)
✓ Common irregular spellings (necessary, beautiful, separate, definitely, because, friend)
✓ Homophones used wrongly (their/there/they're, your/you're, its/it's, to/too/two)
✓ Common suffixes (-tion, -sion, -ous, -ful, -less, -ly, -ment)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 GRAMMAR — EXAMINER RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test one of:
✓ Correct verb tense (past, present, future, irregular: seek/sought, find/found)
✓ Subject-verb agreement (the children were / she was)
✓ Correct pronoun (who's vs whose, they're vs their)
✓ Correct preposition (across/through/over/under/into)
✓ Correct conjunction (although/unless/despite/because/so)
✓ Comparative/superlative (fast/faster/fastest, good/better/best)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 MATHS — EXAMINER RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${level === 'P6' ? `P6 Foundation — NI KS2 core:
- Whole numbers and place value
- Addition, subtraction, multiplication, division (times tables to 10x10)
- Simple fractions (halves, quarters, thirds, eighths)
- Decimals up to 2 decimal places
- Simple percentages (10%, 25%, 50%, 75%)
- Time (analogue, 12-hour, simple timetables)
- Money (addition, subtraction, change up to £10)
- Measurement (cm/m, g/kg, ml/l — metric only)
- Basic data (reading bar charts and pictograms)
- Number sequences (steps, doubling, halving)
- 2D shapes, lines of symmetry`
: `P7 Executor — Full SEAG specification:
- All number operations including decimals
- Percentages of amounts
- Fractions, decimals, percentages equivalence
- Ratio and proportion
- Area and perimeter
- Volume by counting cubes
- Mean and range
- Probability language and simple calculations
- Coordinates in first quadrant
- Algebra: letter representing a number
- Prime, square and cube numbers
- Negative numbers and temperature (Celsius)
- Metric unit conversion
- 24-hour clock and timetables
- Data: bar charts, line graphs, pie charts, Venn diagrams
- 2D and 3D shapes
- Reflection`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 MATHS QUESTION WORDING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEVER use two-part wording that implies ordering then asking a separate question.
FORBIDDEN: "Write these in order from smallest to largest — which is the largest?"
FORBIDDEN: "Arrange these from smallest to largest. Which comes first?"
These are confusing because they imply a multi-step task but only allow one answer.

INSTEAD use clear single-task wording:
✓ "Which of these fractions is the largest?"
✓ "Which of these numbers is the smallest?"
✓ "Put these in order — what is the third number?"
Each question must ask for exactly ONE thing with ONE answer.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ SAFE CONTENT — AGES 9-11
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL scenarios positive and wholesome.
APPROVED: sports, nature, animals, science, space, school trips, cooking,
music, hobbies, history, geography, family (positive contexts only).
FORBIDDEN: violence, theft, bullying, danger, alcohol, gambling.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 JSON FORMAT — RETURN THIS EXACTLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid raw JSON. No markdown, no code fences, no explanation.
The root element MUST be an object with a "questions" key containing an array.

videoTopic field: 3-4 word phrase matching a topic key e.g. "apostrophes contractions", "fractions of amounts", "bar charts".

${mockMode ? `Generate exactly 66 questions in this EXACT structure:
- Questions 1-10: PRACTICE SECTION (5 English + 5 Maths, simpler warm-up questions, suitable for building confidence)
- Questions 11-38: ENGLISH MAIN TEST (28 questions: 5 Punctuation, 5 Grammar, 5 Spelling, 8 Comprehension multiple choice, 5 Comprehension free response)
- Questions 39-66: MATHS MAIN TEST (22 multiple choice + 6 free response, full SEAG specification difficulty)
Label each question with a "section" field: "practice", "english", or "maths".` : topicMode ? `Generate exactly 10 questions ALL focused on the topic: "${topic}". Mix question types appropriately for this topic — if it is a Maths topic, generate 10 Maths questions on that specific topic; if it is an English topic, generate 10 English questions on that specific topic. Vary the question style and difficulty within the topic.` : 'Generate exactly 10 questions: 2 Punctuation, 1 Grammar, 2 Spelling, 5 Maths (varied topics).'}

PUNCTUATION EXAMPLE — capital letter error:
{
  "level": "${level}", "type": "english", "topic": "Punctuation", "marks": "1 mark",
  "text": "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.",
  "segments": ["Sarah and james", "visited the wildlife", "park on Saturday", "morning."],
  "options": ["A. Sarah and james", "B. visited the wildlife", "C. park on Saturday", "D. morning.", "N. No mistake"],
  "answer": "A",
  "explanation": "'james' should have a capital letter because it is a proper noun — a person's name.",
  "steps": [], "hint": "Check whether all names and proper nouns have a capital letter.",
  "videoTopic": "capital letters proper nouns", "videoSource": "BBC Bitesize"
}

PUNCTUATION EXAMPLE — apostrophe error:
{
  "level": "${level}", "type": "english", "topic": "Punctuation", "marks": "1 mark",
  "text": "Find the section with the punctuation mistake. If there is no mistake, mark N.",
  "segments": ["We couldnt believe", "how fast the", "cheetah ran across", "the open plain."],
  "options": ["A. We couldnt believe", "B. how fast the", "C. cheetah ran across", "D. the open plain.", "N. No mistake"],
  "answer": "A",
  "explanation": "'couldnt' is missing an apostrophe. The correct spelling is 'couldn't'.",
  "steps": [], "hint": "Check every contraction — does it have its apostrophe?",
  "videoTopic": "apostrophes contractions", "videoSource": "BBC Bitesize"
}

SPELLING EXAMPLE:
{
  "level": "${level}", "type": "english", "topic": "Spelling", "marks": "1 mark",
  "text": "Find the section with the spelling mistake. If there is no mistake, mark N.",
  "segments": ["The children were", "absolutly thrilled", "to visit the new", "science museum."],
  "options": ["A. The children were", "B. absolutly thrilled", "C. to visit the new", "D. science museum.", "N. No mistake"],
  "answer": "B",
  "explanation": "'absolutly' is misspelled. The correct spelling is 'absolutely'.",
  "steps": [], "hint": "Say each word carefully in your head. Does any word look wrong?",
  "videoTopic": "spelling rules suffixes", "videoSource": "BBC Bitesize"
}

GRAMMAR EXAMPLE:
{
  "level": "${level}", "type": "english", "topic": "Grammar", "marks": "1 mark",
  "text": "Choose the best word to complete the sentence.",
  "segments": [], "context": "The horses bolted _____ the stable as fast as their legs could carry them.",
  "options": ["A. across", "B. through", "C. on", "D. within", "E. in"],
  "answer": "B",
  "explanation": "'Through' is the correct preposition — the horses ran through the stable door.",
  "steps": [], "hint": "Think about which word best describes the movement in the sentence.",
  "videoTopic": "prepositions grammar", "videoSource": "BBC Bitesize"
}

MATHS EXAMPLE:
{
  "level": "${level}", "type": "maths", "topic": "Fractions", "marks": "2 marks",
  "text": "A baker makes 120 rolls. She gives away one quarter of them. How many rolls does she have left?",
  "segments": [],
  "options": ["A. 30", "B. 60", "C. 80", "D. 90", "E. 100"],
  "answer": "D",
  "explanation": "One quarter of 120 = 120 ÷ 4 = 30. Rolls left = 120 - 30 = 90.",
  "steps": ["120 ÷ 4 = 30 (one quarter given away)", "120 - 30 = 90 rolls remaining"],
  "hint": "Find one quarter by dividing by 4, then subtract from the total.",
  "videoTopic": "fractions of amounts", "videoSource": "CorbettMaths"
}`;

  try {
    console.log('Calling Anthropic API for level:', level);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: mockMode ? 12000 : 4000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `Generate ${mockMode ? '66' : '10'} fresh original SEAG questions for ${level}${topicMode ? ` focused ONLY on the topic: "${topic}"` : ''}${mockMode ? ' in full mock format' : ''}.

${topicMode ? `TOPIC SPRINT RULES:
- ALL 10 questions must be about "${topic}" — no other topics allowed
- Vary the style: some straightforward, some applied word problems, some multi-step
- Vary the difficulty: start easier, build to harder
- Do NOT mix in other topics even if the count seems uneven

` : ''}MANDATORY SELF-CHECK before returning:
1. Copyright: All scenarios, names and sentences completely original?
2. No mistake: Every Punctuation/Spelling 5th option EXACTLY "N. No mistake" not "E. No mistake"?
3. No mistake: Answer is "N" (not "E") for no-mistake questions?
4. Punctuation: No optional commas used as errors?
5. Punctuation instruction text: If the error is a capital letter, does the text field say "punctuation or capital letter mistake"?
6. Maths: Correct answer actually listed in A/B/C/D/E options?
7. Content: All suitable for ages 9-11?
8. Format: Is the root element {"questions": [...]} with exactly that key?
${topicMode ? `9. Topic sprint: Are ALL 10 questions genuinely about "${topic}"?` : ''}

Return JSON only. The root MUST be {"questions": [...10 questions...]}. No other text before or after.`
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      return res.status(500).json({ error: 'Failed to generate questions — please try again', detail: response.status });
    }

    const data = await response.json();
    console.log('Stop reason:', data.stop_reason);

    if (!data.content || !data.content.length) {
      return res.status(500).json({ error: 'Empty response — please try again' });
    }

    const text = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    if (!text) {
      return res.status(500).json({ error: 'No content returned — please try again' });
    }

    console.log('Text length:', text.length);
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr.message);
      console.error('Raw text preview:', clean.substring(0, 500));
      return res.status(500).json({ error: 'Could not parse questions — please try again' });
    }

    // Handle both {questions:[]} and direct [] formats
    if (Array.isArray(parsed)) {
      console.log('Model returned array directly — wrapping');
      parsed = { questions: parsed };
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error('No questions array. Keys:', Object.keys(parsed));
      return res.status(500).json({ error: 'Invalid question format — please try again' });
    }

    console.log('Questions count:', parsed.questions.length);

    /* ══════════════════════════════════════════════════
       SERVER-SIDE SAFETY VALIDATION — 4 LAYERS
    ══════════════════════════════════════════════════ */
    parsed.questions.forEach((q, idx) => {

      // ── Layer 1: Force "N. No mistake" on option and answer ──
      if (q.topic === 'Punctuation' || q.topic === 'Spelling') {
        if (q.options && Array.isArray(q.options)) {
          q.options = q.options.map((opt, i) => {
            const lower = (opt || '').toLowerCase().trim();
            if (lower.includes('no mistake') || lower === 'n. no mistake') {
              const thisLetter = ['A','B','C','D','E'][i];
              if (q.answer === thisLetter) {
                console.warn(`Q${idx+1}: Fixing answer from ${q.answer} to N`);
                q.answer = 'N';
              }
              return 'N. No mistake';
            }
            return opt;
          });
        }
        if (q.answer === 'E' && q.options && q.options.length === 5) {
          const last = (q.options[4] || '').toLowerCase();
          if (last.includes('no mistake')) {
            q.answer = 'N';
            q.options[4] = 'N. No mistake';
          }
        }
      }

      // ── Layer 2: Catch explanation contradicting answer ──
      if (q.topic === 'Punctuation' || q.topic === 'Spelling') {
        const exp = (q.explanation || '').toLowerCase();
        const noMistake =
          exp.includes('no mistake') ||
          exp.includes('all spelling') ||
          exp.includes('all punctuation') ||
          exp.includes('all words are') ||
          exp.includes('correctly spelled') ||
          exp.includes('correct in this sentence') ||
          exp.includes('there is no error') ||
          exp.includes('no errors') ||
          exp.includes('are all correct');
        if (noMistake && q.answer !== 'N') {
          console.warn(`Q${idx+1}: Explanation says no mistake but answer is ${q.answer} — fixing to N`);
          q.answer = 'N';
        }
      }

      // ── Layer 3: Build exact resource URLs from lookup tables ──
      const videoTopic = (q.videoTopic || q.topic || '').toLowerCase().trim();
      const source = (q.videoSource || '').trim();

      if (source === 'CorbettMaths') {
        q.videoUrl = getCorbettUrl(videoTopic);
      } else {
        q.videoUrl = getBBCUrl(videoTopic);
      }

      console.log(`Q${idx+1} [${q.topic}] "${videoTopic}" → ${q.videoUrl}`);

      // ── Layer 4: Fix instruction text for capital letter questions ──
      if (q.topic === 'Punctuation') {
        const exp = (q.explanation || '').toLowerCase();
        const isCapitalError =
          exp.includes('capital letter') ||
          exp.includes('proper noun') ||
          exp.includes('days of the week') ||
          exp.includes('months of the year') ||
          exp.includes('place name') ||
          exp.includes("person's name") ||
          exp.includes('should be capitalised') ||
          exp.includes('should have a capital');

        const textField = (q.text || '').toLowerCase();
        const alreadyMentionsCapital = textField.includes('capital');

        if (isCapitalError && !alreadyMentionsCapital) {
          console.warn(`Q${idx+1}: Fixing instruction text for capital error`);
          q.text = 'Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.';
        }
      }

      // ── Ensure required fields exist ──
      if (!q.hint)     q.hint     = 'Think carefully about each option.';
      if (!q.steps)    q.steps    = [];
      if (!q.segments) q.segments = [];
      if (!q.context)  q.context  = '';

    });

    console.log(`Successfully generated ${parsed.questions.length} questions for ${level}`);
    return res.status(200).json(parsed);

  } catch (error) {
    console.error('Unexpected server error:', error);
    return res.status(500).json({ error: 'Server error — please try again', detail: error.message });
  }
}
