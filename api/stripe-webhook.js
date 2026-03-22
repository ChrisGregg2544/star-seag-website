/* ══════════════════════════════════════════════════════
   /api/stripe-webhook.js
   Verifies Stripe webhook signature using Node's built-in
   crypto module. No npm package required.
   Updates Supabase subscription_status on payment events.
══════════════════════════════════════════════════════ */

import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false, // Must be raw for signature verification
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifyStripeSignature(rawBody, sigHeader, secret) {
  // Parse the Stripe-Signature header
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=');
    acc[key.trim()] = val;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];

  if (!timestamp || !signature) return false;

  // Reject events older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  // Compute expected signature
  const payload  = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(signature, 'hex')
  );
}

async function updateProfile(supabaseUrl, supabaseKey, filter, updates) {
  const { field, value } = filter;
  const url = `${supabaseUrl}/rest/v1/profiles?${field}=eq.${encodeURIComponent(value)}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey':        supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Supabase update error:', text);
  } else {
    console.log('Profile updated:', filter, updates);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl   = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey   = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!webhookSecret || !supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    return res.status(500).end();
  }

  const rawBody  = await getRawBody(req);
  const sigHeader = req.headers['stripe-signature'];

  if (!sigHeader) {
    console.error('No stripe-signature header');
    return res.status(400).json({ error: 'No signature' });
  }

  const valid = verifyStripeSignature(rawBody.toString('utf8'), sigHeader, webhookSecret);
  if (!valid) {
    console.error('Webhook signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log('Stripe event received:', event.type);

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session     = event.data.object;
        const email       = session.customer_details?.email || session.customer_email;
        const userId      = session.metadata?.userId;
        const customerId  = session.customer;
        const subId       = session.subscription;

        const updates = {
          subscription_status:    'trialing',
          stripe_customer_id:     customerId,
          stripe_subscription_id: subId,
        };

        if (userId) {
          await updateProfile(supabaseUrl, supabaseKey, { field: 'id', value: userId }, updates);
        } else if (email) {
          await updateProfile(supabaseUrl, supabaseKey, { field: 'parent_email', value: email }, updates);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub    = event.data.object;
        let status   = 'inactive';
        if (sub.status === 'active')   status = 'active';
        if (sub.status === 'trialing') status = 'trialing';
        if (sub.status === 'past_due') status = 'active';

        await updateProfile(supabaseUrl, supabaseKey,
          { field: 'stripe_customer_id', value: sub.customer },
          {
            subscription_status:    status,
            stripe_subscription_id: sub.id,
            trial_end: sub.trial_end
              ? new Date(sub.trial_end * 1000).toISOString()
              : null,
          }
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await updateProfile(supabaseUrl, supabaseKey,
          { field: 'stripe_customer_id', value: sub.customer },
          { subscription_status: 'inactive', stripe_subscription_id: null }
        );
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
