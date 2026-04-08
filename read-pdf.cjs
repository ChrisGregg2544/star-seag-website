const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function main() {
  const buf = fs.readFileSync('P7 Parent answers 1-10 greyscale (2026).pdf');
  const parser = new PDFParse();
  const data = await parser.parse(buf);
  console.log('Pages:', data.pages.length);
  // Print first several pages of text
  let out = '';
  for (const page of data.pages.slice(0, 15)) {
    out += `\n=== PAGE ${page.pageIndex + 1} ===\n`;
    for (const line of page.lines) {
      out += line.text + '\n';
    }
  }
  console.log(out);
}
main().catch(console.error);
