import { chromium } from 'playwright-core';
const [,, url, out, w, h] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w || 1000, height: +h || 500 }, deviceScaleFactor: 2 });
await p.goto(url, { waitUntil: 'networkidle' });
await p.screenshot({ path: out, fullPage: true });
await b.close();
console.log('saved', out);
