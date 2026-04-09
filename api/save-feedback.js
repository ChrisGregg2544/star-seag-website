/* ══════════════════════════════════════════════════════
   Save a validator feedback row server-side,
   using the service role key to bypass RLS.
   Accepts: { questionId, originalResult, originalFlags, yourDecision, reason }
   Returns: { ok: true } or { ok: false, error: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { questionId, originalResult, originalFlags, yourDecision, reason } = req.body || {};
  if (!questionId || !originalResult || !yourDecision) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_KEY not configured' });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/validator_feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      question_id:     questionId,
      original_result: originalResult,
      original_flags:  originalFlags || [],
      your_decision:   yourDecision,
      reason:          reason || null
    })
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[save-feedback] Supabase error:', response.status, text.slice(0, 200));
    return res.status(500).json({ ok: false, error: `Supabase error ${response.status}: ${text.slice(0, 100)}` });
  }

  console.log('[save-feedback] Saved feedback for question', questionId, 'decision:', yourDecision);
  return res.status(200).json({ ok: true });
}
