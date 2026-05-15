export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { question_id, child_id, reason } = req.body || {};
  if (!question_id) return res.status(400).json({ ok: false, error: 'Missing question_id' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'Service key not configured' });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      question_id,
      child_id: child_id || null,
      reason:   reason || 'Question issue',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[save-report] Supabase error:', response.status, text.slice(0, 200));
    return res.status(500).json({ ok: false, error: `Supabase error ${response.status}` });
  }

  console.log('[save-report] Report saved for question:', question_id);
  return res.status(200).json({ ok: true });
}
