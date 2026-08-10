/**
 * backup-question-bank.mjs  (F1)
 *
 * Exports the question bank (questions + passages tables) to timestamped JSON
 * files under ./backups, keeping the 4 most recent of each. The questions table
 * is the core business asset and currently has no backup — run this weekly.
 *
 * Usage:
 *   node scripts/backup-question-bank.mjs
 *   node scripts/backup-question-bank.mjs --keep 8   # keep 8 rotations instead of 4
 *
 * Windows Task Scheduler / cron friendly: exits non-zero on failure.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, statSync } from 'fs';
import { dirname, resolve, join } from 'path';
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

const keepArg = process.argv.indexOf('--keep');
const KEEP = keepArg > -1 ? Math.max(1, parseInt(process.argv[keepArg + 1], 10) || 4) : 4;
const BACKUP_DIR = resolve(__dir, '../backups');

// Fetch a whole table via the REST API in 1000-row pages (bypasses the JS cap).
async function fetchAll(table) {
  const rows = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id&limit=${size}&offset=${from}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) throw new Error(`${table} fetch ${res.status}: ${(await res.text()).slice(0, 150)}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < size) break;
    from += size;
  }
  return rows;
}

function pruneOldBackups(prefix) {
  const files = readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .map(f => ({ f, t: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(KEEP)) {
    unlinkSync(join(BACKUP_DIR, f));
    console.log(`  pruned old backup: ${f}`);
  }
}

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // 2026-08-04T12-30-00

  for (const table of ['questions', 'passages']) {
    process.stdout.write(`Backing up ${table} ... `);
    const rows = await fetchAll(table);
    const path = join(BACKUP_DIR, `${table}-${stamp}.json`);
    writeFileSync(path, JSON.stringify({ table, exported_at: new Date().toISOString(), count: rows.length, rows }, null, 0));
    const kb = (statSync(path).size / 1024).toFixed(0);
    console.log(`${rows.length} rows -> ${path.split(/[\\/]/).pop()} (${kb} KB)`);
    pruneOldBackups(`${table}-`);
  }

  console.log(`\nBackup complete. Keeping the ${KEEP} most recent of each table in ${BACKUP_DIR}`);
}

main().catch(e => { console.error('Backup FAILED:', e.message); process.exit(1); });
