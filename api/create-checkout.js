/* ══════════════════════════════════════════════════════
   /api/create-checkout.js
   Creates a Stripe Checkout session with 7-day free trial
══════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, userId } = req.body || {};

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Payment configuration error' });
  }

  if (!process.env.STRIPE_PRICE_ID) {
    console.error('STRIPE_PRICE_ID not set');
    return res.status(500).json({ error: 'Price configuration error' });
  }

  try {
    // Dynamic import of Stripe (works in Vercel serverless)
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
      },
      success_url: `https://star-seag-website.vercel.app/study.html?checkout=success`,
      cancel_url:  `https://star-seag-website.vercel.app/pricing.html?checkout=cancelled`,
      metadata: {
        userId: userId || '',
      },
    };

    // Pre-fill email if user is already logged in
    if (email) {
      sessionParams.customer_email = email;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log('Checkout session created:', session.id, 'for', email || 'guest');
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session' });
  }
}
