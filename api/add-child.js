/* ══════════════════════════════════════════════════════
   Create a new child profile linked to the authenticated parent,
   then update the Stripe subscription amount:
     1st child  → £15/month
     2nd child  → £25/month (£15 + £10)
     3rd child  → £35/month (£15 + £10 + £10)  etc.

   POST  Authorization: Bearer <supabase_jwt>
   Body: { name: string, year_group: 'P6' | 'P7' }
   Returns: { ok: true, childId, name, childCount, newMonthlyGbp }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey  = process.env.STRIPE_SECRET_KEY;
  if (!serviceKey) return res.status(500).json({ ok: false, error: 'Server misconfigured' });

  // ── 1. Verify parent JWT ──────────────────────────────
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ ok: false, error: 'Missing Authorization header' });

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!userRes.ok) return res.status(401).json({ ok: false, error: 'Invalid or expired session' });
  const { id: parentId } = await userRes.json();

  // ── 2. Validate inputs ────────────────────────────────
  const { name, year_group } = req.body || {};
  const trimmedName = (name || '').trim().slice(0, 64);
  if (!trimmedName) return res.status(400).json({ ok: false, error: 'Name is required' });
  if (!['P6', 'P7'].includes(year_group)) {
    return res.status(400).json({ ok: false, error: 'year_group must be P6 or P7' });
  }

  // ── 3. Insert child profile ───────────────────────────
  const insertRes = await sbFetch('profiles', 'POST', {
    parent_id:         parentId,
    name:              trimmedName,
    year_group,
    onboarded:         true,
    free_sprints_used: 0,
    updated_at:        new Date().toISOString(),
  }, serviceKey, { 'Prefer': 'return=representation' });

  if (!insertRes.ok) {
    const text = await insertRes.text();
    console.error('[add-child] insert error:', insertRes.status, text.slice(0, 300));
    return res.status(500).json({ ok: false, error: 'Failed to create child profile' });
  }
  const [child] = await insertRes.json();
  console.log(`[add-child] ✅ child ${child.id} created for parent ${parentId}`);

  // ── 4. Count all children for this parent (after insert) ──
  const countRes = await sbFetch(
    `profiles?parent_id=eq.${parentId}&select=id`,
    'GET', undefined, serviceKey
  );
  const childRows  = countRes.ok ? await countRes.json() : [];
  const childCount = Array.isArray(childRows) ? childRows.length : 1;

  // ── 5. Calculate new monthly amount ──────────────────
  // £15 first child + £10 each additional
  const newAmountPence = 1500 + Math.max(0, childCount - 1) * 1000;
  const newMonthlyGbp  = (newAmountPence / 100).toFixed(2);

  console.log(`[add-child] childCount:${childCount} → £${newMonthlyGbp}/month`);

  // ── 6. Update Stripe subscription (non-fatal) ─────────
  if (stripeKey && childCount > 1) {
    try {
      // Get stripe_subscription_id from parent's profile row
      const parentProfileRes = await sbFetch(
        `profiles?id=eq.${parentId}&select=stripe_subscription_id`,
        'GET', undefined, serviceKey
      );
      const [parentProfile]  = parentProfileRes.ok ? await parentProfileRes.json() : [];
      const stripeSubId      = parentProfile?.stripe_subscription_id;

      if (stripeSubId) {
        // Fetch current subscription from Stripe
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${stripeSubId}`, {
          headers: { 'Authorization': `Bearer ${stripeKey}` },
        });
        const sub = subRes.ok ? await subRes.json() : null;

        if (sub?.items?.data?.length > 0) {
          const item          = sub.items.data[0];
          const currentAmount = item.price.unit_amount;
          const productId     = item.price.product;

          if (currentAmount !== newAmountPence) {
            // Update subscription item with new inline price — no extra price ID needed
            const params = new URLSearchParams();
            params.append('items[0][id]',                                item.id);
            params.append('items[0][price_data][currency]',              'gbp');
            params.append('items[0][price_data][product]',               productId);
            params.append('items[0][price_data][recurring][interval]',   'month');
            params.append('items[0][price_data][unit_amount]',           String(newAmountPence));
            params.append('proration_behavior',                          'none');

            const updateRes = await stripeFetch(`subscriptions/${stripeSubId}`, params, stripeKey);
            const updated   = await updateRes.json();

            if (!updateRes.ok) {
              console.error('[add-child] Stripe update error:', updated.error?.message);
            } else {
              console.log(`[add-child] Stripe subscription updated: £${currentAmount / 100} → £${newMonthlyGbp}/month`);
            }
          } else {
            console.log('[add-child] Stripe amount unchanged — skipping update');
          }
        }
      } else {
        console.log('[add-child] No active Stripe subscription — skipping billing update');
      }
    } catch (err) {
      // Non-fatal — child was created successfully; log for manual review
      console.error('[add-child] Stripe update failed (non-fatal):', err.message);
    }
  }

  // ── 7. Update parent_subscriptions.children_count ────
  try {
    const upsertRes = await sbFetch(
      'parent_subscriptions',
      'POST',
      { parent_id: parentId, children_count: childCount },
      serviceKey,
      { 'Prefer': 'resolution=merge-duplicates,return=minimal', 'on_conflict': 'parent_id' }
    );
    if (!upsertRes.ok) {
      const text = await upsertRes.text();
      console.error('[add-child] children_count upsert error:', text.slice(0, 200));
    }
  } catch (err) {
    console.error('[add-child] children_count update failed (non-fatal):', err.message);
  }

  return res.status(200).json({
    ok:            true,
    childId:       child.id,
    name:          child.name,
    childCount,
    newMonthlyGbp,
  });
}
