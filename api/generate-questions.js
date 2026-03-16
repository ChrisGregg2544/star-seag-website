export default async function handler(req, res) {
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { track } = req.body;
  const level = track === 'P7' ? 'P7' : 'P6';

  const systemPrompt = `You are STAR, a professional SEAG Transfer Test examiner for Northern Ireland.
Generate exactly 10 original exam questions for ${level} students based on the NI KS2 curriculum.

STRICT RULES:
- All scenarios must be positive and wholesome (sports, nature, school, cooking, animals, science)
- NEVER mention violence, theft, bullying, danger, alcohol or anything inappropriate for ages 9-11
- All questions must be completely original — never copy from published papers
- Pre-calculate every maths answer twice before including it
- The correct answer MUST always be one of the listed options

QUESTION MIX for ${level}:
${level === 'P6' ? `
- 2 Punctuation questions (spot the mistake in a sentence broken into 4 segments A/B/C/D, or N for no mistake)
- 1 Grammar question (choose best word to complete sentence, options A/B/C/D/E)
- 2 Spelling questions (spot the misspelled word in segments A/B/C/D, or N for no mistake)
- 5 Maths questions covering: fractions, money, multiplication, time, basic data (bar charts or pictograms)
` : `
- 2 Punctuation questions (spot the mistake in segments A/B/C/D, or N for no mistake)  
- 1 Grammar question (choose best word, options A/B/C/D/E)
- 2 Spelling questions (spot the mistake in segments A/B/C/D, or N for no mistake)
- 5 Maths questions covering: percentages, ratio, area/perimeter, sequences, mean/averages
`}

Return ONLY valid raw JSON — no markdown, no code fences, no explanation. Use this exact structure:
{
  "questions": [
    {
      "level": "${level}",
      "type": "english",
      "topic": "Punctuation",
      "marks": "1 mark",
      "text": "Find the section with the punctuation mistake. If there is no mistake, mark N.",
      "segments": ["Every morning, Tom", "fed the ducks", "at the park", "near his house."],
      "options": ["A. Every morning, Tom", "B. fed the ducks", "C. at the park", "D. near his house.", "N. No mistake"],
      "answer": "N",
      "explanation": "All punctuation is correct in this sentence.",
      "hint": "Read each section carefully. Does any punctuation look wrong?",
      "videoTitle": "Punctuation",
      "videoSource": "BBC Bitesize",
      "videoUrl": "https://www.bbc.co.uk/bitesize/topics/zfywb7h"
    }
  ]
}

IMPORTANT NOTES:
- For Punctuation and Spelling: options array must have 5 items (A, B, C, D, N). Answer is A/B/C/D or N.
- For Grammar: options array must have 5 items (A, B, C, D, E). Answer is A/B/C/D/E.
- For Maths: options array must have 5 items (A, B, C, D, E). Answer is A/B/C/D/E.
- Punctuation/Spelling questions MUST include a "segments" array of exactly 4 strings.
- videoSource must be either "CorbettMaths" or "BBC Bitesize"
- For CorbettMaths links use: https://corbettmathsprimary.com/content/
- For BBC Bitesize links use: https://www.bbc.co.uk/bitesize/subjects/z38pycw`;

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
            content: `Generate 10 fresh SEAG-style questions for ${level} now. Return JSON only, no other text.`
          }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Anthropic API error:', error);
      return res.status(500).json({ error: 'Failed to generate questions' });
    }

    const data = await response.json();
    const text = data.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Server error — please try again' });
  }
}
