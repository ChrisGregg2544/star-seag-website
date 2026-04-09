/* ══════════════════════════════════════════════════════
   Update validator verdict for a question server-side,
   using the service role key to bypass RLS.
   Accepts: { questionId, verdict, reason }
   Returns: { ok: true } or { error: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questionId, verdict, reason } = req.body || {};
  if (!questionId || !verdict) {
    return res.status(400).json({ error: 'Missing questionId or verdict' });
  }
  if (!['PASS', 'WARN', 'FAIL'].includes(verdict)) {
    return res.status(400).json({ error: 'Invalid verdict — must be PASS, WARN, or FAIL' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured' });

  // Build the update payload based on verdict
  const update = { validator_verdict: verdict.toLowerCase(), validator_reason: reason || null };
  if (verdict === 'PASS') update.validated = true;
  if (verdict === 'FAIL') update.source = 'rejected';

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?id=eq.${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=minimal,count=exact'
      },
      body: JSON.stringify(update)
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('[update-verdict] Supabase error:', response.status, text.slice(0, 200));
    return res.status(500).json({ error: `Supabase error ${response.status}: ${text.slice(0, 100)}` });
  }

  const rowCount = response.headers.get('content-range');
  console.log('[update-verdict] Updated question', questionId, 'verdict:', verdict, 'rows:', rowCount);
  return res.status(200).json({ ok: true, rowCount });
}
