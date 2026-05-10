/* ══════════════════════════════════════════════════════
   Mark the calling user's baseline as complete.
   Called from study.html after the 3rd Mini Mock finishes.

   Accepts POST with Authorization: Bearer <supabase_jwt>
   Body: {} (empty — user identity comes from JWT)
   Returns: { ok: true } or { ok: false, error }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ ok: false, error: 'Missing Authorization header' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: 'Invalid or expired session token' });
  const { id: userId } = await userRes.json();

  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ baseline_complete: true, updated_at: new Date().toISOString() }),
  });

  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error('[set-baseline] patch error:', text.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to update profiles' });
  }

  console.log('[set-baseline] ✅ baseline_complete=true for user', userId);
  return res.status(200).json({ ok: true });
}
