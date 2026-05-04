/* ══════════════════════════════════════════════════════
   /api/verify-checkout.js
   Called by dashboard.html immediately after a Stripe redirect.
   Fetches the checkout session directly from Stripe, writes
   subscription state to DB, and returns { subscribed, status }.

   This eliminates the race condition where the Stripe webhook
   arrives after the user is already on the dashboard.

   GET  ?session_id=cs_...  Authorization: Bearer <supabase_jwt>
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey  = process.env.STRIPE_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeKey || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const sessionId = req.query.session_id;
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session_id' });
  }

  // ── 1. Verify caller's JWT to get parentId ─────────────────────────────────
  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let parentId = null;

  if (jwt) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
      });
      if (userRes.ok) {
        const u = await userRes.json();
        parentId = u.id;
      }
    } catch { /* non-fatal */ }
  }

  // ── 2. Fetch checkout session from Stripe ──────────────────────────────────
  const stripeRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=subscription`,
    { headers: { 'Authorization': `Bearer ${stripeKey}` } }
  );

  if (!stripeRes.ok) {
    const txt = await stripeRes.text();
    console.error('[verify-checkout] Stripe fetch failed:', txt.slice(0, 200));
    return res.status(502).json({ error: 'Failed to verify session with Stripe' });
  }

  const session = await stripeRes.json();
  console.log('[verify-checkout] session.payment_status:', session.payment_status, '| sub status:', session.subscription?.status);

  // ── 3. Determine subscription state ───────────────────────────────────────
  const sub        = session.subscription; // expanded object or null
  const customerId = session.customer;
  const subId      = typeof sub === 'string' ? sub : sub?.id;
  const subStatus  = sub?.status || null;

  // Map Stripe status → our internal status
  let status = 'inactive';
  if (subStatus === 'trialing') status = 'trialing';
  else if (subStatus === 'active') status = 'active';
  else if (subStatus === 'past_due') status = 'active';
  // Also treat a completed checkout with a trial as trialing even if sub hasn't resolved
  else if (session.payment_status === 'no_payment_required' && session.status === 'complete') status = 'trialing';

  const subscribed = status === 'trialing' || status === 'active';
  const trialEnd   = sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;

  // ── 4. Write to DB (idempotent — safe to call multiple times) ─────────────
  const metaUserId = session.metadata?.userId || null;
  const resolvedId = parentId || metaUserId;

  if (resolvedId && subscribed) {
    const updates = {
      subscription_status:    status,
      stripe_customer_id:     customerId,
      stripe_subscription_id: subId,
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    };

    const [profRes, subRes] = await Promise.all([
      sbFetch(
        `profiles?id=eq.${resolvedId}`,
        'PATCH', updates, serviceKey, { Prefer: 'return=minimal' }
      ),
      sbFetch(
        'parent_subscriptions',
        'POST',
        { parent_id: resolvedId, ...updates },
        serviceKey,
        { Prefer: 'resolution=merge-duplicates,return=minimal' }
      ),
    ]);

    if (!profRes.ok) {
      const t = await profRes.text();
      console.error('[verify-checkout] profiles PATCH failed:', t.slice(0, 200));
    }
    if (!subRes.ok) {
      const t = await subRes.text();
      console.error('[verify-checkout] parent_subscriptions upsert failed:', t.slice(0, 200));
    } else {
      console.log('[verify-checkout] DB updated — parentId:', resolvedId, '| status:', status);
    }
  } else if (!subscribed) {
    console.log('[verify-checkout] session not yet subscribed — status:', status, '| paymentStatus:', session.payment_status);
  } else {
    console.warn('[verify-checkout] could not resolve parentId — metaUserId:', metaUserId, '| jwt parentId:', parentId);
  }

  return res.status(200).json({ subscribed, status });
}
