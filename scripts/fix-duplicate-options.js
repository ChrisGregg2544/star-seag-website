/**
 * fix-duplicate-options.js
 * Auto-fixes questions where two answer options have the same value.
 * Strategy: the duplicate that is NOT the correct answer gets replaced with
 * a nearby unused numeric value. Non-numeric duplicates are skipped (logged).
 *
 * Usage:
 *   node scripts/fix-duplicate-options.js            ← apply fixes
 *   DRY_RUN=1 node scripts/fix-duplicate-options.js  ← preview only
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
const DRY_RUN      = process.env.DRY_RUN === '1';
const PAGE_SIZE    = 1000;
const DELAY        = 30; // ms between writes

if (!SERVICE_KEY) { console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env'); process.exit(1); }

const baseHeaders = {
  apikey:        SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function fetchPage(offset) {
  const url = `${SUPABASE_URL}/rest/v1/questions`
    + `?validated=eq.true`
    + `&options=not.is.null`
    + `&select=id,topic,year_group,question_text,options,correct_answer`
    + `&limit=${PAGE_SIZE}&offset=${offset}`;
  const res = await fetch(url, { headers: baseHeaders });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function patchOptions(id, options) {
  const url = `${SUPABASE_URL}/rest/v1/questions?id=eq.${id}`;
  const res = await fetch(url, {
    method:  'PATCH',
    headers: { ...baseHeaders, Prefer: 'return=minimal' },
    body:    JSON.stringify({ options }),
  });
  if (!res.ok) throw new Error(`PATCH failed for ${id} (${res.status}): ${await res.text()}`);
}

// Parse "3.25 kg" → { num: 3.25, unit: 'kg' } or "11 emails" → { num: 11, unit: 'emails' }
function parseNumUnit(val) {
  const m = String(val).trim().match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return null;
  return { num: Number(m[1]), unit: m[2].trim() };
}

// Find an unused replacement near correctVal, preserving units if present.
// Handles: pure int, pure decimal, "N unit" strings.
function generateReplacement(existingVals, correctVal) {
  const cs = String(correctVal).trim();

  // Pure integer
  if (/^-?\d+$/.test(cs)) {
    const base = parseInt(cs);
    const used = new Set(existingVals.map(v => parseInt(String(v).trim())));
    for (let d = 1; d <= 100; d++) {
      for (const c of [base + d, base - d]) {
        if (c >= 0 && !used.has(c)) return String(c);
      }
    }
    return null;
  }

  // Pure decimal
  if (/^-?\d+\.\d+$/.test(cs)) {
    const base  = parseFloat(cs);
    const dec   = (cs.split('.')[1] || '').length;
    const step  = Math.pow(10, -dec);
    const used  = new Set(existingVals.map(v => parseFloat(String(v).trim())));
    for (let d = 1; d <= 100; d++) {
      for (const c of [base + d * step, base - d * step]) {
        const r = Math.round(c * Math.pow(10, dec)) / Math.pow(10, dec);
        if (r >= 0 && !used.has(r)) return r.toFixed(dec);
      }
    }
    return null;
  }

  // "N unit" pattern — e.g. "11 emails", "3 plants", "0.225 kg"
  const parsed = parseNumUnit(cs);
  if (parsed && parsed.unit && !isNaN(parsed.num)) {
    const { num: base, unit } = parsed;
    const isInt = Number.isInteger(base);
    const dec   = isInt ? 0 : (cs.match(/\.(\d+)/) || ['', ''])[1].length;
    const used  = new Set(existingVals.map(v => {
      const p = parseNumUnit(String(v).trim());
      return p ? p.num : NaN;
    }).filter(n => !isNaN(n)));
    for (let d = 1; d <= 100; d++) {
      for (const c of [base + d, base - d]) {
        if (c >= 0 && !used.has(c)) {
          return isInt ? `${Math.round(c)} ${unit}` : `${c.toFixed(dec)} ${unit}`;
        }
      }
    }
  }

  return null; // non-fixable (day names, text phrases, etc.)
}

async function main() {
  console.log(`fix-duplicate-options  DRY_RUN=${DRY_RUN}\n`);

  let offset = 0;
  let totalScanned = 0;
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  const manualNeeded = [];

  while (true) {
    const rows = await fetchPage(offset);
    if (!rows.length) break;
    totalScanned += rows.length;

    for (const row of rows) {
      if (!row.options || typeof row.options !== 'object') continue;

      const entries = Object.entries(row.options);
      // Group keys by normalised value
      const valueMap = {};
      for (const [key, val] of entries) {
        const norm = String(val).trim().toLowerCase();
        if (!valueMap[norm]) valueMap[norm] = [];
        valueMap[norm].push(key);
      }

      // Find any group with 2+ keys
      const fixedOptions = { ...row.options };
      let needsUpdate = false;

      for (const [norm, keys] of Object.entries(valueMap)) {
        if (keys.length < 2) continue;

        // Which keys are NOT the correct answer?
        const keysToFix = keys.filter(k => k !== row.correct_answer);
        if (keysToFix.length === 0) {
          // Both (or all) are the correct answer key — impossible in practice
          continue;
        }

        const correctVal = String(row.options[row.correct_answer] || '').trim();
        const allCurrentVals = Object.values(fixedOptions).map(v => String(v).trim());

        for (const key of keysToFix) {
          const oldVal = fixedOptions[key];
          const replacement = generateReplacement(allCurrentVals, correctVal);
          if (!replacement) {
            manualNeeded.push({
              id: row.id, topic: row.topic, year_group: row.year_group,
              key, oldVal, correct_answer: row.correct_answer,
              question: row.question_text.slice(0, 60),
            });
            skipped++;
            continue;
          }

          console.log(`  ${DRY_RUN ? 'DRY' : 'FIX'} ${row.topic} ${row.year_group} | ${row.id}`);
          console.log(`        Q: ${row.question_text.slice(0, 60)}`);
          console.log(`        Options: ${JSON.stringify(row.options)}`);
          console.log(`        Change ${key}: "${oldVal}" → "${replacement}"`);
          console.log('');

          fixedOptions[key] = replacement;
          // Update allCurrentVals so next iteration sees the new value
          allCurrentVals[allCurrentVals.indexOf(String(oldVal).trim())] = replacement;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        if (!DRY_RUN) {
          try {
            await patchOptions(row.id, fixedOptions);
            fixed++;
            await new Promise(r => setTimeout(r, DELAY));
          } catch (e) {
            errors++;
            console.error(`  ERR ${row.id} — ${e.message}`);
          }
        } else {
          fixed++;
        }
      }
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log('── Summary ──────────────────────────────────────────');
  console.log(`  Scanned : ${totalScanned}`);
  console.log(`  Fixed   : ${fixed}${DRY_RUN ? ' (dry run — no writes)' : ''}`);
  console.log(`  Skipped : ${skipped} (non-numeric options — need manual fix)`);
  console.log(`  Errors  : ${errors}`);

  if (manualNeeded.length > 0) {
    console.log('\n── Needs manual fix ─────────────────────────────────');
    for (const m of manualNeeded) {
      console.log(`  ${m.topic} ${m.year_group} | ${m.id}`);
      console.log(`  Q: ${m.question}`);
      console.log(`  Key ${m.key}: "${m.oldVal}" (correct=${m.correct_answer})`);
      console.log('');
    }
  }

  if (DRY_RUN && fixed > 0) {
    console.log('\nRun without DRY_RUN=1 to apply fixes.');
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
