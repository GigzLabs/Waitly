// Captures the screens referenced by the README into docs/screenshots/.
// Requires a running app (default http://localhost:3000) with demo data.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = 'docs/screenshots';
mkdirSync(OUT, { recursive: true });

const shots = [
  { name: 'floor', path: '/app/floor', theme: 'dark', wait: 'button[aria-label^="M2,"]' },
  { name: 'alerts', path: '/app/alerts', theme: 'dark', wait: 'text=Alerts' },
  { name: 'waitlist', path: '/app/waitlist', theme: 'dark', wait: 'text=Waitlist' },
  { name: 'insights', path: '/app/insights', theme: 'dark', wait: 'text=Insights', full: true },
  { name: 'settings', path: '/app/settings', theme: 'dark', wait: 'text=Settings', pin: '1234' },
  { name: 'landing', path: '/', theme: 'light', wait: 'text=Every table', full: true },
  { name: 'join', path: '/join', theme: 'dark', width: 390, height: 844 },
  { name: 'floor-phone', path: '/app/floor', theme: 'dark', width: 390, height: 844, wait: 'button[aria-label^="M2,"]' },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
for (const s of shots) {
  const width = s.width ?? 1440;
  const height = s.height ?? 900;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1.5, isMobile: width < 500, hasTouch: width < 500 });
  await ctx.addInitScript(({ theme, pin }) => {
    try {
      localStorage.setItem('waitly-theme', theme);
      localStorage.setItem('waitly-sound', 'off');
      if (pin) localStorage.setItem('waitly-pin', pin);
    } catch {}
  }, { theme: s.theme, pin: s.pin });
  const page = await ctx.newPage();
  await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
  if (s.wait) await page.waitForSelector(s.wait, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: Boolean(s.full) });
  await ctx.close();
  console.log('saved', `${OUT}/${s.name}.png`);
}
await browser.close();
