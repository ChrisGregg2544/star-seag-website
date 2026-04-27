/* ══════════════════════════════════════════════════════
   GET /api/check-subscription
   Authorization: Bearer <supabase_jwt>

   Verifies the caller's JWT, then checks parent_subscriptions
   using the service role key (bypasses RLS entirely).

   Returns: { subscribed: bool, status: string|null }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Server misconfigured' });

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ error: 'Missing Authorization header' });

  // Verify JWT → resolve parentId
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: 'Invalid or expired token' });
  const { id: parentId } = await userRes.json();

  // Query parent_subscriptions with service role — no RLS restrictions
  const subRes = await fetch(
    `${SUPABASE_URL}/rest/v1/parent_subscriptions?parent_id=eq.${parentId}&select=subscription_status,trial_end`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );

  if (!subRes.ok) {
    const txt = await subRes.text();
    console.error('[check-subscription] query failed:', txt.slice(0, 200));
    return res.status(500).json({ error: 'Database query failed' });
  }

  const rows = await subRes.json();
  const row  = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  const status     = row?.subscription_status || null;
  const subscribed = status === 'active' || status === 'trialing';

  console.log(`[check-subscription] parentId:${parentId} status:${status} subscribed:${subscribed}`);
  return res.status(200).json({ subscribed, status });
}
