// Captures the README screenshots of the playground: Chromium at 1440 x 1240 and WebKit with the iPhone 13 profile.
// Usage: node scripts/readme-screenshots.mjs [url]   (Playwright and its browsers come from web/)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'web', 'package.json'));
const { chromium, webkit, devices } = require('@playwright/test');

const url = process.argv[2] ?? 'https://sisir.sasateguh.com/?lang=en';
const out = path.join(root, 'docs', 'images');

async function shoot(browserType, contextOptions, file) {
  const browser = await browserType.launch();
  try {
    const page = await (await browser.newContext(contextOptions)).newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, file) });
    console.log(`wrote docs/images/${file}`);
  } finally {
    await browser.close();
  }
}

await shoot(chromium, { viewport: { width: 1440, height: 1240 }, reducedMotion: 'reduce' }, 'screenshot-desktop.png');
await shoot(webkit, { ...devices['iPhone 13'], reducedMotion: 'reduce' }, 'screenshot-mobile.png');
