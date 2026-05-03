import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir  = dirname(fileURLToPath(import.meta.url));
const script = resolve(__dir, 'extract-vocabulary-options.js');

const papers = [
  ...Array.from({ length: 10 }, (_, i) => ({
    paper: `Warm Up ${i + 1} (2026).pdf`,
    group: 'P6',
    num:   i + 1,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    paper: `Test ${i + 1} (2026).pdf`,
    group: 'P7',
    num:   i + 1,
  })),
];

let totalSaved = 0;
let failed     = 0;
const failures = [];

for (let i = 0; i < papers.length; i++) {
  const { paper, group, num } = papers[i];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[${i + 1}/${papers.length}] ${group} — ${paper}`);
  console.log('═'.repeat(60));

  try {
    const out = execSync(`node "${script}" "${paper}" ${group} ${num}`, {
      encoding: 'utf8',
    });
    process.stdout.write(out);

    const sm = out.match(/Saved:\s+(\d+)/);
    if (sm) totalSaved += parseInt(sm[1], 10);
  } catch (err) {
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    console.error(`\n✗ FAILED: ${group} — ${paper}`);
    failed++;
    failures.push(`${group} — ${paper}`);
  }

  if (i < papers.length - 1) {
    process.stdout.write('\nWaiting 2s before next paper...\n');
    await new Promise(r => setTimeout(r, 2000));
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log('DONE');
console.log(`  Papers processed:    ${papers.length - failed} / ${papers.length}`);
console.log(`  Options extracted:   ${totalSaved}`);
if (failures.length) {
  console.log(`  Failed (${failures.length}):`);
  failures.forEach(f => console.log(`    ✗ ${f}`));
}
console.log('═'.repeat(60));
