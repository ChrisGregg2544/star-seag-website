/* ══════════════════════════════════════════════════════
   /api/extract-paper.js
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

  const { content, pdf_base64, pdf_filename, year_group, paper_number } = req.body || {};

  if (!content && !pdf_base64) return res.status(400).json({ error: 'content or pdf_base64 is required' });
  if (!year_group)              return res.status(400).json({ error: 'year_group is required' });
  if (!paper_number)            return res.status(400).json({ error: 'paper_number is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

  const textPrompt = `Year group: ${year_group}\nPaper: ${paper_number || pdf_filename || ''}\n\nExtract all questions from this paper.`;

  const userContent = pdf_base64
    ? [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdf_base64 },
        },
        { type: 'text', text: textPrompt },
      ]
    : `Year group: ${year_group}\nPaper: ${paper_number}\n\n${content}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'pdfs-2024-09-25',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userContent }],
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
          return res.status(500).json({ error: 'Could not parse AI response', raw: rawText.substring(0, 2000) });
        }
      } else {
        console.error('No JSON array found. Raw:', rawText.slice(0, 300));
        return res.status(500).json({ error: 'Could not parse AI response', raw: rawText.substring(0, 2000) });
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
