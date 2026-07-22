/* ══════════════════════════════════════════════════════
   Server-side answer checking for multiple-choice questions.
   The correct answer never reaches the browser before submit.
   Accepts: { question_id, answer }   (answer = selected letter A/B/C/D/E/N)
   Returns: { correct: bool, correct_answer: string, explanation: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 10 };

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
    return res.status(429).json({ error: "You've reached today's practice limit — come back tomorrow!" });
  }

  const { question_id, answer } = req.body || {};
  if (!question_id) return res.status(400).json({ error: 'Missing question_id' });

  // Look up the correct answer with the service key (never exposed to the client until now)
  let row;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/questions?id=eq.${encodeURIComponent(question_id)}&select=correct_answer,explanation`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    if (!r.ok) throw new Error('lookup HTTP ' + r.status);
    const rows = await r.json();
    row = rows?.[0];
  } catch (e) {
    console.error('[check-answer] lookup error:', e.message);
    return res.status(500).json({ error: 'Could not check answer' });
  }
  if (!row) return res.status(404).json({ error: 'Question not found' });

  const correctAnswer = String(row.correct_answer ?? '');
  // Normalise both sides: handles MC letters exactly and maths free-response
  // (² / ^2 equivalence, case, and whitespace) the same way the old client did.
  const norm = s => String(s ?? '').toLowerCase().replace(/²/g, '2').replace(/\^2/g, '2').replace(/\s+/g, ' ').trim();
  const correct = norm(answer) === norm(correctAnswer);

  return res.status(200).json({
    correct,
    correct_answer: correctAnswer,
    explanation: row.explanation || '',
  });
}
