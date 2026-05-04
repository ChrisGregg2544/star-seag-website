/* ══════════════════════════════════════════════════════
   /api/create-checkout.js
   Creates a Stripe Checkout session with per-child pricing:
     1st child  → £15/month
     2nd child  → £25/month (£15 + £10)
     etc.

   POST  Authorization: Bearer <supabase_jwt>  (optional — falls back to flat £15)
   Body: { email?, userId? }
   Returns: { url: string } or { error: string }
══════════════════════════════════════════════════════ */
export const config = { maxDuration: 15 };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secretKey  = process.env.STRIPE_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey)  return res.status(500).json({ error: 'Payment configuration error' });
  if (!serviceKey) return res.status(500).json({ error: 'Server misconfigured' });

  const { email, userId } = req.body || {};

  // ── 1. Resolve parent identity & child count ──────────
  let parentId   = userId || null;
  let childCount = 0;

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  console.log(`[create-checkout] jwt present: ${!!jwt}, userId from body: ${userId || 'none'}`);

  if (jwt) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
      });
      console.log(`[create-checkout] JWT verify status: ${userRes.status}`);

      if (userRes.ok) {
        const userJson = await userRes.json();
        parentId = userJson.id;
        console.log(`[create-checkout] JWT verified, parentId: ${parentId}`);

        // Count existing children
        const countUrl = `${SUPABASE_URL}/rest/v1/profiles?parent_id=eq.${parentId}&select=id`;
        const countRes = await fetch(countUrl, {
          headers: {
            'apikey':        serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
        });
        console.log(`[create-checkout] child count query status: ${countRes.status}`);

        if (countRes.ok) {
          const rows = await countRes.json();
          childCount = Array.isArray(rows) ? rows.length : 0;
          console.log(`[create-checkout] child rows raw:`, JSON.stringify(rows));
        } else {
          const errText = await countRes.text();
          console.error(`[create-checkout] child count query failed:`, errText.slice(0, 200));
        }
      } else {
        const errText = await userRes.text();
        console.error(`[create-checkout] JWT verify failed:`, errText.slice(0, 200));
      }
    } catch (err) {
      console.warn('[create-checkout] JWT/child-count lookup failed (non-fatal):', err.message);
    }
  } else {
    console.log('[create-checkout] no JWT — skipping child count, will use childCount=0');
  }

  // ── 2. Calculate price: £15 first child + £10 each additional ──
  const totalChildren = Math.max(1, childCount);
  const amountPence   = 1500 + Math.max(0, totalChildren - 1) * 1000;
  const amountGbp     = (amountPence / 100).toFixed(2);

  console.log(`[create-checkout] childCount:${childCount} totalChildren:${totalChildren} amountPence:${amountPence} → £${amountGbp}/month`);

  try {
    // ── 3. Fetch the Stripe product ID from the existing price ──
    // We reuse the same product already attached to STRIPE_PRICE_ID,
    // but create an inline price at the correct amount.
    const priceId = process.env.STRIPE_PRICE_ID;
    let productId = null;

    console.log(`[create-checkout] STRIPE_PRICE_ID set: ${!!priceId} (${priceId || 'missing'})`);

    if (priceId) {
      const priceRes = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
        headers: { 'Authorization': `Bearer ${secretKey}` },
      });
      console.log(`[create-checkout] Stripe price lookup status: ${priceRes.status}`);
      if (priceRes.ok) {
        const priceObj = await priceRes.json();
        productId = priceObj.product;
        console.log(`[create-checkout] resolved productId: ${productId}`);
      } else {
        const errText = await priceRes.text();
        console.error(`[create-checkout] Stripe price lookup failed:`, errText.slice(0, 200));
      }
    }

    // ── 4. Build Checkout session params ──────────────────
    const params = new URLSearchParams();
    params.append('mode',                                   'subscription');
    params.append('payment_method_types[]',                 'card');

    if (productId) {
      console.log(`[create-checkout] PATH: dynamic price_data — £${amountGbp} for product ${productId}`);
      params.append('line_items[0][price_data][currency]',                  'gbp');
      params.append('line_items[0][price_data][product]',                   productId);
      params.append('line_items[0][price_data][recurring][interval]',       'month');
      params.append('line_items[0][price_data][unit_amount]',               String(amountPence));
      params.append('line_items[0][quantity]',                              '1');
    } else if (priceId) {
      console.log(`[create-checkout] PATH: fallback fixed priceId ${priceId} (product lookup failed) — will charge fixed amount, NOT £${amountGbp}`);
      params.append('line_items[0][price]',    priceId);
      params.append('line_items[0][quantity]', '1');
    } else {
      console.error(`[create-checkout] PATH: no priceId and no productId — aborting`);
      return res.status(500).json({ error: 'Price configuration error' });
    }

    params.append('subscription_data[trial_period_days]', '7');
    params.append('success_url',  'https://www.staraitutor.co.uk/dashboard.html?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url',   'https://www.staraitutor.co.uk/pricing.html?checkout=cancelled');

    if (parentId) params.append('metadata[userId]',       parentId);
    if (email)    params.append('customer_email',          email);

    // ── 5. Create Checkout session ────────────────────────
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('[create-checkout] Stripe error:', session.error);
      return res.status(500).json({ error: session.error?.message || 'Stripe error' });
    }

    console.log(`[create-checkout] ✅ session ${session.id} created for ${email || parentId || 'guest'} at £${amountGbp}/month`);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[create-checkout] error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
