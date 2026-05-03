export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Server configuration error' });

  const { token } = req.body || {};
  if (!token) return res.status(200).json({ valid: false });

  const now = new Date().toISOString();
  const sessionRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_sessions`
    + `?token=eq.${encodeURIComponent(token)}`
    + `&expires_at=gt.${encodeURIComponent(now)}`
    + `&select=user_id`
    + `&limit=1`,
    {
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    },
  );

  if (!sessionRes.ok) return res.status(500).json({ error: 'Database error' });

  const [session] = await sessionRes.json();
  if (!session) return res.status(200).json({ valid: false });

  const userRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users`
    + `?id=eq.${encodeURIComponent(session.user_id)}`
    + `&select=id,email,name`
    + `&limit=1`,
    {
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    },
  );

  if (!userRes.ok) return res.status(500).json({ error: 'Database error' });

  const [user] = await userRes.json();
  if (!user) return res.status(200).json({ valid: false });

  return res.status(200).json({ valid: true, user: { id: user.id, email: user.email, name: user.name } });
}
