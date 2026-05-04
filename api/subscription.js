/* ══════════════════════════════════════════════════════
   /api/subscription.js
   Consolidated Stripe + subscription endpoints.
   Route via ?action= query param:

     GET  ?action=check               — check subscription status
     GET  ?action=verify&session_id=  — verify Stripe checkout session
     POST ?action=create              — create Stripe Checkout session
     POST ?action=portal              — create Stripe Customer Portal session
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 15 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

// ── Shared helpers ────────────────────────────────────────────────────────────
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

async function resolveJwt(jwt, serviceKey) {
  if (!jwt) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u.id || null;
}

// ── action=check ──────────────────────────────────────────────────────────────
async function handleCheck(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return res.status(500).json({ error: 'Server misconfigured' });

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ error: 'Missing Authorization header' });

  const parentId = await resolveJwt(jwt, serviceKey);
  if (!parentId) return res.status(401).json({ error: 'Invalid or expired token' });

  const subRes = await fetch(
    `${SUPABASE_URL}/rest/v1/parent_subscriptions?parent_id=eq.${parentId}&select=subscription_status,trial_end`,
    { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
  );

  if (!subRes.ok) {
    const txt = await subRes.text();
    console.error('[subscription/check] query failed:', txt.slice(0, 200));
    return res.status(500).json({ error: 'Database query failed' });
  }

  const rows     = await subRes.json();
  const row      = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  const status   = row?.subscription_status || null;
  const subscribed = status === 'active' || status === 'trialing';

  console.log(`[subscription/check] parentId:${parentId} status:${status} subscribed:${subscribed}`);
  return res.status(200).json({ subscribed, status });
}

// ── action=verify ─────────────────────────────────────────────────────────────
async function handleVerify(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const stripeKey  = process.env.STRIPE_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!stripeKey || !serviceKey) return res.status(500).json({ error: 'Server misconfigured' });

  const sessionId = req.query.session_id;
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return res.status(400).json({ error: 'Invalid session_id' });
  }

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  let parentId = null;
  try { parentId = await resolveJwt(jwt, serviceKey); } catch { /* non-fatal */ }

  const stripeRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=subscription`,
    { headers: { 'Authorization': `Bearer ${stripeKey}` } }
  );

  if (!stripeRes.ok) {
    const txt = await stripeRes.text();
    console.error('[subscription/verify] Stripe fetch failed:', txt.slice(0, 200));
    return res.status(502).json({ error: 'Failed to verify session with Stripe' });
  }

  const session    = await stripeRes.json();
  const sub        = session.subscription;
  const customerId = session.customer;
  const subId      = typeof sub === 'string' ? sub : sub?.id;
  const subStatus  = sub?.status || null;

  let status = 'inactive';
  if (subStatus === 'trialing')  status = 'trialing';
  else if (subStatus === 'active')   status = 'active';
  else if (subStatus === 'past_due') status = 'active';
  else if (session.payment_status === 'no_payment_required' && session.status === 'complete') status = 'trialing';

  const subscribed = status === 'trialing' || status === 'active';
  const trialEnd   = sub?.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
  const resolvedId = parentId || session.metadata?.userId || null;

  if (resolvedId && subscribed) {
    const updates = {
      subscription_status:    status,
      stripe_customer_id:     customerId,
      stripe_subscription_id: subId,
      ...(trialEnd ? { trial_end: trialEnd } : {}),
    };
    const [profRes, subRes] = await Promise.all([
      sbFetch(`profiles?id=eq.${resolvedId}`, 'PATCH', updates, serviceKey, { Prefer: 'return=minimal' }),
      sbFetch('parent_subscriptions', 'POST', { parent_id: resolvedId, ...updates }, serviceKey,
        { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    ]);
    if (!profRes.ok) console.error('[subscription/verify] profiles PATCH failed:', (await profRes.text()).slice(0, 200));
    if (!subRes.ok)  console.error('[subscription/verify] parent_subscriptions upsert failed:', (await subRes.text()).slice(0, 200));
    else             console.log('[subscription/verify] DB updated — parentId:', resolvedId, '| status:', status);
  }

  return res.status(200).json({ subscribed, status });
}

// ── action=create ─────────────────────────────────────────────────────────────
async function handleCreate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretKey  = process.env.STRIPE_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secretKey)  return res.status(500).json({ error: 'Payment configuration error' });
  if (!serviceKey) return res.status(500).json({ error: 'Server misconfigured' });

  const { email, userId } = req.body || {};
  let parentId   = userId || null;
  let childCount = 0;

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  console.log(`[subscription/create] jwt present: ${!!jwt}, userId from body: ${userId || 'none'}`);

  if (jwt) {
    try {
      const resolvedId = await resolveJwt(jwt, serviceKey);
      if (resolvedId) {
        parentId = resolvedId;
        const countRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?parent_id=eq.${parentId}&select=id`,
          { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
        );
        if (countRes.ok) {
          const rows = await countRes.json();
          childCount = Array.isArray(rows) ? rows.length : 0;
        }
      }
    } catch (err) {
      console.warn('[subscription/create] JWT/child-count lookup failed (non-fatal):', err.message);
    }
  }

  const totalChildren = Math.max(1, childCount);
  const amountPence   = 1500 + Math.max(0, totalChildren - 1) * 1000;
  const amountGbp     = (amountPence / 100).toFixed(2);
  console.log(`[subscription/create] childCount:${childCount} → £${amountGbp}/month`);

  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    let productId = null;

    if (priceId) {
      const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
        headers: { 'Authorization': `Bearer ${secretKey}` },
      });
      if (priceRes.ok) {
        const priceObj = await priceRes.json();
        productId = priceObj.product;
      }
    }

    const params = new URLSearchParams();
    params.append('mode',                    'subscription');
    params.append('payment_method_types[]',  'card');

    if (productId) {
      params.append('line_items[0][price_data][currency]',            'gbp');
      params.append('line_items[0][price_data][product]',             productId);
      params.append('line_items[0][price_data][recurring][interval]', 'month');
      params.append('line_items[0][price_data][unit_amount]',         String(amountPence));
      params.append('line_items[0][quantity]',                        '1');
    } else if (priceId) {
      params.append('line_items[0][price]',    priceId);
      params.append('line_items[0][quantity]', '1');
    } else {
      return res.status(500).json({ error: 'Price configuration error' });
    }

    params.append('subscription_data[trial_period_days]', '7');
    params.append('success_url', 'https://www.staraitutor.co.uk/dashboard.html?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url',  'https://www.staraitutor.co.uk/pricing.html?checkout=cancelled');

    if (parentId) params.append('metadata[userId]', parentId);
    if (email)    params.append('customer_email',   email);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const session = await response.json();
    if (!response.ok) {
      console.error('[subscription/create] Stripe error:', session.error);
      return res.status(500).json({ error: session.error?.message || 'Stripe error' });
    }

    console.log(`[subscription/create] session ${session.id} created for ${email || parentId || 'guest'} at £${amountGbp}/month`);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[subscription/create] error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}

// ── action=portal ─────────────────────────────────────────────────────────────
async function handlePortal(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Payment configuration error' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const customerRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
      { headers: { 'Authorization': `Bearer ${secretKey}` } }
    );
    const customerData = await customerRes.json();

    if (!customerRes.ok) return res.status(500).json({ error: customerData.error?.message || 'Stripe error' });
    if (!customerData.data?.length) return res.status(404).json({ error: 'No Stripe customer found for this account' });

    const customerId = customerData.data[0].id;
    const portalParams = new URLSearchParams();
    portalParams.append('customer',   customerId);
    portalParams.append('return_url', 'https://www.staraitutor.co.uk/dashboard.html');

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: portalParams.toString(),
    });

    const session = await portalRes.json();
    if (!portalRes.ok) return res.status(500).json({ error: session.error?.message || 'Stripe error' });

    console.log('[subscription/portal] session created for customer:', customerId);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[subscription/portal] error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create portal session' });
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;
  switch (action) {
    case 'check':  return handleCheck(req, res);
    case 'verify': return handleVerify(req, res);
    case 'create': return handleCreate(req, res);
    case 'portal': return handlePortal(req, res);
    default:       return res.status(400).json({ error: `Unknown action: ${action}` });
  }
}
