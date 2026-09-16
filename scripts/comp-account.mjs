/**
 * comp-account.mjs — grant CARD-FREE ("comped") access to accounts, by email.
 *
 * Access model (see api/subscription.js handleCheck): a user has full access iff
 * their parent_subscriptions.subscription_status is 'active' or 'trialing'. No
 * Stripe customer/subscription is required. So a comp = upsert a
 * parent_subscriptions row keyed on parent_id (= the account's auth user id)
 * with subscription_status='active' and NO Stripe fields.
 *
 * Safe + repeatable:
 *   - Resolves each email to exactly one auth user (refuses on 0 or >1 matches).
 *   - DRY-RUN by default. Prints what would change. Add --apply to write.
 *   - Idempotent: re-running just re-sets 'active' (PATCH on the existing row),
 *     never creates duplicates.
 *   - Never touches stripe_customer_id / stripe_subscription_id, so it can't
 *     collide with real Stripe billing.
 *   - Appends every applied comp to scripts/comped-accounts.json (audit trail,
 *     since the table has no comp/notes column).
 *
 * Usage:
 *   node scripts/comp-account.mjs a@x.com b@y.com            # dry-run
 *   node scripts/comp-account.mjs a@x.com b@y.com --apply    # write
 *   node scripts/comp-account.mjs --file emails.txt --apply  # one email per line
 *   node scripts/comp-account.mjs --revoke a@x.com --apply   # set status back to 'inactive'
 */
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...r] = line.split('='); if (k && r.length) env[k.trim()] = r.join('=').trim();
}
const URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const args = process.argv.slice(2);
const APPLY  = args.includes('--apply');
const REVOKE = args.includes('--revoke');
const fileIdx = args.indexOf('--file');
let emails = args.filter(a => !a.startsWith('--') && a !== (fileIdx >= 0 ? args[fileIdx + 1] : null));
if (fileIdx >= 0 && args[fileIdx + 1]) {
  emails = emails.concat(readFileSync(args[fileIdx + 1], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean));
}
emails = [...new Set(emails.map(e => e.toLowerCase()))];
if (!emails.length) { console.error('No emails given. Usage: node scripts/comp-account.mjs <email…> [--apply] [--revoke] [--file f]'); process.exit(1); }

// Build an email→user map from the auth admin API (paginated).
async function loadAuthUsers() {
  const map = new Map();
  for (let page = 1; page <= 50; page++) {
    const r = await fetch(`${URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: H });
    if (!r.ok) throw new Error(`auth admin ${r.status}: ${(await r.text()).slice(0, 120)}`);
    const body = await r.json();
    const users = Array.isArray(body) ? body : (body.users || []);
    for (const u of users) if (u.email) {
      const e = u.email.toLowerCase();
      if (!map.has(e)) map.set(e, []);
      map.get(e).push(u.id);
    }
    if (users.length < 1000) break;
  }
  return map;
}

async function getSubRow(uid) {
  const r = await fetch(`${URL}/rest/v1/parent_subscriptions?parent_id=eq.${uid}&select=parent_id,subscription_status,stripe_customer_id,children_count`, { headers: H });
  return r.ok ? (await r.json())[0] || null : null;
}
async function childCount(uid) {
  const r = await fetch(`${URL}/rest/v1/profiles?parent_id=eq.${uid}&select=id`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '').split('/')[1]) || 0;
}

async function main() {
  const targetStatus = REVOKE ? 'inactive' : 'active';
  console.log(`comp-account — ${APPLY ? 'APPLY' : 'DRY-RUN'}  action=${REVOKE ? 'REVOKE→inactive' : 'COMP→active'}  emails=${emails.length}\n`);
  const authMap = await loadAuthUsers();

  let done = 0, skipped = 0;
  for (const email of emails) {
    const ids = authMap.get(email) || [];
    if (ids.length === 0) { console.log(`SKIP  ${email} — no auth user`); skipped++; continue; }
    if (ids.length > 1)  { console.log(`SKIP  ${email} — ${ids.length} auth users share this email (ambiguous)`); skipped++; continue; }
    const uid = ids[0];
    const existing = await getSubRow(uid);
    const from = existing?.subscription_status || '(no row)';
    const hasStripe = !!existing?.stripe_customer_id;
    const note = hasStripe ? '  ⚠ has a real Stripe customer — comp will override status but leave Stripe intact' : '';

    if (!APPLY) { console.log(`WOULD  ${email}  ${uid}  ${from} → ${targetStatus}${note}`); continue; }

    let res;
    if (existing) {
      res = await fetch(`${URL}/rest/v1/parent_subscriptions?parent_id=eq.${uid}`, {
        method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ subscription_status: targetStatus, updated_at: new Date().toISOString() }),
      });
    } else {
      res = await fetch(`${URL}/rest/v1/parent_subscriptions`, {
        method: 'POST', headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ parent_id: uid, subscription_status: targetStatus, children_count: await childCount(uid), updated_at: new Date().toISOString() }),
      });
    }
    if (res.ok) {
      console.log(`OK    ${email}  ${uid}  ${from} → ${targetStatus}${note}`);
      const log = resolve(__dir, 'comped-accounts.json');
      const entry = { email, uid, action: REVOKE ? 'revoke' : 'comp', from, to: targetStatus, at: new Date().toISOString() };
      const arr = existsSync(log) ? JSON.parse(readFileSync(log, 'utf8')) : [];
      arr.push(entry); writeFileSync(log, JSON.stringify(arr, null, 2));
      done++;
    } else {
      console.log(`FAIL  ${email}  ${uid}  ${res.status} ${(await res.text()).slice(0, 120)}`); skipped++;
    }
  }
  console.log(`\n${APPLY ? 'applied' : 'would apply'}: ${emails.length - skipped}  | skipped: ${skipped}`);
  if (!APPLY) console.log('DRY-RUN — nothing written. Re-run with --apply to commit.');
}
main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
