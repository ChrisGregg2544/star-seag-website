/* ══════════════════════════════════════════════════════
   /api/stripe-webhook.js
   Verifies Stripe webhook signature using Node's built-in
   crypto module. No npm package required.
   Uses Supabase Service Role key to bypass RLS.
══════════════════════════════════════════════════════ */

import crypto from 'crypto';

export const config = {
  api: {
    bodyParser: false,
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
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=');
    acc[key.trim()] = val;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];

  if (!timestamp || !signature) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const payload  = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (e) {
    return false;
  }
}

async function updateProfile(supabaseUrl, serviceRoleKey, filter, updates) {
  const { field, value } = filter;
  const url = `${supabaseUrl}/rest/v1/profiles?${field}=eq.${encodeURIComponent(value)}`;

  console.log('Attempting Supabase PATCH to:', url.substring(0, 60));

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey':        serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Supabase update error:', res.status, text);
    throw new Error('Supabase update failed: ' + text);
  } else {
    console.log('Profile updated successfully:', filter, updates);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookSecret  = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Debug log — shows which vars are present without exposing values
  console.log('ENV CHECK — webhookSecret:', !!webhookSecret,
    '| supabaseUrl:', supabaseUrl ? supabaseUrl.substring(0, 35) : 'MISSING',
    '| serviceRoleKey:', !!serviceRoleKey);

  if (!webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('Missing env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const rawBody   = await getRawBody(req);
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
        const session    = event.data.object;
        const email      = session.customer_details?.email || session.customer_email;
        const userId     = session.metadata?.userId;
        const customerId = session.customer;
        const subId      = session.subscription;

        console.log('Checkout completed — userId:', userId, '| email:', email);

        const updates = {
          subscription_status:    'trialing',
          stripe_customer_id:     customerId,
          stripe_subscription_id: subId,
        };

        if (userId) {
          await updateProfile(supabaseUrl, serviceRoleKey, { field: 'id', value: userId }, updates);
        } else if (email) {
          await updateProfile(supabaseUrl, serviceRoleKey, { field: 'parent_email', value: email }, updates);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub  = event.data.object;
        let status = 'inactive';
        if (sub.status === 'active')   status = 'active';
        if (sub.status === 'trialing') status = 'trialing';
        if (sub.status === 'past_due') status = 'active';

        await updateProfile(supabaseUrl, serviceRoleKey,
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
        await updateProfile(supabaseUrl, serviceRoleKey,
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
