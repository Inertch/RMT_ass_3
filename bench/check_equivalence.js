/* Functional check (Objective 1): the three strategies must show identical content for each page type.
 * Usage: node bench/check_equivalence.js [--base http://127.0.0.1:3000]
 */
const { chromium } = require('playwright');
const crypto = require('crypto');
const { PAGES } = require('../lib/pages');
const { expectedRows } = require('../lib/data');
const i = process.argv.indexOf('--base');
const BASE = i > -1 ? process.argv[i + 1] : 'http://127.0.0.1:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  let failed = false;
  console.log('page       | strategy | rows(found/expected) | sha256(main text)');
  for (const p of PAGES) {
    const hashes = new Set();
    for (const s of ['csr', 'ssr', 'ssg']) {
      const page = await browser.newPage();
      await page.goto(`${BASE}/${s}/${p}`, { waitUntil: 'load' });
      await page.waitForFunction((n) => document.querySelectorAll('[data-testid="row"]').length >= n, expectedRows(p), { timeout: 30000 }).catch(() => {});
      const rows = await page.locator('[data-testid="row"]').count();
      const text = await page.locator('main').innerText();
      const h = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
      hashes.add(h);
      if (rows !== expectedRows(p)) failed = true;
      console.log(`${p.padEnd(10)} | ${s.padEnd(8)} | ${rows}/${expectedRows(p)}`.padEnd(46) + `| ${h}`);
      await page.close();
    }
    if (hashes.size !== 1) { failed = true; console.log(`  -> MISMATCH: strategies render different content for ${p}`); }
  }
  await browser.close();
  console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS (identical content for all strategies)');
  process.exit(failed ? 1 : 0);
})();
