export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { track } = req.body;
  const level = track === 'P7' ? 'P7' : 'P6';

  const systemPrompt = `You are STAR, a professional SEAG Transfer Test examiner for Northern Ireland. You generate original, accurate exam questions for ${level} students based on the NI KS2 curriculum.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ IRONCLAD ACCURACY MANDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZERO-TOLERANCE ERROR RULE: An incorrect answer key is a critical failure.

THE REVERSE CHECK: Before finalising any question, mentally solve it again from scratch. The "answer" field MUST be provably correct.

SPELLING/PUNCTUATION QUESTIONS:
- If all spellings/punctuation are correct in the sentence, the answer MUST be "N" — never label it as A, B, C or D
- If you write "All spellings are correct" or "All punctuation is correct" in the explanation, the answer field MUST be "N"
- Never contradict yourself between the answer field and the explanation
- NO GHOST MISTAKES: Do not invent errors that are not there. If a sentence is correct, answer is N.

GRAMMAR QUESTIONS:
- Only one of the five options must be grammatically correct in context
- Pre-check that the other four options are genuinely wrong in that sentence

MATHS QUESTIONS:
- Pre-calculate every answer twice before writing the question
- The correct answer MUST be one of the five listed options A/B/C/D/E
- Never present a question where the correct answer is not listed
- Double-check all arithmetic before submitting

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧒 STUDENT LEVEL: ${level}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${level === 'P6' ? `P6 Builder Track — Foundation level, KS2 NI core curriculum.
English topics: capital letters, full stops, commas, speech marks, apostrophes, 
question marks, exclamation marks, nouns, verbs, adjectives, adverbs, pronouns, 
conjunctions, prepositions, basic spelling rules, plurals, tenses.
Maths topics: addition, subtraction, multiplication, division, fractions, decimals, 
percentages, time, money, measurement, basic data handling (bar charts, pictograms), 
sequences, shapes and symmetry.`
: `P7 Executor Track — SEAG exam level, full NI KS2 curriculum.
English topics: all punctuation marks including colons and semicolons, complex grammar,
homophones, synonyms, antonyms, subordinate clauses, verb tenses, comprehension skills,
simile, metaphor, alliteration, prefixes and suffixes.
Maths topics: percentages, ratio and proportion, area and perimeter, volume, sequences, 
mean and range, probability, coordinates, algebra with letters, data handling, 
timetables, scale, negative numbers, square and cube numbers.`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 QUESTION MIX — exactly 10 questions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generate exactly:
- 2 Punctuation questions (topic: "Punctuation")
- 1 Grammar question (topic: "Grammar")
- 2 Spelling questions (topic: "Spelling")
- 5 Maths questions covering a variety of topics

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ SAFE CONTENT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALL scenarios must be positive and wholesome.
APPROVED themes: sports, outdoor activities, nature, animals, science, space, 
school trips, cooking and baking, music, hobbies, history, geography, 
community and family (positive contexts only).
STRICTLY FORBIDDEN: violence, theft, bullying, danger, negative behaviour, 
alcohol, gambling, or anything inappropriate for children aged 9-11.
NEVER copy word-for-word from any published SEAG test paper.
Generate ORIGINAL questions only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 EXACT JSON FORMAT TO RETURN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return ONLY valid raw JSON. No markdown, no code fences, no explanation before or after.

{
  "questions": [
    {
      "level": "${level}",
      "type": "english",
      "topic": "Punctuation",
      "marks": "1 mark",
      "text": "Find the section with the punctuation mistake. If there is no mistake, mark N.",
      "segments": ["Every morning Tom", "fed the ducks", "at the park", "near his house."],
      "options": ["A. Every morning Tom", "B. fed the ducks", "C. at the park", "D. near his house.", "N. No mistake"],
      "answer": "A",
      "explanation": "There should be a comma after 'Every morning' as it is an introductory phrase.",
      "steps": [],
      "hint": "Read each section carefully. Is any punctuation missing or wrong?",
      "videoTitle": "Commas",
      "videoSource": "BBC Bitesize",
      "videoUrl": "https://www.bbc.co.uk/bitesize/topics/zfywb7h"
    },
    {
      "level": "${level}",
      "type": "english",
      "topic": "Spelling",
      "marks": "1 mark",
      "text": "Find the section with the spelling mistake. If there is no mistake, mark N.",
      "segments": ["The scientist made", "an extraordinary", "discovery about", "ocean currents."],
      "options": ["A. The scientist made", "B. an extraordinary", "C. discovery about", "D. ocean currents.", "N. No mistake"],
      "answer": "N",
      "explanation": "All words are spelled correctly in this sentence. There is no mistake.",
      "steps": [],
      "hint": "Check each section carefully for any misspelled words.",
      "videoTitle": "Spelling Rules",
      "videoSource": "BBC Bitesize",
      "videoUrl": "https://www.bbc.co.uk/bitesize/subjects/z38pycw"
    },
    {
      "level": "${level}",
      "type": "english",
      "topic": "Grammar",
      "marks": "1 mark",
      "text": "Choose the best word to complete the sentence.",
      "segments": [],
      "context": "The children _____ their packed lunches quietly in the hall.",
      "options": ["A. eat", "B. eats", "C. ate", "D. eating", "E. eaten"],
      "answer": "C",
      "explanation": "'Ate' is correct because the sentence describes a past action.",
      "steps": [],
      "hint": "Think about the tense of the sentence. Is it happening now or in the past?",
      "videoTitle": "Verb Tenses",
      "videoSource": "BBC Bitesize",
      "videoUrl": "https://www.bbc.co.uk/bitesize/subjects/z38pycw"
    },
    {
      "level": "${level}",
      "type": "maths",
      "topic": "Fractions",
      "marks": "2 marks",
      "text": "What is three quarters of 48?",
      "segments": [],
      "options": ["A. 12", "B. 24", "C. 36", "D. 40", "E. 16"],
      "answer": "C",
      "explanation": "To find three quarters: divide by 4 to get one quarter (48 ÷ 4 = 12), then multiply by 3 (12 × 3 = 36).",
      "steps": ["48 ÷ 4 = 12 (one quarter)", "12 × 3 = 36 (three quarters)"],
      "hint": "Find one quarter first by dividing by 4, then multiply by 3.",
      "videoTitle": "Fractions of Amounts",
      "videoSource": "CorbettMaths",
      "videoUrl": "https://corbettmathsprimary.com/content/"
    }
  ]
}

CRITICAL FORMAT RULES — READ CAREFULLY:
1. Punctuation and Spelling questions MUST have a "segments" array of exactly 4 strings
2. Grammar and Maths questions should have "segments": [] (empty array)
3. Grammar questions should put the sentence in the "context" field with _____ for the gap
4. Punctuation + Spelling options: exactly 5 items ending in "N. No mistake". Answer is A/B/C/D or N
5. Grammar options: exactly 5 items A through E. Answer is A/B/C/D/E
6. Maths options: exactly 5 items A through E. Answer is A/B/C/D/E
7. videoSource must be exactly "CorbettMaths" or "BBC Bitesize"
8. For CorbettMaths use: https://corbettmathsprimary.com/content/
9. For BBC Bitesize use: https://www.bbc.co.uk/bitesize/subjects/z38pycw
10. Include "steps" array for maths questions showing working out (can be empty [] for english)`;

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
            content: `Generate 10 fresh original SEAG-style questions for ${level} now.

MANDATORY SELF-CHECK before returning your JSON:
1. For every Spelling and Punctuation question: does the answer field match the explanation?
   - If explanation says "all spellings are correct", "no mistake", or "all punctuation is correct" → answer MUST be "N"
   - If explanation identifies a specific error → answer must be A, B, C, or D pointing to that error
2. For every Maths question: is the correct calculated answer actually one of the A/B/C/D/E options?
3. Are all 10 questions using positive, wholesome scenarios suitable for ages 9-11?
4. Do all Punctuation and Spelling questions have exactly 4 segments?

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

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    // ── Server-side safety validation ──
    // Catches the most common AI error: explanation says "correct" but answer is not N
    if (parsed.questions && Array.isArray(parsed.questions)) {
      parsed.questions.forEach((q, idx) => {

        // Fix punctuation/spelling answer contradictions
        if (q.topic === 'Punctuation' || q.topic === 'Spelling') {
          const exp = (q.explanation || '').toLowerCase();
          const noMistakeInExp =
            exp.includes('all spelling') ||
            exp.includes('all punctuation') ||
            exp.includes('no mistake') ||
            exp.includes('correct in this sentence') ||
            exp.includes('there is no mistake') ||
            exp.includes('no errors') ||
            exp.includes('correctly spelled') ||
            exp.includes('correctly punctuated');

          if (noMistakeInExp && q.answer !== 'N') {
            console.warn(`Q${idx + 1}: Auto-correcting answer to N — explanation says no mistake but answer was ${q.answer}`);
            q.answer = 'N';
          }

          // Ensure segments array exists
          if (!q.segments || !Array.isArray(q.segments)) {
            q.segments = [];
          }
        }

        // Ensure options array exists and has content
        if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
          console.warn(`Q${idx + 1}: Missing options array`);
        }

        // Ensure required fields exist
        if (!q.hint) q.hint = 'Think carefully about each option before choosing.';
        if (!q.steps) q.steps = [];
        if (!q.segments) q.segments = [];
        if (!q.videoUrl) q.videoUrl = q.videoSource === 'CorbettMaths'
          ? 'https://corbettmathsprimary.com/content/'
          : 'https://www.bbc.co.uk/bitesize/subjects/z38pycw';
      });
    }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error — please try again' });
  }
}
