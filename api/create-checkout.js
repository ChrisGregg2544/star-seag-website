/* ══════════════════════════════════════════════════════
   /api/create-checkout.js
   Creates a Stripe Checkout session using REST API directly.
   No npm package required — uses native fetch.
══════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, userId } = req.body || {};

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId   = process.env.STRIPE_PRICE_ID;

  if (!secretKey) return res.status(500).json({ error: 'Payment configuration error' });
  if (!priceId)   return res.status(500).json({ error: 'Price configuration error' });

  try {
    // Build x-www-form-urlencoded body for Stripe REST API
    const params = new URLSearchParams();
    params.append('mode',                                      'subscription');
    params.append('payment_method_types[]',                    'card');
    params.append('line_items[0][price]',                      priceId);
    params.append('line_items[0][quantity]',                   '1');
    params.append('subscription_data[trial_period_days]',      '7');
    params.append('success_url',  'https://star-seag-website.vercel.app/study.html?checkout=success');
    params.append('cancel_url',   'https://star-seag-website.vercel.app/pricing.html?checkout=cancelled');

    if (userId) params.append('metadata[userId]', userId);
    if (email)  params.append('customer_email',   email);

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
      console.error('Stripe API error:', session.error);
      return res.status(500).json({ error: session.error?.message || 'Stripe error' });
    }

    console.log('Checkout session created:', session.id, 'for', email || 'guest');
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Create checkout error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
