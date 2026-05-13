/* ══════════════════════════════════════════════════════
   Read all dashboard data for a child using service role.
   Bypasses RLS — anon-key reads on sessions/question_results/
   progress_summary are blocked by default RLS policies.

   GET /api/dashboard-data?childId=xxx&weekStart=<ISO>
   Authorization: Bearer <supabase_jwt>
   Returns: { ok, sessionsCount, weekDoneCount, lastScore, lastTotal,
              topicsToReview, questionResults, baselineComplete }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

function sbGet(path, serviceKey) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
  });
}

function countHeader(res) {
  const cr = res.headers.get('content-range');
  if (!cr) return 0;
  const m = cr.match(/\/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'Service key not configured' });

  // Verify caller
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ ok: false, error: 'Missing Authorization' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: 'Invalid token' });
  const { id: callerId } = await userRes.json();

  const childId   = req.query?.childId   || callerId;
  const weekStart = req.query?.weekStart || new Date(Date.now() - 7 * 86400000).toISOString();

  // Verify access: caller is the child, or caller is the parent of the child
  let authorized = childId === callerId;
  if (!authorized) {
    const ownerRes = await sbGet(
      `profiles?id=eq.${childId}&parent_id=eq.${callerId}&select=id`,
      serviceKey
    );
    const ownerRows = ownerRes.ok ? await ownerRes.json() : [];
    authorized = Array.isArray(ownerRows) && ownerRows.length > 0;
  }
  if (!authorized) return res.status(403).json({ ok: false, error: 'Not authorised' });

  // 1. Total sessions count
  const totalRes = await sbGet(
    `sessions?user_id=eq.${childId}&select=id`,
    serviceKey
  );
  // Need count header — re-fetch with Prefer: count=exact
  const totalCountRes = await fetch(`${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${childId}&select=id`, {
    headers: {
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer':        'count=exact',
      'Range':         '0-0',
    },
  });
  const sessionsCount = countHeader(totalCountRes);

  // 2. Sessions this week count
  const weekCountRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${childId}&completed_at=gte.${weekStart}&select=id`,
    {
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer':        'count=exact',
        'Range':         '0-0',
      },
    }
  );
  const weekDoneCount = countHeader(weekCountRes);

  // 2b. Guardian Supervised Test count this week
  const guardianCountRes = await fetch(
    `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${childId}&session_type=eq.guardian_test&completed_at=gte.${weekStart}&select=id`,
    {
      headers: {
        'apikey':        serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer':        'count=exact',
        'Range':         '0-0',
      },
    }
  );
  const guardianTestCount = countHeader(guardianCountRes);

  // 3. Progress summary (last score + topics to review)
  const psRes  = await sbGet(
    `progress_summary?user_id=eq.${childId}&select=last_score,last_total,topics_to_review&limit=1`,
    serviceKey
  );
  const [ps]   = psRes.ok ? await psRes.json() : [null];

  // 4. Question results (for skills map) — cap at 1000 rows (sufficient for skill map)
  const qrRes  = await sbGet(
    `question_results?user_id=eq.${childId}&select=topic,correct&limit=1000`,
    serviceKey
  );
  const qrData = qrRes.ok ? await qrRes.json() : [];

  // 5. baseline_complete from profile
  const profRes = await sbGet(
    `profiles?id=eq.${childId}&select=baseline_complete&limit=1`,
    serviceKey
  );
  const [prof] = profRes.ok ? await profRes.json() : [null];

  return res.status(200).json({
    ok:               true,
    sessionsCount,
    weekDoneCount,
    guardianTestCount,
    lastScore:        ps?.last_score    ?? null,
    lastTotal:        ps?.last_total    ?? null,
    topicsToReview:   ps?.topics_to_review ?? [],
    questionResults:  Array.isArray(qrData) ? qrData : [],
    baselineComplete: prof?.baseline_complete === true,
  });
}
