import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir   = dirname(fileURLToPath(import.meta.url));
const script  = resolve(__dir, 'extract-papers.js');

const WARM_UP_ANSWERS = 'Warm Ups 1-10 parent-teacher answer sheets.pdf';
const TEST_ANSWERS    = 'P7 Parent answers tests 1 - 10.pdf';

const papers = [
  ...Array.from({ length: 10 }, (_, i) => ({
    paper:   `Warm Up ${i + 1} (2026).pdf`,
    answers: WARM_UP_ANSWERS,
    group:   'P6',
    num:     i + 1,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    paper:   `Test ${i + 1} (2026).pdf`,
    answers: TEST_ANSWERS,
    group:   'P7',
    num:     i + 1,
  })),
];

let saved = 0;
let failed = 0;
const failures = [];

for (let i = 0; i < papers.length; i++) {
  const { paper, answers, group, num } = papers[i];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[${i + 1}/${papers.length}] ${group} — ${paper}`);
  console.log('═'.repeat(60));

  try {
    execSync(`node "${script}" "${paper}" "${answers}" ${group} ${num}`, {
      stdio: 'inherit',
    });
    saved++;
  } catch {
    console.error(`✗ FAILED: ${paper}`);
    failed++;
    failures.push(`${group} ${paper}`);
  }

  if (i < papers.length - 1) {
    process.stdout.write('\nWaiting 2s before next paper...\n');
    await new Promise(r => setTimeout(r, 2000));
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`DONE`);
console.log(`  Papers saved:  ${saved} / ${papers.length}`);
console.log(`  Questions:     ~${saved * 56}`);
if (failures.length) {
  console.log(`  Failed (${failures.length}):`);
  failures.forEach(f => console.log(`    ✗ ${f}`));
}
console.log('═'.repeat(60));
