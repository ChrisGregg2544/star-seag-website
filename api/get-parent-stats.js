/* ══════════════════════════════════════════════════════
   Return sessions + progress_summary for all of a parent's
   children using the service role key (bypasses RLS).

   POST  Authorization: Bearer <supabase_jwt>
   Body: { childIds: string[] }
   Returns: { ok: true, sessions: [...], progress: [...] }
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

  // 1. Verify caller's identity
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ ok: false, error: 'Missing Authorization header' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: 'Invalid or expired session token' });
  const { id: parentId } = await userRes.json();

  // 2. Validate payload
  const { childIds } = req.body || {};
  if (!Array.isArray(childIds) || childIds.length === 0) {
    return res.status(400).json({ ok: false, error: 'childIds must be a non-empty array' });
  }

  // 3. Verify all requested childIds belong to this parent
  const ownerRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?parent_id=eq.${parentId}&select=id`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );
  const ownedRows = ownerRes.ok ? await ownerRes.json() : [];
  const ownedIds  = new Set((ownedRows || []).map(r => r.id));
  const verified  = childIds.filter(id => ownedIds.has(id));

  if (verified.length === 0) {
    return res.status(403).json({ ok: false, error: 'No authorised children in request' });
  }

  // 4. Fetch sessions + progress_summary in parallel using service role key
  const idList = verified.join(',');

  const [sessionsRes, progressRes, qrRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/sessions?user_id=in.(${idList})&select=id,user_id,score,total_questions,completed_at&order=completed_at.desc`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/progress_summary?user_id=in.(${idList})&select=user_id,topics_to_review,last_session_at`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    ),
    // Supabase REST caps at 1,000 rows — sufficient for typical usage (~50 sprints × 20 questions)
    fetch(
      `${SUPABASE_URL}/rest/v1/question_results?user_id=in.(${idList})&select=user_id,session_id,topic,correct`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    ),
  ]);

  const sessions        = sessionsRes.ok ? await sessionsRes.json() : [];
  const progress        = progressRes.ok ? await progressRes.json() : [];
  const questionResults = qrRes.ok       ? await qrRes.json()       : [];

  if (!sessionsRes.ok) console.error('[get-parent-stats] sessions error:', sessionsRes.status);
  if (!progressRes.ok) console.error('[get-parent-stats] progress error:', progressRes.status);
  if (!qrRes.ok)       console.error('[get-parent-stats] question_results error:', qrRes.status);

  console.log(`[get-parent-stats] parentId:${parentId} children:${verified.length} sessions:${sessions.length} qr:${questionResults.length}`);
  return res.status(200).json({ ok: true, sessions, progress, questionResults });
}
