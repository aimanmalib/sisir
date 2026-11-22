// Renders the link preview card to web/public/og.png with Chromium from web/.
// Text comes from web/locales/<default language>.json, colours from web/src/styles/tokens.css, the mark from
// brand/logo.svg and size limits from config/app.json `site`. Run it again when any of those change.
// Usage: node scripts/og-image.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'web', 'package.json'));
const { chromium } = require('@playwright/test');

const read = (rel) => readFileSync(path.join(root, rel));
const config = JSON.parse(read('config/app.json'));
const { site } = config;
const strings = JSON.parse(read(`web/locales/${config.playground.defaultLanguage}.json`));
const out = path.join(root, 'web', 'public', path.basename(site.ogImage));

/** Reads one custom property from the site's colour tokens, so the card follows the page. */
const tokensCss = read('web/src/styles/tokens.css').toString();
function token(name) {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`og-image: --${name} missing from tokens.css`);
  return m[1].trim();
}

function fontFace(family, file, weight) {
  const data = read(path.join('web', 'node_modules', file)).toString('base64');
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${data}) format("woff2");font-weight:${weight};font-stretch:62% 125%;}`;
}

const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const host = new URL(site.url).host;
const W = site.ogImageWidth;
const H = site.ogImageHeight;

const html = `<!doctype html><html lang="${config.playground.defaultLanguage}"><head><meta charset="utf-8"><style>
${fontFace('Card UI', '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2', '100 900')}
${fontFace('Card Code', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 400)}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:${token('bench')};overflow:hidden}
body{display:flex;flex-direction:column;justify-content:space-between;padding:72px 80px;
  font-family:"Card UI",sans-serif;color:${token('on-bench')}}
.brand{display:flex;align-items:center;gap:24px}
.brand svg{width:96px;height:96px;display:block}
.name{font-size:56px;font-weight:700;font-stretch:112%;color:${token('manila')};letter-spacing:.01em}
h1{font-size:64px;line-height:1.1;font-weight:700;font-stretch:100%;max-width:1040px}
p{margin-top:24px;font-size:32px;line-height:1.35;color:${token('on-bench-soft')};max-width:1000px}
.host{font-family:"Card Code",monospace;font-size:26px;color:${token('manila')}}
.rule{height:6px;width:160px;background:${token('manila')};border-radius:3px}
.foot{display:flex;align-items:center;justify-content:space-between}
</style></head><body>
<div class="brand">${read('brand/logo.svg').toString().replace(/<title>.*?<\/title>/, '')}<span class="name">Sisir</span></div>
<div><h1>${escape(strings.meta.title)}</h1><p>${escape(strings.meta.description)}</p></div>
<div class="foot"><span class="host">${escape(host)}</span><span class="rule"></span></div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.body.scrollHeight > innerHeight || document.body.scrollWidth > innerWidth);
  if (overflow) throw new Error('og-image: the text does not fit the card; shorten meta.title or meta.description');
  await page.screenshot({ path: out, type: 'png' });
} finally {
  await browser.close();
}

const bytes = statSync(out).size;
console.log(`wrote ${path.relative(root, out)} (${W} x ${H}, ${bytes} bytes)`);
if (bytes > site.ogImageMaxBytes) {
  console.error(`og-image: ${bytes} bytes is over the ${site.ogImageMaxBytes} byte limit in config/app.json`);
  process.exit(1);
}
