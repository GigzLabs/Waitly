// Usage: node scripts/shot-click.mjs <path> <clickSelector> <out.png> [width] [height] [theme]
import { chromium } from 'playwright-core';
const [,, path, clickSel, out, w = '1440', h = '900', theme = 'dark'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: +w < 500, hasTouch: +w < 500 });
await ctx.addInitScript((t) => { try { localStorage.setItem('waitly-theme', t); localStorage.setItem('waitly-sound', 'off'); localStorage.setItem('waitly-pin', '1234'); } catch {} }, theme);
const p = await ctx.newPage();
await p.goto((process.env.BASE || 'http://localhost:3000') + path, { waitUntil: 'networkidle' });
await p.waitForSelector(clickSel, { timeout: 20000 });
await p.click(clickSel);
await p.waitForTimeout(900);
await p.screenshot({ path: out });
await b.close();
console.log('saved', out);
