// Renders the brand app icon (brand/logo/waitly-app-icon.svg) to PNG and ICO.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const svg = readFileSync('brand/logo/waitly-app-icon.svg', 'utf8').replace('width="512" height="512"', 'width="512" height="512" style="display:block"');
const html = `<html><body style="margin:0;background:transparent">${svg}</body></html>`;
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await p.setContent(html);
const png = await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
writeFileSync('public/icon-512.png', png);
await b.close();
console.log('wrote public/icon-512.png');
