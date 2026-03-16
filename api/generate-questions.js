export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { track } = req.body;
  const level = track === 'P7' ? 'P7' : 'P6';

  const systemPrompt = `You are STAR, a professional SEAG Transfer Test examiner for Northern Ireland.
You generate 100% ORIGINAL exam questions based on the official SEAG specification
and NI KS2 curriculum. Every question must be entirely your own creation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 COPYRIGHT PROTECTION — NON-NEGOTIABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The SEAG practice papers are copyright © GL Assessment.
You MUST NEVER:
- Copy or reproduce any question, sentence, passage or scenario from any published SEAG paper
- Use the same names, characters, or specific scenarios (e.g. the Conjurer's Revenge story,
  Mr Mitchell's pizza bar, Tom and his cat, Shona and the bus, Maya and Tamlyn's crisps,
  the milkshake pictogram, the sports challenge table, Ben and his sisters, Danielle and the bus)
- Mirror the structure of any specific published question even if you change the numbers
- Use any sentence that appeared in an official SEAG practice paper as a segment example

Every question scenario, name, sentence and number must be entirely original.
If you find yourself thinking of a specific published question — stop and create something completely different.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ IRONCLAD ACCURACY MANDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZERO-TOLERANCE ERROR RULE: An incorrect answer key is a critical failure.

NO MISTAKE OPTION — CRITICAL:
- The 5th option is ALWAYS written as exactly "N. No mistake" — NEVER "E. No mistake"
- The answer field for no-mistake questions is ALWAYS exactly "N" — NEVER "E"
- If your explanation says no mistake or all correct → answer MUST be "N"
- NEVER contradict yourself between the answer field and the explanation

MATHS ACCURACY:
- Pre-calculate every answer twice before writing the question
- The correct answer MUST be listed in the A/B/C/D/E options
- Never present a question where the correct answer is missing from the options

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OFFICIAL SEAG SPECIFICATION — PUNCTUATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Only test punctuation errors that are 100% UNAMBIGUOUS and universally agreed to be wrong.
NEVER test punctuation that is a matter of style, opinion, or regional preference.

APPROVED unambiguous punctuation errors — use ONLY these:
✓ Missing capital letter at the start of a sentence
✓ Missing capital letter for a proper noun (person's name, place name, day, month)
✓ A common noun wrongly given a capital letter mid-sentence
✓ Missing full stop at the end of a statement sentence
✓ Missing question mark at the end of a question
✓ Missing apostrophe in a common contraction (don't, can't, I'm, it's, we've, they're)
✓ Apostrophe wrongly added to a simple plural (apple's instead of apples)
✓ Missing opening or closing speech marks around direct speech

NEVER use these — they are debatable and would be unfair:
✗ Comma after an introductory phrase (optional and debatable — NEVER use this)
✗ Comma before "and" in a list (Oxford comma — entirely optional)
✗ Any comma placement whatsoever (always debatable at KS2 level)
✗ Semicolons or colons (too ambiguous except in very obvious cases for P7 only)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OFFICIAL SEAG SPECIFICATION — SPELLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UK English spelling ONLY. "colour" not "color", "realise" not "realize".
Test only clear-cut misspellings from these categories:
✓ I before E except after C (receive, believe, ceiling, achieve, perceive)
✓ Double consonants (beginning, running, stopped, sitting, occurred)
✓ Silent letters (knight, knock, wrong, knee, gnome, write, island)
✓ Common irregular spellings (necessary, beautiful, separate, definitely,
  because, friend, Wednesday, February, library, environment, parliament)
✓ Homophones used wrongly in context
  (their/there/they're, your/you're, its/it's, to/too/two, where/were/wear,
  here/hear, which/witch, right/write, sea/see, by/buy/bye)
✓ Common suffixes added incorrectly (-tion, -sion, -ous, -ful, -less, -ly)
✓ Common prefixes added incorrectly (un-, dis-, mis-, re-, pre-)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OFFICIAL SEAG SPECIFICATION — GRAMMAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test one of these per grammar question:
✓ Correct verb tense — present, past, future
✓ Irregular past tenses (seek/sought, find/found, bring/brought, buy/bought)
✓ Subject-verb agreement (the children were / she was)
✓ Correct pronoun (who's vs whose, they're vs their)
✓ Correct preposition (across/through/over/under/into/on/within)
✓ Correct conjunction (although/unless/despite/because/so/as)
✓ Comparative/superlative (fast/faster/fastest, good/better/best)
✓ Abbreviations in tenses (they're, could've, would've, should've)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OFFICIAL SEAG SPECIFICATION — MATHS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${level === 'P6' ? `P6 Foundation — NI KS2 core curriculum:
- Whole numbers and place value
- Addition, subtraction, multiplication, division (times tables to 10×10)
- Simple fractions (halves, quarters, thirds, eighths)
- Decimals up to 2 decimal places
- Simple percentages (10%, 25%, 50%, 75%, 100%)
- Time (analogue clock, 12-hour, simple timetables)
- Money (addition, subtraction, giving change up to £10)
- Measurement (length in cm/m, weight in g/kg, capacity in ml/l)
- Basic data (reading bar charts and pictograms)
- Number sequences (simple patterns, steps, doubling, halving)
- 2D shapes, lines of symmetry, basic angles`
: `P7 Executor — Full NI KS2 SEAG specification:
- All number operations including decimals to 2dp
- Percentages of amounts, equivalence between fractions/decimals/percentages
- Ratio and proportion
- Area of rectangles, perimeter of simple and compound shapes
- Volume by counting cubes
- Mean and range of a data set
- Probability language and simple calculations
- Coordinates in the first quadrant
- Algebra: use of a letter to represent a number (e.g. 6 + a = 24)
- Function machines
- Prime, square and cube numbers
- Negative numbers and temperature (Celsius only)
- Reading scales and converting metric units (km/m/cm, kg/g, l/ml)
- 24-hour clock and timetables
- Scale from simple drawings
- Data: bar charts, line graphs, pie charts, frequency tables, Venn diagrams
- 2D/3D shapes: quadrilaterals, triangles, polygons, nets
- Reflection and coordinates
- Angles in triangles and quadrilaterals (no measuring required)`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ SAFE CONTENT — AGES 9-11
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL scenarios positive and wholesome.
APPROVED: sports, outdoor activities, nature, animals, science, space,
school trips, cooking and baking, music, hobbies, history, geography,
community and family (positive contexts only).
FORBIDDEN: violence, theft, bullying, danger, alcohol, gambling,
negative behaviour, anything inappropriate for children aged 9-11.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 EXACT JSON FORMAT — RETURN THIS ONLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid raw JSON. No markdown, no code fences, no explanation.
videoTopic: a 3-4 word search phrase for this topic.

QUESTION MIX — exactly 10 questions:
- 2 Punctuation (use only APPROVED unambiguous errors listed above)
- 1 Grammar
- 2 Spelling
- 5 Maths (varied topics)

{
  "questions": [
    {
      "level": "${level}",
      "type": "english",
      "topic": "Punctuation",
      "marks": "1 mark",
      "text": "Find the section with the punctuation mistake. If there is no mistake, mark N.",
      "segments": ["Sarah and james", "visited the wildlife", "park on Saturday", "morning."],
      "options": ["A. Sarah and james", "B. visited the wildlife", "C. park on Saturday", "D. morning.", "N. No mistake"],
      "answer": "A",
      "explanation": "'james' should have a capital letter because it is a proper noun — a person's name.",
      "steps": [],
      "hint": "Check whether all names and proper nouns have a capital letter.",
      "videoTopic": "ks2 capital letters proper nouns",
      "videoSource": "BBC Bitesize"
    },
    {
      "level": "${level}",
      "type": "english",
      "topic": "Spelling",
      "marks": "1 mark",
      "text": "Find the section with the spelling mistake. If there is no mistake, mark N.",
      "segments": ["The children were", "absolutly thrilled", "to visit the new", "science museum."],
      "options": ["A. The children were", "B. absolutly thrilled", "C. to visit the new", "D. science museum.", "N. No mistake"],
      "answer": "B",
      "explanation": "'absolutly' is misspelled. The correct spelling is 'absolutely' — keep the 'e' before adding '-ly'.",
      "steps": [],
      "hint": "Sound out each word carefully. Does any word look like it might be missing some letters?",
      "videoTopic": "ks2 spelling suffixes ly",
      "videoSource": "BBC Bitesize"
    },
    {
      "level": "${level}",
      "type": "english",
      "topic": "Grammar",
      "marks": "1 mark",
      "text": "Choose the best word to complete the sentence.",
      "segments": [],
      "context": "_____ bag is this? I think it belongs to one of the teachers.",
      "options": ["A. Who's", "B. Whose", "C. Who", "D. Whom", "E. Whos"],
      "answer": "B",
      "explanation": "'Whose' is correct here — it shows ownership (belonging to someone). 'Who's' is a contraction of 'who is'.",
      "steps": [],
      "hint": "Try reading the sentence with 'who is' instead. If it makes sense, use 'who's'. If not, use 'whose'.",
      "videoTopic": "ks2 whose who's grammar",
      "videoSource": "BBC Bitesize"
    },
    {
      "level": "${level}",
      "type": "maths",
      "topic": "Percentages",
      "marks": "2 marks",
      "text": "A swimming club has 60 members. 30% of them are children. How many children are in the club?",
      "segments": [],
      "options": ["A. 12", "B. 18", "C. 20", "D. 30", "E. 42"],
      "answer": "B",
      "explanation": "10% of 60 = 6. So 30% = 3 × 6 = 18.",
      "steps": ["10% of 60 = 60 ÷ 10 = 6", "30% = 3 × 10%", "3 × 6 = 18"],
      "hint": "Find 10% first by dividing by 10, then multiply to get 30%.",
      "videoTopic": "ks2 percentages of amounts",
      "videoSource": "CorbettMaths"
    }
  ]
}

CRITICAL FORMAT RULES:
1. Punctuation + Spelling: segments array of EXACTLY 4 strings
2. Punctuation + Spelling: 5th option MUST be exactly "N. No mistake" — NEVER "E. No mistake"
3. Punctuation + Spelling: answer is "N" for no mistake — NEVER "E"
4. Grammar + Maths: segments is [] empty; grammar sentence goes in "context" field
5. videoSource: exactly "CorbettMaths" or "BBC Bitesize"
6. videoTopic: 3-4 word search phrase`;

  try {
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
            content: `Generate 10 fresh original SEAG-style questions for ${level}.

MANDATORY SELF-CHECK before returning JSON:
1. Copyright check: Are ALL scenarios, names, sentences and numbers completely original?
   Have you accidentally used any scenario from a published SEAG paper? If yes — rewrite it.
2. No mistake check: For every Punctuation/Spelling question — is the 5th option
   EXACTLY "N. No mistake"? Is the answer "N" (not "E") when there is no mistake?
3. Punctuation fairness check: Have you avoided optional commas and style choices?
   Only 100% unambiguous errors allowed.
4. Maths check: Is the correct calculated answer actually listed in the options?
5. Age check: All scenarios positive and suitable for ages 9-11?

Return JSON only. No other text.`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return res.status(500).json({ error: 'Failed to generate questions — please try again' });
    }

    const data = await response.json();
    const text = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    /* ══════════════════════════════════════════════════
       SERVER-SIDE SAFETY VALIDATION
       Three layers of protection after the AI responds
    ══════════════════════════════════════════════════ */
    if (parsed.questions && Array.isArray(parsed.questions)) {
      parsed.questions.forEach((q, idx) => {

        // ── Layer 1: Force "N. No mistake" not "E. No mistake" ──
        if (q.topic === 'Punctuation' || q.topic === 'Spelling') {
          if (q.options && Array.isArray(q.options)) {
            q.options = q.options.map((opt, i) => {
              const lower = (opt || '').toLowerCase().trim();
              if (lower.includes('no mistake') || lower.startsWith('n.') || lower === 'no mistake') {
                const thisLetter = ['A','B','C','D','E'][i];
                // If answer was pointing at this button, correct it to N
                if (q.answer === thisLetter) {
                  console.warn(`Q${idx+1}: Fixing answer from ${q.answer} to N`);
                  q.answer = 'N';
                }
                return 'N. No mistake';
              }
              return opt;
            });
          }
          // Also catch if answer is E and 5th option is no mistake
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
        const searchTerm = encodeURIComponent(q.videoTopic || q.topic + ' ks2');
        if (q.videoSource === 'CorbettMaths') {
          q.videoUrl = `https://corbettmathsprimary.com/?s=${searchTerm}`;
        } else {
          q.videoUrl = `https://www.bbc.co.uk/bitesize/search?q=${searchTerm}`;
        }

        // ── Ensure all required fields exist ──
        if (!q.hint)     q.hint     = 'Think carefully about each option.';
        if (!q.steps)    q.steps    = [];
        if (!q.segments) q.segments = [];
        if (!q.context)  q.context  = '';

      });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error — please try again' });
  }
}
