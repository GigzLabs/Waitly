// Usage: node scripts/shot-app.mjs <path> <out.png> [width] [height] [theme] [waitSelector] [fullPage]
import { chromium } from 'playwright-core';
const [,, path, out, w = '1440', h = '900', theme = 'dark', waitSel = '', full = 'false'] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2, isMobile: +w < 500, hasTouch: +w < 500 });
await ctx.addInitScript((t) => { try { localStorage.setItem('waitly-theme', t); localStorage.setItem('waitly-sound', 'off'); localStorage.setItem('waitly-pin', '1234'); } catch {} }, theme);
const p = await ctx.newPage();
const base = process.env.BASE || 'http://localhost:3000';
await p.goto(base + path, { waitUntil: 'networkidle' });
if (waitSel) await p.waitForSelector(waitSel, { timeout: 20000 });
if (process.env.CLICK) { await p.click(process.env.CLICK); await p.waitForTimeout(800); }
await p.waitForTimeout(1200);
await p.screenshot({ path: out, fullPage: full === 'true' });
await b.close();
console.log('saved', out);
