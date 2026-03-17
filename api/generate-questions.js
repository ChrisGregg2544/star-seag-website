export default async function handler(req, res) {

  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { track } = req.body || {};
  const level = track === 'P7' ? 'P7' : 'P6';

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

NEVER write "punctuation mistake" when the error is a capital letter. A student who
answers N on a capital letter question labelled only as "punctuation" cannot be marked wrong.
This is a critical commercial quality failure. Always match the instruction to the error type.

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
🛡️ SAFE CONTENT — AGES 9-11
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL scenarios positive and wholesome.
APPROVED: sports, nature, animals, science, space, school trips, cooking,
music, hobbies, history, geography, family (positive contexts only).
FORBIDDEN: violence, theft, bullying, danger, alcohol, gambling.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 JSON FORMAT — RETURN THIS ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid raw JSON. No markdown, no code fences, no explanation.
videoTopic field: 3-4 word search phrase for this topic.

Generate exactly 10 questions:
- 2 Punctuation
- 1 Grammar
- 2 Spelling
- 5 Maths (varied topics)

PUNCTUATION EXAMPLE — capital letter error (note the instruction text):
{
  "level": "${level}",
  "type": "english",
  "topic": "Punctuation",
  "marks": "1 mark",
  "text": "Find the section with the punctuation or capital letter mistake. If there is no mistake, mark N.",
  "segments": ["Sarah and james", "visited the wildlife", "park on Saturday", "morning."],
  "options": ["A. Sarah and james", "B. visited the wildlife", "C. park on Saturday", "D. morning.", "N. No mistake"],
  "answer": "A",
  "explanation": "'james' should have a capital letter because it is a proper noun — a person's name.",
  "steps": [],
  "hint": "Check whether all names and proper nouns have a capital letter.",
  "videoTopic": "ks2 capital letters proper nouns",
  "videoSource": "BBC Bitesize"
}

PUNCTUATION EXAMPLE — apostrophe error (note the instruction text):
{
  "level": "${level}",
  "type": "english",
  "topic": "Punctuation",
  "marks": "1 mark",
  "text": "Find the section with the punctuation mistake. If there is no mistake, mark N.",
  "segments": ["We couldnt believe", "how fast the", "cheetah ran across", "the open plain."],
  "options": ["A. We couldnt believe", "B. how fast the", "C. cheetah ran across", "D. the open plain.", "N. No mistake"],
  "answer": "A",
  "explanation": "'couldnt' is missing an apostrophe. The correct spelling is 'couldn't'.",
  "steps": [],
  "hint": "Check every contraction — does it have its apostrophe?",
  "videoTopic": "ks2 apostrophes contractions",
  "videoSource": "BBC Bitesize"
}

SPELLING EXAMPLE:
{
  "level": "${level}",
  "type": "english",
  "topic": "Spelling",
  "marks": "1 mark",
  "text": "Find the section with the spelling mistake. If there is no mistake, mark N.",
  "segments": ["The children were", "absolutly thrilled", "to visit the new", "science museum."],
  "options": ["A. The children were", "B. absolutly thrilled", "C. to visit the new", "D. science museum.", "N. No mistake"],
  "answer": "B",
  "explanation": "'absolutly' is misspelled. The correct spelling is 'absolutely'.",
  "steps": [],
  "hint": "Say each word carefully in your head. Does any word look wrong?",
  "videoTopic": "ks2 spelling rules suffixes",
  "videoSource": "BBC Bitesize"
}

GRAMMAR EXAMPLE:
{
  "level": "${level}",
  "type": "english",
  "topic": "Grammar",
  "marks": "1 mark",
  "text": "Choose the best word to complete the sentence.",
  "segments": [],
  "context": "The horses bolted _____ the stable as fast as their legs could carry them.",
  "options": ["A. across", "B. through", "C. on", "D. within", "E. in"],
  "answer": "B",
  "explanation": "'Through' is the correct preposition — the horses ran through the stable door.",
  "steps": [],
  "hint": "Think about which word best describes the movement in the sentence.",
  "videoTopic": "ks2 prepositions grammar",
  "videoSource": "BBC Bitesize"
}

MATHS EXAMPLE:
{
  "level": "${level}",
  "type": "maths",
  "topic": "Fractions",
  "marks": "2 marks",
  "text": "A baker makes 120 rolls. She gives away one quarter of them. How many rolls does she have left?",
  "segments": [],
  "options": ["A. 30", "B. 60", "C. 80", "D. 90", "E. 100"],
  "answer": "D",
  "explanation": "One quarter of 120 = 120 ÷ 4 = 30. Rolls left = 120 - 30 = 90.",
  "steps": ["120 ÷ 4 = 30 (one quarter given away)", "120 - 30 = 90 rolls remaining"],
  "hint": "Find one quarter by dividing by 4, then subtract from the total.",
  "videoTopic": "ks2 fractions of amounts",
  "videoSource": "CorbettMaths"
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Generate 10 fresh original SEAG questions for ${level}.

MANDATORY SELF-CHECK before returning:
1. Copyright: All scenarios, names and sentences completely original? Not from any published SEAG paper?
2. No mistake: Every Punctuation/Spelling 5th option EXACTLY "N. No mistake" not "E. No mistake"?
3. No mistake: Answer is "N" (not "E") for no-mistake questions?
4. Punctuation: No optional commas used as errors?
5. Punctuation instruction text: If the error is a capital letter, does the text field say "punctuation or capital letter mistake"? If the error is apostrophe/full stop/speech marks only, does it say "punctuation mistake"?
6. Maths: Correct answer actually listed in A/B/C/D/E options?
7. Content: All suitable for ages 9-11?

Return JSON only. No other text before or after.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error status:', response.status, errorText);
      return res.status(500).json({
        error: 'Failed to generate questions — please try again',
        detail: response.status
      });
    }

    const data = await response.json();

    if (!data.content || !data.content.length) {
      console.error('Empty response from Anthropic');
      return res.status(500).json({ error: 'Empty response — please try again' });
    }

    const text = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    if (!text) {
      console.error('No text in response');
      return res.status(500).json({ error: 'No content returned — please try again' });
    }

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw text:', clean.substring(0, 200));
      return res.status(500).json({ error: 'Could not parse questions — please try again' });
    }

    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.error('No questions array in parsed response');
      return res.status(500).json({ error: 'Invalid question format — please try again' });
    }

    /* ══════════════════════════════════════════════════
       SERVER-SIDE SAFETY VALIDATION — 4 LAYERS
    ══════════════════════════════════════════════════ */
    parsed.questions.forEach((q, idx) => {

      // ── Layer 1: Force "N. No mistake" — never "E. No mistake" ──
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
        // Also catch if answer is E and last option contains no mistake
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

      // ── Layer 3: Build working search video URLs ──
      const searchTerm = encodeURIComponent(q.videoTopic || (q.topic + ' ks2'));
      if (q.videoSource === 'CorbettMaths') {
        q.videoUrl = `https://corbettmathsprimary.com/?s=${searchTerm}`;
      } else {
        q.videoUrl = `https://www.bbc.co.uk/bitesize/search?q=${searchTerm}`;
      }

      // ── Layer 4: Fix instruction text for capital letter questions ──
      // If the explanation mentions capital letters but the question text says
      // only "punctuation mistake", upgrade the instruction to include capitals.
      if (q.topic === 'Punctuation') {
        const exp = (q.explanation || '').toLowerCase();
        const isCapitalError =
          exp.includes('capital letter') ||
          exp.includes('proper noun') ||
          exp.includes('days of the week') ||
          exp.includes('months of the year') ||
          exp.includes('place name') ||
          exp.includes('person\'s name') ||
          exp.includes('should be capitalised') ||
          exp.includes('should have a capital');

        const textField = (q.text || '').toLowerCase();
        const alreadyMentionsCapital = textField.includes('capital');

        if (isCapitalError && !alreadyMentionsCapital) {
          console.warn(`Q${idx+1}: Capital letter error but instruction only says "punctuation" — fixing instruction text`);
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
    return res.status(500).json({
      error: 'Server error — please try again',
      detail: error.message
    });
  }
}
