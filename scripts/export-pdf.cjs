#!/usr/bin/env node
// Export an HTML file to PDF using Puppeteer (if available).
// Usage:
//   node scripts/export-pdf.cjs --in docs/ui-review.html --out docs/ui-review.pdf [--chrome "C:\\Path\\to\\chrome.exe"] [--wait 300]

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag, dflt) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
  return {
    input: get('--in', 'docs/ui-review.html'),
    output: get('--out', 'docs/ui-review.pdf'),
    chromePath: get('--chrome', process.env.PUPPETEER_EXECUTABLE_PATH || ''),
    waitMs: parseInt(get('--wait', '200'), 10) || 200,
  };
}

async function main() {
  const { input, output, chromePath, waitMs } = parseArgs();
  const inPath = path.resolve(process.cwd(), input);
  const outPath = path.resolve(process.cwd(), output);

  if (!fs.existsSync(inPath)) {
    console.error('Input HTML not found:', inPath);
    process.exit(1);
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    try {
      puppeteer = require('puppeteer-core');
    } catch {
      console.error('\nMissing dependency: puppeteer or puppeteer-core');
      console.error('Install one of:');
      console.error('  npm i -D puppeteer');
      console.error('  # or');
      console.error('  npm i -D puppeteer-core');
      console.error('\nIf using puppeteer-core, provide Chrome path:');
      console.error('  node scripts/export-pdf.cjs --in docs/ui-review.html --out docs/ui-review.pdf --chrome "C\\\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe"');
      process.exit(2);
    }
  }

  const launchOpts = { headless: 'new' };
  if (chromePath) launchOpts.executablePath = chromePath;

  const browser = await puppeteer.launch(launchOpts);
  try {
    const page = await browser.newPage();
    const fileUrl = pathToFileURL(inPath).href;
    await page.goto(fileUrl, { waitUntil: 'load' });
    if (waitMs > 0) await page.waitForTimeout(waitMs);
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });
    console.log('PDF written:', outPath);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

