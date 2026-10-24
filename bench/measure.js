/* Controlled benchmark runner.
 * Usage: node bench/measure.js --runs 30 --warmup 3 --out results/main [--base http://127.0.0.1:3000]
 * Requires: production server running (npm run build && npm start) and `npx playwright install chromium`.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { PAGES } = require('../lib/pages');
const { expectedRows, LATENCY_MS, SCALE } = require('../lib/data');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const BASE = arg('base', 'http://127.0.0.1:3000');
const RUNS = parseInt(arg('runs', '30'), 10);
const WARMUP = parseInt(arg('warmup', '3'), 10);
const OUT = arg('out', 'results/main');
const SEED = parseInt(arg('seed', '20261019'), 10);
const STRATEGIES = ['csr', 'ssr', 'ssg'];
const NETWORKS = {
  P1_fast: { downMbps: 10, upMbps: 5, latencyMs: 40 },
  P2_moderate: { downMbps: 2.5, upMbps: 1, latencyMs: 300 },   // same profile as Hanafi et al. (2024)
  P3_slow: { downMbps: 0.5, upMbps: 0.25, latencyMs: 400 },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
function tryExec(cmd) { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return 'n/a'; } }
const r1 = (x) => (x === null || x === undefined ? '' : Math.round(x * 10) / 10);

async function measureOnce(browser, url, net, expected) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (net) {
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: net.latencyMs,
        downloadThroughput: (net.downMbps * 1e6) / 8, uploadThroughput: (net.upMbps * 1e6) / 8,
      });
    }
    await page.goto(url, { waitUntil: 'load', timeout: 180000 });
    // CSR renders its rows only after the data fetch, so wait for the full content explicitly.
    await page.waitForFunction((n) => document.querySelectorAll('[data-testid="row"]').length >= n, expected, { timeout: 180000 });
    await page.waitForLoadState('networkidle', { timeout: 180000 });
    return await page.evaluate(() => new Promise((resolve) => {
      let lcp = null;
      try {
        new PerformanceObserver((list) => { const e = list.getEntries(); if (e.length) lcp = e[e.length - 1].startTime; })
          .observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) { /* LCP unsupported */ }
      setTimeout(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const res = performance.getEntriesByType('resource');
        const fcpE = performance.getEntriesByName('first-contentful-paint')[0];
        const ends = [nav.responseEnd, ...res.map((r) => r.responseEnd)];
        resolve({
          ttfb: nav.responseStart, fcp: fcpE ? fcpE.startTime : null, lcp,
          dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd, finish: Math.max(...ends),
          requests: 1 + res.length,
          bytes: (nav.transferSize || 0) + res.reduce((s, r) => s + (r.transferSize || 0), 0),
          rows: document.querySelectorAll('[data-testid="row"]').length,
        });
      }, 100);
    }));
  } finally { await context.close(); }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const commit = tryExec('git rev-parse --short HEAD');
  const logPath = path.join(OUT, 'run_log.txt');
  const log = (m) => { const line = `[${new Date().toISOString()}] ${m}`; console.log(line); fs.appendFileSync(logPath, line + '\n'); };
  log(`CONFIG runs=${RUNS} warmup=${WARMUP} seed=${SEED} base=${BASE} dataLatencyMs=${LATENCY_MS} dataScale=${SCALE}`);
  log(`ENV node=${process.version} chromium=${browser.version()} os=${os.type()} ${os.release()} cpu="${os.cpus()[0].model}" cores=${os.cpus().length} ramGB=${Math.round(os.totalmem() / 1e9)} commit=${commit}`);
  log('NETWORKS ' + JSON.stringify(NETWORKS));

  // Warm-up (unthrottled, results discarded) so the server and JIT are not cold during measurement.
  for (const s of STRATEGIES) for (const p of PAGES) for (let i = 0; i < WARMUP; i++) {
    try { await measureOnce(browser, `${BASE}/${s}/${p}`, null, expectedRows(p)); } catch (e) { log(`WARMUP error ${s}/${p}: ${e.message.split('\n')[0]}`); }
  }
  log('Warm-up finished');

  const plan = [];
  for (const s of STRATEGIES) for (const p of PAGES) for (const n of Object.keys(NETWORKS)) for (let run = 1; run <= RUNS; run++) plan.push({ s, p, n, run });
  shuffle(plan, mulberry32(SEED));   // randomised order spreads time drift across all conditions

  const csvPath = path.join(OUT, 'raw_results.csv');
  const header = 'order,timestamp,commit,strategy,page,network,run,attempts,status,rows_expected,rows_found,ttfb,fcp,lcp,dcl,load,finish,requests,bytes\n';
  if (!fs.existsSync(csvPath)) fs.writeFileSync(csvPath, header);

  for (let idx = 0; idx < plan.length; idx++) {
    const { s, p, n, run } = plan[idx];
    const expected = expectedRows(p);
    let m = null, status = 'error', attempts = 0, lastErr = '';
    while (attempts < 2) {   // one retry for transient failures; failures are logged, never silently dropped
      attempts++;
      try {
        m = await measureOnce(browser, `${BASE}/${s}/${p}`, NETWORKS[n], expected);
        status = m.rows === expected ? 'ok' : 'rows_mismatch';
        if (status === 'ok') break;
      } catch (e) { lastErr = e.message.split('\n')[0].replace(/,/g, ';'); status = 'error'; }
    }
    if (status !== 'ok') log(`PROBLEM order=${idx + 1} ${s}/${p}/${n} run=${run} status=${status} ${lastErr}`);
    const row = [idx + 1, new Date().toISOString(), commit, s, p, n, run, attempts, status, expected,
      m ? m.rows : '', ...(m ? [m.ttfb, m.fcp, m.lcp, m.dcl, m.load, m.finish].map(r1) : ['', '', '', '', '', '']),
      m ? m.requests : '', m ? m.bytes : ''];
    fs.appendFileSync(csvPath, row.join(',') + '\n');
    if ((idx + 1) % 25 === 0) log(`Progress ${idx + 1}/${plan.length}`);
  }
  log('DONE');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
