/* ══════════════════════════════════════════════════════
   /api/admin.js
   Consolidated admin/validator endpoints.
   Route via ?action= query param:

     POST ?action=update-verdict  — update question validator verdict
     POST ?action=save-feedback   — save human reviewer feedback
     POST ?action=deactivate      — deactivate a question (validated=false)
     POST ?action=reactivate      — reactivate a previously deactivated question
     POST ?action=dismiss-reports — mark reports reviewed without deactivating
     POST ?action=save-report     — save a student question report (student JWT)
     GET  ?action=get-reports     — fetch all reports for admin view
     POST ?action=login          — verify ADMIN_PASSWORD, set signed cookie
     GET  ?action=check          — is the current admin cookie valid?

   Admin actions require the signed star_admin cookie (set by ?action=login);
   save-report requires a student JWT. Requires env: ADMIN_PASSWORD, ADMIN_SECRET.
══════════════════════════════════════════════════════ */
import crypto from 'node:crypto';

export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const ALLOWED_ORIGINS = [
  'https://staraitutor.co.uk',
  'https://www.staraitutor.co.uk',
  'https://star-seag-website.vercel.app',
];
const ADMIN_COOKIE = 'star_admin';
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const b64url = buf => Buffer.from(buf).toString('base64url');

function signAdminToken(payloadObj, secret) {
  const payload = b64url(JSON.stringify(payloadObj));
  const mac = b64url(crypto.createHmac('sha256', secret).update(payload).digest());
  return `${payload}.${mac}`;
}

// action=login — verify ADMIN_PASSWORD and set the signed session cookie.
function handleAdminLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.ADMIN_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!secret || !adminPassword) return res.status(500).json({ error: 'Admin auth not configured' });

  const { password } = req.body || {};
  const given = Buffer.from(String(password || ''));
  const real = Buffer.from(adminPassword);
  const match = given.length === real.length && crypto.timingSafeEqual(given, real);
  if (!match) return res.status(401).json({ ok: false, error: 'Incorrect password' });

  const token = signAdminToken({ exp: Date.now() + ADMIN_TTL_MS }, secret);
  res.setHeader('Set-Cookie',
    `${ADMIN_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${ADMIN_TTL_MS / 1000}`);
  return res.status(200).json({ ok: true });
}

// Verify the HMAC-signed admin session cookie.
function verifyAdminCookie(req) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const raw = (req.headers.cookie || '')
    .split(';').map(s => s.trim()).find(s => s.startsWith(`${ADMIN_COOKIE}=`));
  if (!raw) return false;
  const [payload, mac] = raw.slice(ADMIN_COOKIE.length + 1).split('.');
  if (!payload || !mac) return false;
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(payload).digest()).toString('base64url');
  const a = Buffer.from(mac), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > Date.now();
  } catch { return false; }
}

// Verify a Supabase student JWT (used for the student-facing save-report action).
async function verifyStudentJwt(req) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt || !serviceKey) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!r.ok) return null;
  return (await r.json())?.id || null;
}

// ── action=update-verdict ─────────────────────────────────────────────────────
async function handleUpdateVerdict(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questionId, verdict, reason } = req.body || {};
  if (!questionId || !verdict) return res.status(400).json({ error: 'Missing questionId or verdict' });
  if (!['PASS', 'WARN', 'FAIL'].includes(verdict)) {
    return res.status(400).json({ error: 'Invalid verdict — must be PASS, WARN, or FAIL' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const update = { validator_verdict: verdict.toLowerCase(), validator_reason: reason || null };
  if (verdict === 'PASS') update.validated = true;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?id=eq.${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer':        'return=minimal,count=exact',
      },
      body: JSON.stringify(update),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('[admin/update-verdict] Supabase error:', response.status, text.slice(0, 200));
    return res.status(500).json({ error: `Supabase error ${response.status}: ${text.slice(0, 100)}` });
  }

  const rowCount = response.headers.get('content-range');
  console.log('[admin/update-verdict] Updated question', questionId, 'verdict:', verdict, 'rows:', rowCount);
  return res.status(200).json({ ok: true, rowCount });
}

// ── action=save-feedback ──────────────────────────────────────────────────────
async function handleSaveFeedback(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { questionId, originalResult, originalFlags, yourDecision, reason } = req.body || {};
  if (!questionId || !originalResult || !yourDecision) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const response = await fetch(`${SUPABASE_URL}/rest/v1/validator_feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({
      question_id:     questionId,
      original_result: originalResult,
      original_flags:  originalFlags || [],
      your_decision:   yourDecision,
      reason:          reason || null,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[admin/save-feedback] Supabase error:', response.status, text.slice(0, 200));
    return res.status(500).json({ ok: false, error: `Supabase error ${response.status}: ${text.slice(0, 100)}` });
  }

  console.log('[admin/save-feedback] Saved feedback for question', questionId, 'decision:', yourDecision);
  return res.status(200).json({ ok: true });
}

// ── action=deactivate ─────────────────────────────────────────────────────────
async function handleDeactivate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questionId } = req.body || {};
  if (!questionId) return res.status(400).json({ error: 'Missing questionId' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Service key not configured' });

  const qRes = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?id=eq.${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({ validated: false, source: 'rejected' }),
    }
  );

  if (!qRes.ok) {
    const text = await qRes.text();
    console.error('[admin/deactivate] Supabase error:', qRes.status, text.slice(0, 200));
    return res.status(500).json({ error: `Supabase error ${qRes.status}` });
  }

  // Mark all reports for this question as reviewed
  await fetch(
    `${SUPABASE_URL}/rest/v1/reports?question_id=eq.${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({ reviewed: true }),
    }
  );

  console.log('[admin/deactivate] Deactivated question:', questionId);
  return res.status(200).json({ ok: true });
}

// ── action=dismiss-reports ────────────────────────────────────────────────────
async function handleDismissReports(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questionId } = req.body || {};
  if (!questionId) return res.status(400).json({ error: 'Missing questionId' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Service key not configured' });

  const rRes = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?question_id=eq.${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({ reviewed: true }),
    }
  );

  if (!rRes.ok) {
    const text = await rRes.text();
    console.error('[admin/dismiss-reports] Supabase error:', rRes.status, text.slice(0, 200));
    return res.status(500).json({ error: `Supabase error ${rRes.status}` });
  }

  console.log('[admin/dismiss-reports] Dismissed reports for question:', questionId);
  return res.status(200).json({ ok: true });
}

// ── action=reactivate ─────────────────────────────────────────────────────────
async function handleReactivate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questionId } = req.body || {};
  if (!questionId) return res.status(400).json({ error: 'Missing questionId' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Service key not configured' });

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?id=eq.${encodeURIComponent(questionId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({ validated: true, source: 'ai_generated' }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error('[admin/reactivate] Supabase error:', response.status, text.slice(0, 200));
    return res.status(500).json({ error: `Supabase error ${response.status}` });
  }

  console.log('[admin/reactivate] Reactivated question:', questionId);
  return res.status(200).json({ ok: true });
}

// ── action=save-report ────────────────────────────────────────────────────────
async function handleSaveReport(req, res) {
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
    console.error('[admin/save-report] Supabase error:', response.status, text.slice(0, 200));
    return res.status(500).json({ ok: false, error: `Supabase error ${response.status}` });
  }

  console.log('[admin/save-report] Report saved for question:', question_id);
  return res.status(200).json({ ok: true });
}

// ── action=get-reports ────────────────────────────────────────────────────────
async function handleGetReports(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'Service key not configured' });

  const reportsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/reports?select=question_id,reported_at,reviewed&order=reported_at.desc&limit=1000`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  if (!reportsRes.ok) {
    const text = await reportsRes.text();
    console.error('[admin/get-reports] fetch error:', reportsRes.status, text.slice(0, 200));
    return res.status(500).json({ ok: false, error: `Supabase error ${reportsRes.status}` });
  }
  const rows = await reportsRes.json();

  const grouped = {};
  for (const row of rows) {
    const qid = row.question_id;
    if (!qid) continue;
    if (!grouped[qid]) {
      grouped[qid] = { question_id: qid, report_count: 0, latest_reported_at: row.reported_at };
    }
    grouped[qid].report_count++;
    if (row.reported_at > grouped[qid].latest_reported_at) {
      grouped[qid].latest_reported_at = row.reported_at;
    }
  }

  const uniqueIds = Object.keys(grouped);
  if (uniqueIds.length === 0) return res.status(200).json({ ok: true, reports: [] });

  const questionsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?id=in.(${uniqueIds.join(',')})&select=id,question_text,topic,validated`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  const questions = questionsRes.ok ? await questionsRes.json() : [];
  const qMap = Object.fromEntries((questions || []).map(q => [q.id, q]));

  const result = uniqueIds.map(qid => {
    const q = qMap[qid] || {};
    return {
      ...grouped[qid],
      question_text: q.question_text || '(question not found)',
      topic:         q.topic         || '',
      validated:     q.validated     ?? true,
    };
  }).sort((a, b) => b.report_count - a.report_count);

  console.log(`[admin/get-reports] Returning ${result.length} unique reported questions`);
  return res.status(200).json({ ok: true, reports: result });
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  // Public admin-auth endpoints (no cookie required to reach them)
  if (action === 'login') return handleAdminLogin(req, res);
  if (action === 'check') {
    return verifyAdminCookie(req)
      ? res.status(200).json({ ok: true })
      : res.status(401).json({ ok: false });
  }

  // save-report is a student action — require a valid student session.
  if (action === 'save-report') {
    const userId = await verifyStudentJwt(req);
    if (!userId) return res.status(401).json({ error: 'Please sign in.' });
    return handleSaveReport(req, res);
  }

  // Everything else is admin-only — require the signed admin session cookie.
  const adminActions = ['update-verdict', 'save-feedback', 'deactivate', 'reactivate', 'dismiss-reports', 'get-reports'];
  if (adminActions.includes(action)) {
    if (!verifyAdminCookie(req)) return res.status(401).json({ error: 'Admin authentication required' });
    switch (action) {
      case 'update-verdict':  return handleUpdateVerdict(req, res);
      case 'save-feedback':   return handleSaveFeedback(req, res);
      case 'deactivate':      return handleDeactivate(req, res);
      case 'reactivate':      return handleReactivate(req, res);
      case 'dismiss-reports': return handleDismissReports(req, res);
      case 'get-reports':     return handleGetReports(req, res);
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
