import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Read specific pages from a PDF and print as plain text
const PDF_PATH = process.argv[2] || 'P7 Parent answers 1-10 greyscale (2026).pdf';
const START = parseInt(process.argv[3] || '3');
const END   = parseInt(process.argv[4] || '6');

async function main() {
  const doc = await pdfjsLib.getDocument({ url: PDF_PATH, useSystemFonts: true }).promise;
  console.log(`Total pages: ${doc.numPages}`);
  for (let i = START; i <= Math.min(END, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Group items by approximate y-position to reconstruct lines
    const items = content.items.filter(it => it.str.trim());
    const lines = {};
    for (const item of items) {
      const y = Math.round(item.transform[5] / 5) * 5;
      if (!lines[y]) lines[y] = [];
      lines[y].push({ x: item.transform[4], str: item.str });
    }
    const sortedYs = Object.keys(lines).map(Number).sort((a,b) => b - a);
    console.log(`\n=== PAGE ${i} ===`);
    for (const y of sortedYs) {
      const row = lines[y].sort((a,b) => a.x - b.x).map(i => i.str).join(' ');
      console.log(row);
    }
  }
}

main().catch(console.error);
