/* ══════════════════════════════════════════════════════
   AI marking for written comprehension answers.
   Accepts: { question, correctAnswer, studentAnswer }
   Returns: { pass: bool, feedback: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 15 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const ALLOWED_ORIGINS = [
  'https://staraitutor.co.uk',
  'https://www.staraitutor.co.uk',
  'https://star-seag-website.vercel.app',
];
const DAILY_CALL_CAP = 200;

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function verifyJwt(req, serviceKey) {
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  return user?.id || null;
}

// Increment today's usage counter; fails open (returns 0) if the api_usage
// table / RPC is not present, so the endpoint never breaks.
async function bumpUsage(userId, serviceKey) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_api_usage`, {
      method: 'POST',
      headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: userId }),
    });
    if (!r.ok) return 0;
    return Number(await r.json()) || 0;
  } catch {
    return 0;
  }
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Server auth not configured' });

  const userId = await verifyJwt(req, serviceKey);
  if (!userId) return res.status(401).json({ error: 'Please sign in.' });

  const usage = await bumpUsage(userId, serviceKey);
  if (usage > DAILY_CALL_CAP) {
    return res.status(429).json({ error: "You've reached today's marking limit — come back tomorrow!" });
  }

  const { question_id, studentAnswer } = req.body || {};
  if (!question_id || studentAnswer == null) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (String(studentAnswer).trim().length === 0) {
    return res.status(200).json({ pass: false, feedback: 'No answer was given.' });
  }

  // Look up the question text + model answer server-side (never sent by the client)
  let question, correctAnswer, explanation;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/questions?id=eq.${encodeURIComponent(question_id)}&select=question_text,correct_answer,explanation`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    if (!r.ok) throw new Error('lookup HTTP ' + r.status);
    const row = (await r.json())?.[0];
    if (!row) return res.status(404).json({ error: 'Question not found' });
    question      = row.question_text || '';
    correctAnswer = String(row.correct_answer ?? '');
    explanation   = row.explanation || '';
  } catch (e) {
    console.error('[mark-written] lookup error:', e.message);
    return res.status(500).json({ error: 'Could not load question' });
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
    const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
    const pass = norm(studentAnswer) === norm(correctAnswer);
    return res.status(200).json({ pass, feedback: '', explanation, _fallback: true });
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
    feedback: (result.feedback || '').trim(),
    explanation
  });
}
