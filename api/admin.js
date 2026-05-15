/* ══════════════════════════════════════════════════════
   /api/admin.js
   Consolidated admin/validator endpoints.
   Route via ?action= query param:

     POST ?action=update-verdict  — update question validator verdict
     POST ?action=save-feedback   — save human reviewer feedback
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 10 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

// ── action=update-verdict ─────────────────────────────────────────────────────
async function handleUpdateVerdict(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { questionId, verdict, reason } = req.body || {};
  if (!questionId || !verdict) return res.status(400).json({ error: 'Missing questionId or verdict' });
  if (!['PASS', 'WARN', 'FAIL'].includes(verdict)) {
    return res.status(400).json({ error: 'Invalid verdict — must be PASS, WARN, or FAIL' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY not configured' });

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

  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'SUPABASE_SERVICE_KEY not configured' });

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

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  switch (action) {
    case 'update-verdict':  return handleUpdateVerdict(req, res);
    case 'save-feedback':   return handleSaveFeedback(req, res);
    case 'deactivate':      return handleDeactivate(req, res);
    case 'dismiss-reports': return handleDismissReports(req, res);
    default:                return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
