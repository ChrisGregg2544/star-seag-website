/* ══════════════════════════════════════════════════════
   /api/admin-login.js
   Server-side gate for the admin tools (validate/review/reports).

     POST { password }  → if it matches ADMIN_PASSWORD, sets an httpOnly,
                          signed session cookie (star_admin). Returns {ok:true}.
     GET  (?action=check) → 200 {ok:true} if the cookie is valid, else 401.

   Cookie is an HMAC-signed token (node:crypto, no libraries), ~8h expiry.
   Requires env: ADMIN_PASSWORD, ADMIN_SECRET.
══════════════════════════════════════════════════════ */
import crypto from 'node:crypto';

export const config = { maxDuration: 10 };

const ALLOWED_ORIGINS = [
  'https://staraitutor.co.uk',
  'https://www.staraitutor.co.uk',
  'https://star-seag-website.vercel.app',
];
const COOKIE_NAME = 'star_admin';
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const b64url = buf => Buffer.from(buf).toString('base64url');

function sign(payloadObj, secret) {
  const payload = b64url(JSON.stringify(payloadObj));
  const mac = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${mac}`;
}

export function verifyAdminCookie(req, secret) {
  if (!secret) return false;
  const raw = (req.headers.cookie || '')
    .split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return false;
  const token = raw.slice(COOKIE_NAME.length + 1);
  const [payload, mac] = token.split('.');
  if (!payload || !mac) return false;
  const expected = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  // Timing-safe compare
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch {
    return false;
  }
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const secret = process.env.ADMIN_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!secret || !adminPassword) return res.status(500).json({ error: 'Admin auth not configured' });

  // Check current session
  if (req.method === 'GET') {
    return verifyAdminCookie(req, secret)
      ? res.status(200).json({ ok: true })
      : res.status(401).json({ ok: false });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  const given = Buffer.from(String(password || ''));
  const real = Buffer.from(adminPassword);
  const match = given.length === real.length && crypto.timingSafeEqual(given, real);
  if (!match) return res.status(401).json({ ok: false, error: 'Incorrect password' });

  const token = sign({ exp: Date.now() + TTL_MS }, secret);
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}`);
  return res.status(200).json({ ok: true });
}
