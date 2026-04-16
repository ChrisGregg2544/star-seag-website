/* ══════════════════════════════════════════════════════
   /api/create-portal-session.js
   Creates a Stripe Customer Portal session so subscribers
   can manage or cancel their subscription.
   Uses Stripe REST API directly — no npm package required.
══════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};

  if (!email) return res.status(400).json({ error: 'Email is required' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(500).json({ error: 'Payment configuration error' });

  try {
    // Look up Stripe customer by email
    const customerRes = await fetch(
      `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${secretKey}` },
      }
    );

    const customerData = await customerRes.json();

    if (!customerRes.ok) {
      console.error('Stripe customer lookup error:', customerData.error);
      return res.status(500).json({ error: customerData.error?.message || 'Stripe error' });
    }

    if (!customerData.data || customerData.data.length === 0) {
      return res.status(404).json({ error: 'No Stripe customer found for this account' });
    }

    const customerId = customerData.data[0].id;

    // Create billing portal session
    const portalParams = new URLSearchParams();
    portalParams.append('customer',   customerId);
    portalParams.append('return_url', 'https://www.staraitutor.co.uk/dashboard.html');

    const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: portalParams.toString(),
    });

    const session = await portalRes.json();

    if (!portalRes.ok) {
      console.error('Stripe portal session error:', session.error);
      return res.status(500).json({ error: session.error?.message || 'Stripe error' });
    }

    console.log('Portal session created for customer:', customerId);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Create portal session error:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to create portal session' });
  }
}
