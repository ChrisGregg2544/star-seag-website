/**
 * restore-failed-questions.js
 * Restores all questions that were marked validated=false + validator_verdict=fail
 * by the bulk validator run. Sets them back to validated=true, validator_verdict=null.
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const envVars = {};
for (const line of readFileSync(resolve(__dir, '../.env'), 'utf8').split('\n')) {
  const [k, ...rest] = line.split('=');
  if (k && rest.length) envVars[k.trim()] = rest.join('=').trim();
}

const SUPABASE_URL = 'https://iutcgogmxhaqgaxkznxu.supabase.co';
const SERVICE_KEY  = envVars.SUPABASE_SERVICE_ROLE_KEY || envVars.SUPABASE_SERVICE_KEY;

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }

const headers = {
  apikey:         SERVICE_KEY,
  Authorization:  `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  Prefer:         'return=minimal',
};

async function main() {
  // First count how many need restoring
  const countRes = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?validated=eq.false&validator_verdict=eq.fail&select=id`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const rows = await countRes.json();
  console.log(`Found ${rows.length} questions to restore.`);
  if (!rows.length) { console.log('Nothing to do.'); return; }

  // Bulk restore: set validated=true, clear validator_verdict
  const patchRes = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?validated=eq.false&validator_verdict=eq.fail`,
    {
      method:  'PATCH',
      headers,
      body:    JSON.stringify({ validated: true, validator_verdict: null }),
    }
  );

  if (!patchRes.ok) {
    console.error(`PATCH failed (${patchRes.status}): ${await patchRes.text()}`);
    process.exit(1);
  }

  console.log(`Restored ${rows.length} questions → validated=true, validator_verdict=null.`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
