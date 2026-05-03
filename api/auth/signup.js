export const config = { maxDuration: 15 };

import bcrypt       from 'bcryptjs';
import { randomBytes } from 'crypto';

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;
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

  const { email, password, name } = req.body || {};

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!email || !EMAIL_RE.test(email))
    return res.status(400).json({ error: 'Invalid email format' });

  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password too short' });

  if (!name || !name.trim())
    return res.status(400).json({ error: 'Name is required' });

  // ── Check for existing email ────────────────────────────────────────────────
  const checkRes = await sb(
    `users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id&limit=1`,
    'GET', undefined, serviceKey,
  );
  if (!checkRes.ok) return res.status(500).json({ error: 'Database error' });

  const existing = await checkRes.json();
  if (existing.length > 0)
    return res.status(409).json({ error: 'Email already registered' });

  // ── Hash password + insert user ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const insertRes = await sb('users', 'POST', {
    email:         email.toLowerCase(),
    name:          name.trim(),
    password_hash: passwordHash,
  }, serviceKey, { Prefer: 'return=representation' });

  if (!insertRes.ok) {
    const err = await insertRes.text();
    console.error('signup: users INSERT failed:', err);
    return res.status(500).json({ error: 'Failed to create account' });
  }

  const [user] = await insertRes.json();

  // ── Create session token ────────────────────────────────────────────────────
  const token     = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const sessionRes = await sb('user_sessions', 'POST', {
    user_id:    user.id,
    token,
    expires_at: expiresAt,
  }, serviceKey, { Prefer: 'return=minimal' });

  if (!sessionRes.ok) {
    console.error('signup: user_sessions INSERT failed:', await sessionRes.text());
    return res.status(500).json({ error: 'Failed to create session' });
  }

  return res.status(201).json({
    success: true,
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
