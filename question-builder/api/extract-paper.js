/* ══════════════════════════════════════════════════════
   /question-builder/api/extract-paper.js
   Extracts questions from pasted paper content using
   Claude Haiku. Returns a JSON array of question objects.
══════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `You are an expert at analysing SEAG transfer test papers for Northern Ireland P6 and P7 pupils (ages 10-11). Extract every question from the paper content provided. For each question return:
- question_text: the full question text
- correct_answer: the correct answer (letter A/B/C/D/E or N for punctuation/spelling, or full text for written answers)
- category: one of: punctuation, grammar, spelling, vocabulary, comprehension_mc, comprehension_written, arithmetic, geometry, fractions_decimals, measurement, statistics, algebra_sequences
- difficulty: easy, medium, or hard (based on P6/P7 SEAG standard)

IMPORTANT for punctuation and spelling questions: the correct answer key must be A, B, C, D, or N (never E). N means 'no mistake'.

Return ONLY a valid JSON array. No preamble, no explanation, no markdown. Example format:
[{"question_text":"...","correct_answer":"B","category":"arithmetic","difficulty":"medium"}]`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { content, year_group, paper_number } = req.body || {};

  if (!content)      return res.status(400).json({ error: 'content is required' });
  if (!year_group)   return res.status(400).json({ error: 'year_group is required' });
  if (!paper_number) return res.status(400).json({ error: 'paper_number is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

  const userMessage = `Year group: ${year_group}\nPaper: ${paper_number}\n\n${content}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data.error);
      return res.status(500).json({ error: data.error?.message || 'AI API error' });
    }

    const rawText = data.content?.[0]?.text || '';

    let questions;
    try {
      questions = JSON.parse(rawText);
    } catch {
      // Try to extract JSON array from the response in case of stray whitespace
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          questions = JSON.parse(match[0]);
        } catch {
          console.error('JSON parse failed. Raw:', rawText.slice(0, 300));
          return res.status(500).json({ error: 'Could not parse AI response' });
        }
      } else {
        console.error('No JSON array found. Raw:', rawText.slice(0, 300));
        return res.status(500).json({ error: 'Could not parse AI response' });
      }
    }

    if (!Array.isArray(questions)) {
      return res.status(500).json({ error: 'AI returned unexpected format' });
    }

    console.log(`Extracted ${questions.length} questions from ${year_group} paper ${paper_number}`);
    return res.status(200).json({ questions });

  } catch (err) {
    console.error('extract-paper error:', err.message);
    return res.status(500).json({ error: err.message || 'Extraction failed' });
  }
}
