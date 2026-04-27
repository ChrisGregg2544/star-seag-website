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
  if (jwt) {
    try {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${jwt}` },
      });
      if (userRes.ok) {
        const { id } = await userRes.json();
        parentId = id;

        // Count existing children
        const countRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?parent_id=eq.${parentId}&select=id`,
          {
            headers: {
              'apikey':        serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
            },
          }
        );
        if (countRes.ok) {
          const rows = await countRes.json();
          childCount = Array.isArray(rows) ? rows.length : 0;
        }
      }
    } catch (err) {
      console.warn('[create-checkout] JWT/child-count lookup failed (non-fatal):', err.message);
    }
  }

  // ── 2. Calculate price: £15 first child + £10 each additional ──
  // childCount is the number of children ALREADY added before this subscription starts.
  // For a brand-new subscriber with no children yet, childCount === 0, so price = £15.
  // If they already have children (added before subscribing), price reflects those too.
  const totalChildren  = Math.max(1, childCount);   // at least 1 (they're subscribing for someone)
  const amountPence    = 1500 + Math.max(0, totalChildren - 1) * 1000;
  const amountGbp      = (amountPence / 100).toFixed(2);

  console.log(`[create-checkout] parentId:${parentId} childCount:${childCount} → £${amountGbp}/month`);

  try {
    // ── 3. Fetch the Stripe product ID from the existing price ──
    // We reuse the same product already attached to STRIPE_PRICE_ID,
    // but create an inline price at the correct amount.
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

    // ── 4. Build Checkout session params ──────────────────
    const params = new URLSearchParams();
    params.append('mode',                                   'subscription');
    params.append('payment_method_types[]',                 'card');

    if (productId) {
      // Dynamic inline price — correct amount for this parent's child count
      params.append('line_items[0][price_data][currency]',                  'gbp');
      params.append('line_items[0][price_data][product]',                   productId);
      params.append('line_items[0][price_data][recurring][interval]',       'month');
      params.append('line_items[0][price_data][unit_amount]',               String(amountPence));
      params.append('line_items[0][quantity]',                              '1');
    } else if (priceId) {
      // Fallback: use the fixed price ID if we couldn't resolve the product
      params.append('line_items[0][price]',    priceId);
      params.append('line_items[0][quantity]', '1');
    } else {
      return res.status(500).json({ error: 'Price configuration error' });
    }

    params.append('subscription_data[trial_period_days]', '7');
    params.append('success_url',  'https://www.staraitutor.co.uk/dashboard.html?checkout=success');
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
