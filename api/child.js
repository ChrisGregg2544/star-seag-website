/* ══════════════════════════════════════════════════════
   /api/child.js
   Consolidated child-profile management endpoint.

     POST ?action=add   — create child profile + update Stripe billing
     POST ?action=edit  — update child name / year_group / exam_year
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

function stripeFetch(path, params, stripeKey) {
  return fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: params.toString(),
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

// ── action=add ────────────────────────────────────────────────────────────────
async function handleAdd(req, res, serviceKey, callerId) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;

  const { name, year_group } = req.body || {};
  const trimmedName = (name || '').trim().slice(0, 64);
  if (!trimmedName) return res.status(400).json({ ok: false, error: 'Name is required' });
  if (!['P6', 'P7'].includes(year_group)) {
    return res.status(400).json({ ok: false, error: 'year_group must be P6 or P7' });
  }

  // Auto-calculate exam_year — SEAG Paper 2 is Nov 22
  const _now      = new Date();
  const _cutoff   = new Date(_now.getFullYear(), 10, 22);
  const exam_year = _now > _cutoff ? _now.getFullYear() + 1 : _now.getFullYear();

  const insertRes = await sbFetch('profiles', 'POST', {
    parent_id:         callerId,
    name:              trimmedName,
    year_group,
    exam_year,
    onboarded:         true,
    free_sprints_used: 0,
    updated_at:        new Date().toISOString(),
  }, serviceKey, { 'Prefer': 'return=representation' });

  if (!insertRes.ok) {
    const text = await insertRes.text();
    console.error('[child/add] insert error:', insertRes.status, text.slice(0, 300));
    return res.status(500).json({ ok: false, error: 'Failed to create child profile' });
  }
  const [child] = await insertRes.json();
  console.log(`[child/add] ✅ child ${child.id} created for parent ${callerId}`);

  // Count all children for this parent (after insert)
  const countRes   = await sbFetch(`profiles?parent_id=eq.${callerId}&select=id`, 'GET', undefined, serviceKey);
  const childRows  = countRes.ok ? await countRes.json() : [];
  const childCount = Array.isArray(childRows) ? childRows.length : 1;

  // £15 first child + £10 each additional
  const newAmountPence = 1500 + Math.max(0, childCount - 1) * 1000;
  const newMonthlyGbp  = (newAmountPence / 100).toFixed(2);
  console.log(`[child/add] childCount:${childCount} → £${newMonthlyGbp}/month`);

  // Update Stripe subscription (non-fatal)
  if (stripeKey && childCount > 1) {
    try {
      const parentProfileRes = await sbFetch(
        `profiles?id=eq.${callerId}&select=stripe_subscription_id`, 'GET', undefined, serviceKey
      );
      const [parentProfile] = parentProfileRes.ok ? await parentProfileRes.json() : [];
      let stripeSubId = parentProfile?.stripe_subscription_id || null;

      if (!stripeSubId) {
        const parentSubRes = await sbFetch(
          `parent_subscriptions?parent_id=eq.${callerId}&select=stripe_subscription_id,subscription_status`,
          'GET', undefined, serviceKey
        );
        const [parentSub] = parentSubRes.ok ? await parentSubRes.json() : [];
        const subStatus   = parentSub?.subscription_status;
        if (subStatus === 'active' || subStatus === 'trialing') {
          stripeSubId = parentSub?.stripe_subscription_id || null;
        } else {
          console.log(`[child/add] subscription_status='${subStatus || 'none'}' — skipping billing update`);
        }
      }

      if (stripeSubId) {
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubId}`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` },
        });
        const sub = subRes.ok ? await subRes.json() : null;
        if (sub?.items?.data?.length > 0) {
          const item          = sub.items.data[0];
          const currentAmount = item.price.unit_amount;
          const productId     = item.price.product;
          if (currentAmount !== newAmountPence) {
            const params = new URLSearchParams();
            params.append('items[0][id]',                              item.id);
            params.append('items[0][price_data][currency]',            'gbp');
            params.append('items[0][price_data][product]',             productId);
            params.append('items[0][price_data][recurring][interval]', 'month');
            params.append('items[0][price_data][unit_amount]',         String(newAmountPence));
            params.append('proration_behavior',                        'none');
            const updateRes = await stripeFetch(`subscriptions/${stripeSubId}`, params, stripeKey);
            const updated   = await updateRes.json();
            if (!updateRes.ok) console.error('[child/add] Stripe update error:', updated.error?.message);
            else console.log(`[child/add] Stripe updated → £${newMonthlyGbp}/month`);
          }
        }
      }
    } catch (err) {
      console.error('[child/add] Stripe update failed (non-fatal):', err.message);
    }
  }

  // Update parent_subscriptions.children_count
  try {
    const upsertRes = await sbFetch(
      'parent_subscriptions', 'POST',
      { parent_id: callerId, children_count: childCount },
      serviceKey,
      { 'Prefer': 'resolution=merge-duplicates,return=minimal', 'on_conflict': 'parent_id' }
    );
    if (!upsertRes.ok) {
      const text = await upsertRes.text();
      console.error('[child/add] children_count upsert error:', text.slice(0, 200));
    }
  } catch (err) {
    console.error('[child/add] children_count update failed (non-fatal):', err.message);
  }

  return res.status(200).json({ ok: true, childId: child.id, name: child.name, childCount, newMonthlyGbp });
}

// ── action=edit ───────────────────────────────────────────────────────────────
async function handleEdit(req, res, serviceKey, callerId) {
  const { childId, name, year_group, exam_year } = req.body || {};
  const trimmedName = (name || '').trim().slice(0, 64);
  if (!childId)     return res.status(400).json({ ok: false, error: 'childId is required' });
  if (!trimmedName) return res.status(400).json({ ok: false, error: 'Name is required' });
  if (!['P6', 'P7'].includes(year_group)) return res.status(400).json({ ok: false, error: 'year_group must be P6 or P7' });

  const examYearInt = parseInt(exam_year, 10);
  if (!examYearInt || examYearInt < 2025 || examYearInt > 2040) {
    return res.status(400).json({ ok: false, error: 'Invalid exam year' });
  }

  // Verify caller is the child or the parent of the child
  let authorized = childId === callerId;
  if (!authorized) {
    const ownerRes  = await sbFetch(`profiles?id=eq.${childId}&parent_id=eq.${callerId}&select=id`, 'GET', undefined, serviceKey);
    const ownerRows = ownerRes.ok ? await ownerRes.json() : [];
    authorized = Array.isArray(ownerRows) && ownerRows.length > 0;
  }
  if (!authorized) return res.status(403).json({ ok: false, error: 'Not authorised for this child' });

  const patchRes = await sbFetch(
    `profiles?id=eq.${childId}`, 'PATCH',
    { name: trimmedName, year_group, exam_year: examYearInt, updated_at: new Date().toISOString() },
    serviceKey, { 'Prefer': 'return=representation' }
  );

  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error('[child/edit] patch error:', patchRes.status, text.slice(0, 200));
    return res.status(500).json({ ok: false, error: 'Failed to update profile' });
  }

  const rows  = await patchRes.json();
  const child = Array.isArray(rows) ? rows[0] : rows;
  console.log(`[child/edit] ✅ child ${childId} updated by ${callerId}`);
  return res.status(200).json({ ok: true, child });
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

  const callerId = await verifyJwt(jwt, serviceKey);
  if (!callerId) return res.status(401).json({ ok: false, error: 'Invalid or expired session' });

  const action = req.query?.action;
  switch (action) {
    case 'add':  return handleAdd(req, res, serviceKey, callerId);
    case 'edit': return handleEdit(req, res, serviceKey, callerId);
    default:     return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  }
}
