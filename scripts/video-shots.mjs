// Captures the real states the demo video is cut from: the playground on the live site, the anchors read from the
// testnet, the Sisir job in another project's CI, and the CLI output on the two workshop vault files.
// Usage: npm run build && node scripts/video-shots.mjs <out-dir> [site-url] [ci-job-url]
// Screens are 1280 x 720 at device scale 3 (3840 x 2160), so the film can zoom in up to 3x and stay sharp.
// Playwright and its browsers come from web/.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'web', 'package.json'));
const { chromium } = require('@playwright/test');

const [outArg, siteArg, ciArg] = process.argv.slice(2);
if (!outArg) {
  console.error('usage: node scripts/video-shots.mjs <out-dir> [site-url] [ci-job-url]');
  process.exit(2);
}
const out = path.resolve(outArg);
const site = siteArg ?? 'https://sisir.sasateguh.com/?lang=en';
mkdirSync(out, { recursive: true });

// The CLI on each workshop file, run from the fixtures folder so paths stay short. Exit code is kept with the text.
function cli(file) {
  const cwd = path.join(root, 'fixtures', 'workshop');
  try {
    return { code: 0, text: execFileSync(process.execPath, [path.join(root, 'dist', 'cli.js'), file], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } }) };
  } catch (e) {
    return { code: e.status, text: e.stdout };
  }
}
const terminal = { draft: cli('QDayVault_v0_buggy.sol'), fixed: cli('QDayVault_v1_fixed.sol') };
writeFileSync(path.join(out, 'terminal.json'), JSON.stringify(terminal, null, 1) + '\n');
console.log(`wrote terminal.json (draft exit ${terminal.draft.code}, fixed exit ${terminal.fixed.code})`);

const browser = await chromium.launch();
const errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 3, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = async (name) => {
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    console.log(`wrote ${name}.png`);
  };

  await page.goto(site, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await shot('01-draft');
  await page.locator('.line__tags').first().scrollIntoViewIfNeeded();
  await shot('02-draft-findings');

  await page.locator('.toolbar select').selectOption({ index: 1 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('03-fixed');

  await page.locator('.ledger').scrollIntoViewIfNeeded();
  await page.locator('.recent').waitFor();
  await page.waitForTimeout(2500); // the recent anchors are read from the testnet RPC
  await shot('04-ledger');
  await page.locator('.recent').scrollIntoViewIfNeeded();
  await shot('05-recent');

  if (ciArg) {
    const gh = await context.newPage();
    await gh.goto(ciArg, { waitUntil: 'networkidle' });
    await gh.waitForTimeout(1500);
    await gh.screenshot({ path: path.join(out, '06-ci.png') });
    console.log('wrote 06-ci.png');
  }
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(`console errors on the site:\n${errors.join('\n')}`);
  process.exit(1);
}
