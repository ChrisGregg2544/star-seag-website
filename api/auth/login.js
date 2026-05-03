export const config = { maxDuration: 15 };

import bcrypt       from 'bcryptjs';
import { randomBytes } from 'crypto';

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SESSION_DAYS  = 30;

function sb(path, method, body, serviceKey, extra = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      ...extra,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Server configuration error' });

  const { email, password } = req.body || {};

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  // ── Find user by email ──────────────────────────────────────────────────────
  const userRes = await sb(
    `users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,email,name,password_hash&limit=1`,
    'GET', undefined, serviceKey,
  );
  if (!userRes.ok) return res.status(500).json({ error: 'Database error' });

  const [user] = await userRes.json();
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // ── Verify password ─────────────────────────────────────────────────────────
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  // ── Create session token ────────────────────────────────────────────────────
  const token     = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const sessionRes = await sb('user_sessions', 'POST', {
    user_id:    user.id,
    token,
    expires_at: expiresAt,
  }, serviceKey, { Prefer: 'return=minimal' });

  if (!sessionRes.ok) {
    console.error('login: user_sessions INSERT failed:', await sessionRes.text());
    return res.status(500).json({ error: 'Failed to create session' });
  }

  return res.status(200).json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
