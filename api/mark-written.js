/* ══════════════════════════════════════════════════════
   AI marking for written comprehension answers.
   Accepts: { question, correctAnswer, studentAnswer }
   Returns: { pass: bool, feedback: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, correctAnswer, studentAnswer } = req.body || {};
  if (!question || !correctAnswer || !studentAnswer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (studentAnswer.trim().length === 0) {
    return res.status(200).json({ pass: false, feedback: 'No answer was given.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const prompt = `You are marking a comprehension question for a Northern Ireland P6/P7 pupil (age 10–11) sitting the SEAG Transfer Test.

Question: ${question}
Model answer: ${correctAnswer}
Pupil's answer: ${studentAnswer}

Award a PASS if the pupil captures the correct meaning, even with:
- Minor spelling mistakes or typos
- Paraphrasing or different wording from the model answer
- Missing capital letters or incomplete sentences
- Partial phrasing that still conveys the key point

Award a FAIL if the answer is wrong, irrelevant, off-topic, or completely misses the key point.

Reply with JSON only, no other text:
{"pass": true, "feedback": "One short encouraging sentence explaining what was right or what was missing."}`;

  let responseText;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 120,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[mark-written] Anthropic error:', response.status, err.slice(0, 200));
      throw new Error('Anthropic HTTP ' + response.status);
    }

    const data = await response.json();
    responseText = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
  } catch (e) {
    console.error('[mark-written] fetch error:', e.message);
    // Fallback: whitespace-normalised exact match
    const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const pass = norm(studentAnswer) === norm(correctAnswer);
    return res.status(200).json({ pass, feedback: '', _fallback: true });
  }

  // Parse JSON from Claude's response
  const clean = responseText.replace(/```json|```/g, '').trim();
  let result;
  try {
    result = JSON.parse(clean);
  } catch (e) {
    // Best-effort extraction if JSON parse fails
    const lc = clean.toLowerCase();
    const pass = lc.includes('"pass":true') || lc.includes('"pass": true');
    result = { pass, feedback: '' };
  }

  return res.status(200).json({
    pass:     !!result.pass,
    feedback: (result.feedback || '').trim()
  });
}
