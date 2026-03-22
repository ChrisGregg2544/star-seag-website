/* ══════════════════════════════════════════════════════
   /api/stripe-webhook.js
   Listens for Stripe events and updates Supabase
   subscription_status in the profiles table
══════════════════════════════════════════════════════ */

export const config = {
  api: {
    bodyParser: false, // Must be raw for Stripe signature verification
  },
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('Missing Stripe env vars');
    return res.status(500).end();
  }

  const Stripe        = (await import('stripe')).default;
  const { createClient } = await import('@supabase/supabase-js');

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  // Verify Stripe signature
  const rawBody = await getRawBody(req);
  const sig     = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log('Stripe event received:', event.type);

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const email   = session.customer_details?.email || session.customer_email;
        const userId  = session.metadata?.userId;
        const customerId     = session.customer;
        const subscriptionId = session.subscription;

        console.log('Checkout completed for:', email, 'userId:', userId);

        if (userId) {
          // Update by Supabase user ID (most reliable)
          await sb.from('profiles').update({
            subscription_status:    'trialing',
            stripe_customer_id:     customerId,
            stripe_subscription_id: subscriptionId,
          }).eq('id', userId);
        } else if (email) {
          // Fallback: match by email
          await sb.from('profiles').update({
            subscription_status:    'trialing',
            stripe_customer_id:     customerId,
            stripe_subscription_id: subscriptionId,
          }).eq('parent_email', email);
        }
        break;
      }

      case 'customer.subscription.created': {
        const sub    = event.data.object;
        const status = sub.trial_end && sub.status === 'trialing' ? 'trialing' : 'active';
        await updateByCustomerId(sb, sub.customer, {
          subscription_status:    status,
          stripe_subscription_id: sub.id,
          trial_end: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
        });
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        let status = 'inactive';
        if (sub.status === 'active')   status = 'active';
        if (sub.status === 'trialing') status = 'trialing';
        if (sub.status === 'past_due') status = 'active'; // Grace period
        await updateByCustomerId(sb, sub.customer, {
          subscription_status:    status,
          stripe_subscription_id: sub.id,
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await updateByCustomerId(sb, sub.customer, {
          subscription_status:    'inactive',
          stripe_subscription_id: null,
        });
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

async function updateByCustomerId(sb, customerId, updates) {
  const { error } = await sb
    .from('profiles')
    .update(updates)
    .eq('stripe_customer_id', customerId);

  if (error) {
    console.error('Supabase update error:', error.message);
  } else {
    console.log('Profile updated for customer:', customerId, updates);
  }
}
