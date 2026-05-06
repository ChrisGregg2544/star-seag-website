/* ══════════════════════════════════════════════════════
   Sync guest (pre-signup) sprint results to Supabase.
   Called once on first login if localStorage has guest data.

   Accepts POST with Authorization: Bearer <supabase_jwt>
   Body: { sessions: [{ date, score, correct, total, track }] }
   Returns: { ok: true, synced: N } or { ok: false, error }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 15 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

function sbFetch(path, method, body, serviceKey, extraHeaders = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  // 1. Verify caller identity via Supabase JWT
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ ok: false, error: 'Missing Authorization header' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: 'Invalid or expired session token' });
  const { id: userId } = await userRes.json();

  // 2. Validate payload — star_sessions stores { date, score(pct), correct, total, track }
  const { sessions } = req.body || {};
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return res.status(400).json({ ok: false, error: 'sessions must be a non-empty array' });
  }

  // Cap at 10 guest sessions (shouldn't be more, but be defensive)
  const toSync = sessions.slice(0, 10);

  // 3. Batch-insert into sessions table
  //    score column stores raw correct count (same as save-session.js)
  const sessionRows = toSync.map(s => ({
    user_id:         userId,
    session_type:    'mini_sprint',
    track:           s.track || 'P6',
    score:           typeof s.correct === 'number' ? s.correct : 0,
    total_questions: typeof s.total   === 'number' ? s.total   : 10,
    english_score:   0,
    maths_score:     0,
    created_at:      s.date || new Date().toISOString(),
  }));

  const insertRes = await sbFetch('sessions', 'POST', sessionRows, serviceKey, {
    'Prefer': 'return=minimal',
  });
  if (!insertRes.ok) {
    const text = await insertRes.text();
    console.error('[sync-guest-sessions] sessions insert error:', text.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to insert sessions' });
  }

  // 4. Upsert progress_summary with the most recent session (array is newest-first)
  const latest = toSync[0];
  const psRes = await sbFetch('progress_summary', 'POST', {
    user_id:          userId,
    last_score:       typeof latest.correct === 'number' ? latest.correct : 0,
    last_total:       typeof latest.total   === 'number' ? latest.total   : 10,
    topics_to_review: [],
    last_session_at:  latest.date || new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }, serviceKey, { 'Prefer': 'resolution=merge-duplicates,return=minimal' });

  if (!psRes.ok) {
    const text = await psRes.text();
    console.error('[sync-guest-sessions] progress_summary upsert error (non-fatal):', text.slice(0, 200));
  }

  console.log('[sync-guest-sessions] ✅ synced', toSync.length, 'sessions for user', userId);
  return res.status(200).json({ ok: true, synced: toSync.length });
}
