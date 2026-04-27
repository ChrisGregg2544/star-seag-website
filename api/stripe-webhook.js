/* ══════════════════════════════════════════════════════
   /api/stripe-webhook.js
   Handles Stripe events and syncs subscription state to:
     • profiles             — checked by pricing.html
     • parent_subscriptions — checked by save-session.js / add-child.js
══════════════════════════════════════════════════════ */

import crypto from 'crypto';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';

// ── Raw body reader (needed for Stripe signature verification) ────────────────
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Stripe signature verification ─────────────────────────────────────────────
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

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────
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

async function patchProfiles(serviceKey, filterField, filterValue, updates) {
  const res = await sbFetch(
    `profiles?${filterField}=eq.${encodeURIComponent(filterValue)}`,
    'PATCH', updates, serviceKey, { 'Prefer': 'return=minimal' }
  );
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[webhook] profiles PATCH failed (${filterField}=${filterValue}):`, txt.slice(0, 200));
  } else {
    console.log(`[webhook] profiles updated (${filterField}=${filterValue}):`, updates);
  }
}

async function upsertParentSub(serviceKey, parentId, updates) {
  const res = await sbFetch(
    'parent_subscriptions',
    'POST',
    { parent_id: parentId, ...updates },
    serviceKey,
    { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
  );
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[webhook] parent_subscriptions UPSERT failed (parent_id=${parentId}):`, txt.slice(0, 200));
  } else {
    console.log(`[webhook] parent_subscriptions upserted (parent_id=${parentId}):`, updates);
  }
}

async function patchParentSub(serviceKey, filterField, filterValue, updates) {
  const res = await sbFetch(
    `parent_subscriptions?${filterField}=eq.${encodeURIComponent(filterValue)}`,
    'PATCH', updates, serviceKey, { 'Prefer': 'return=minimal' }
  );
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[webhook] parent_subscriptions PATCH failed (${filterField}=${filterValue}):`, txt.slice(0, 200));
  } else {
    console.log(`[webhook] parent_subscriptions updated (${filterField}=${filterValue}):`, updates);
  }
}

// ── Webhook handler ───────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const webhookSecret  = process.env.STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[webhook] env — webhookSecret:', !!webhookSecret, '| serviceRoleKey:', !!serviceRoleKey);

  if (!webhookSecret || !serviceRoleKey) {
    console.error('[webhook] missing env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const rawBody   = await getRawBody(req);
  const sigHeader = req.headers['stripe-signature'];
  if (!sigHeader) {
    console.error('[webhook] no stripe-signature header');
    return res.status(400).json({ error: 'No signature' });
  }

  const valid = verifyStripeSignature(rawBody.toString('utf8'), sigHeader, webhookSecret);
  if (!valid) {
    console.error('[webhook] signature verification failed');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  console.log('[webhook] event received:', event.type);

  try {
    switch (event.type) {

      // ── Checkout completed ─────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session    = event.data.object;
        const userId     = session.metadata?.userId;
        const customerId = session.customer;
        const subId      = session.subscription;
        const email      = session.customer_details?.email || session.customer_email;

        console.log('[webhook] checkout.session.completed — userId:', userId, '| customerId:', customerId, '| subId:', subId);

        const subUpdates = {
          subscription_status:    'trialing',
          stripe_customer_id:     customerId,
          stripe_subscription_id: subId,
        };

        if (userId) {
          // Write to both tables
          await Promise.all([
            patchProfiles(serviceRoleKey, 'id', userId, subUpdates),
            upsertParentSub(serviceRoleKey, userId, subUpdates),
          ]);
        } else if (email) {
          // Fallback: look up parent by email in auth.users via profiles
          console.warn('[webhook] no userId in metadata — falling back to email lookup:', email);
          await patchProfiles(serviceRoleKey, 'email', email, subUpdates);
        } else {
          console.error('[webhook] checkout.session.completed — no userId or email, cannot update DB');
        }
        break;
      }

      // ── Subscription created / updated ─────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub        = event.data.object;
        const customerId = sub.customer;
        let   status     = 'inactive';
        if (sub.status === 'active')   status = 'active';
        if (sub.status === 'trialing') status = 'trialing';
        if (sub.status === 'past_due') status = 'active';

        const trialEnd = sub.trial_end
          ? new Date(sub.trial_end * 1000).toISOString()
          : null;

        console.log('[webhook]', event.type, '— customerId:', customerId, '| status:', status, '| trial_end:', trialEnd);

        const subUpdates = {
          subscription_status:    status,
          stripe_subscription_id: sub.id,
          trial_end:              trialEnd,
        };

        await Promise.all([
          patchProfiles(serviceRoleKey, 'stripe_customer_id', customerId, subUpdates),
          patchParentSub(serviceRoleKey, 'stripe_customer_id', customerId, subUpdates),
        ]);
        break;
      }

      // ── Subscription cancelled ─────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub        = event.data.object;
        const customerId = sub.customer;

        console.log('[webhook] subscription.deleted — customerId:', customerId);

        const subUpdates = { subscription_status: 'inactive', stripe_subscription_id: null };

        await Promise.all([
          patchProfiles(serviceRoleKey, 'stripe_customer_id', customerId, subUpdates),
          patchParentSub(serviceRoleKey, 'stripe_customer_id', customerId, subUpdates),
        ]);
        break;
      }

      default:
        console.log('[webhook] unhandled event type:', event.type);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('[webhook] handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
