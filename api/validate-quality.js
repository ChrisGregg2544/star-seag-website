/* ══════════════════════════════════════════════════════
   /api/validate-quality.js
   Validator 3 — validates question clarity, style, and
   absence of bias.
   Returns: { score, reason, verdict }
══════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `You are an expert SEAG transfer test validator for Northern Ireland P6/P7 pupils (ages 10-11). Your job is to verify question quality.

Check:
1. Is the question clearly and unambiguously worded?
2. Are the wrong answer options (if present) plausible but definitely wrong?
3. Does it follow SEAG question style?
4. Is the question free from bias or culturally inappropriate content?

Return ONLY a JSON object in this exact format:
{"score":<number 1-10>,"reason":"<brief explanation>","verdict":"<pass|warn|fail>"}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question_text, correct_answer, category, year_group } = req.body || {};

  if (!question_text)  return res.status(400).json({ error: 'question_text is required' });
  if (!correct_answer) return res.status(400).json({ error: 'correct_answer is required' });
  if (!category)       return res.status(400).json({ error: 'category is required' });
  if (!year_group)     return res.status(400).json({ error: 'year_group is required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI configuration error' });

  const userMessage = `Category: ${category}
Year group: ${year_group}
Question: ${question_text}
Correct answer: ${correct_answer}

Rate the quality of this question. Score 7+ = pass, 4-6 = warn, 1-3 = fail.`;

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
        max_tokens: 256,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('validate-quality API error:', data.error);
      return res.status(500).json({ error: data.error?.message || 'AI API error' });
    }

    const rawText = data.content?.[0]?.text || '';

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        try { result = JSON.parse(match[0]); } catch {
          return res.status(500).json({ error: 'Could not parse validator response', raw: rawText });
        }
      } else {
        return res.status(500).json({ error: 'Could not parse validator response', raw: rawText });
      }
    }

    return res.status(200).json({
      score:   Number(result.score),
      reason:  result.reason || '',
      verdict: result.verdict || 'warn',
    });

  } catch (err) {
    console.error('validate-quality error:', err.message);
    return res.status(500).json({ error: err.message || 'Validation failed' });
  }
}
