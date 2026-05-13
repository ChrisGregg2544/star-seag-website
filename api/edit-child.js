/* ══════════════════════════════════════════════════════
   Update a child's name, year_group and exam_year.
   Verifies caller is the parent of the child (or the child themselves).

   POST  Authorization: Bearer <supabase_jwt>
   Body: { childId, name, year_group, exam_year }
   Returns: { ok: true, child } or { ok: false, error }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 10 };

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

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: 'Invalid or expired session' });
  const { id: callerId } = await userRes.json();

  const { childId, name, year_group, exam_year } = req.body || {};
  const trimmedName = (name || '').trim().slice(0, 64);
  if (!childId)     return res.status(400).json({ ok: false, error: 'childId is required' });
  if (!trimmedName) return res.status(400).json({ ok: false, error: 'Name is required' });
  if (!['P6', 'P7'].includes(year_group)) return res.status(400).json({ ok: false, error: 'year_group must be P6 or P7' });

  const examYearInt = parseInt(exam_year, 10);
  if (!examYearInt || examYearInt < 2025 || examYearInt > 2040) {
    return res.status(400).json({ ok: false, error: 'Invalid exam year' });
  }

  // Verify access: caller is the child, or caller is the parent of this child
  let authorized = childId === callerId;
  if (!authorized) {
    const ownerRes = await sbFetch(
      `profiles?id=eq.${childId}&parent_id=eq.${callerId}&select=id`,
      'GET', undefined, serviceKey
    );
    const ownerRows = ownerRes.ok ? await ownerRes.json() : [];
    authorized = Array.isArray(ownerRows) && ownerRows.length > 0;
  }
  if (!authorized) return res.status(403).json({ ok: false, error: 'Not authorised for this child' });

  const patchRes = await sbFetch(
    `profiles?id=eq.${childId}`,
    'PATCH',
    { name: trimmedName, year_group, exam_year: examYearInt, updated_at: new Date().toISOString() },
    serviceKey,
    { 'Prefer': 'return=representation' }
  );

  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error('[edit-child] patch error:', patchRes.status, text.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to update profile' });
  }

  const rows = await patchRes.json();
  const child = Array.isArray(rows) ? rows[0] : rows;
  console.log(`[edit-child] ✅ child ${childId} updated by ${callerId}`);
  return res.status(200).json({ ok: true, child });
}
