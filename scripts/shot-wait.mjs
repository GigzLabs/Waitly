// Usage: node scripts/shot-wait.mjs <path> <waitSelector> <out.png> [timeoutMs] [width] [height]
import { chromium } from 'playwright-core';
const [,, path, waitSel, out, timeout = '90000', w = '1440', h = '900'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => { try { localStorage.setItem('waitly-theme', 'dark'); localStorage.setItem('waitly-sound', 'off'); } catch {} });
const p = await ctx.newPage();
await p.goto((process.env.BASE || 'http://localhost:3000') + path, { waitUntil: 'networkidle' });
console.log('page open, waiting for', waitSel);
await p.waitForSelector(waitSel, { timeout: +timeout });
await p.waitForTimeout(400);
await p.screenshot({ path: out });
await b.close();
console.log('saved', out);
