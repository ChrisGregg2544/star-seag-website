/* ══════════════════════════════════════════════════════
   /api/profile.js
   Consolidated profile maintenance endpoint.

     POST ?action=set-baseline  — mark baseline_complete = true
     POST ?action=sync-guest    — sync pre-signup guest sprints on first login
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 15 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

function sbFetch(path, method, body, serviceKey, extraHeaders = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function verifyJwt(jwt, serviceKey) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!r.ok) return null;
  const { id } = await r.json();
  return id || null;
}

// ── action=set-baseline ───────────────────────────────────────────────────────
async function handleSetBaseline(req, res, serviceKey, userId) {
  const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({ baseline_complete: true, updated_at: new Date().toISOString() }),
  });

  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error('[profile/set-baseline] patch error:', text.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to update profile' });
  }

  console.log('[profile/set-baseline] ✅ baseline_complete=true for user', userId);
  return res.status(200).json({ ok: true });
}

// ── action=sync-guest ─────────────────────────────────────────────────────────
async function handleSyncGuest(req, res, serviceKey, userId) {
  const { sessions } = req.body || {};
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return res.status(400).json({ ok: false, error: 'sessions must be a non-empty array' });
  }

  const toSync = sessions.slice(0, 10);

  const sessionRows = toSync.map(s => ({
    user_id:         userId,
    session_type:    'mini_sprint',
    track:           s.track || 'P6',
    score:           typeof s.correct === 'number' ? s.correct : 0,
    total_questions: typeof s.total   === 'number' ? s.total   : 10,
    english_score:   0,
    maths_score:     0,
  }));

  const insertRes = await sbFetch('sessions', 'POST', sessionRows, serviceKey, { 'Prefer': 'return=minimal' });
  if (!insertRes.ok) {
    const text = await insertRes.text();
    console.error('[profile/sync-guest] sessions insert error:', text.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to insert sessions' });
  }

  const latest = toSync[0];
  const psRes  = await sbFetch('progress_summary', 'POST', {
    user_id:          userId,
    last_score:       typeof latest.correct === 'number' ? latest.correct : 0,
    last_total:       typeof latest.total   === 'number' ? latest.total   : 10,
    topics_to_review: [],
    last_session_at:  latest.date || new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }, serviceKey, { 'Prefer': 'resolution=merge-duplicates,return=minimal' });

  if (!psRes.ok) {
    const text = await psRes.text();
    console.error('[profile/sync-guest] progress_summary upsert error (non-fatal):', text.slice(0, 200));
  }

  console.log('[profile/sync-guest] ✅ synced', toSync.length, 'sessions for user', userId);
  return res.status(200).json({ ok: true, synced: toSync.length });
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'Server misconfigured' });

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ ok: false, error: 'Missing Authorization header' });

  const userId = await verifyJwt(jwt, serviceKey);
  if (!userId) return res.status(401).json({ ok: false, error: 'Invalid or expired session' });

  const action = req.query?.action;
  switch (action) {
    case 'set-baseline': return handleSetBaseline(req, res, serviceKey, userId);
    case 'sync-guest':   return handleSyncGuest(req, res, serviceKey, userId);
    default:             return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  }
}
