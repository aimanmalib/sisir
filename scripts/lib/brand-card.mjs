// Shared pieces for the images drawn from the site's own brand: the link preview card and the cover image.
// Colours come from web/src/styles/tokens.css, fonts from web/node_modules, the mark from brand/logo.svg.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const read = (rel) => readFileSync(path.join(root, rel));
export const config = JSON.parse(read('config/app.json'));
export const strings = JSON.parse(read(`web/locales/${config.playground.defaultLanguage}.json`));

const tokensCss = read('web/src/styles/tokens.css').toString();

/** Reads one custom property from the site's colour tokens, so the image follows the page. */
export function token(name) {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`brand-card: --${name} missing from tokens.css`);
  return m[1].trim();
}

function fontFace(family, file, weight) {
  const data = read(path.join('web', 'node_modules', file)).toString('base64');
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${data}) format("woff2");font-weight:${weight};font-stretch:62% 125%;}`;
}

/** The two site fonts as embedded faces named "Card UI" and "Card Code". */
export const fontFaces = () =>
  fontFace('Card UI', '@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2', '100 900') +
  fontFace('Card Code', '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 400);

export const escape = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** The comb mark as inline SVG, without its title so it does not show as a tooltip. */
export const logoSvg = () => read('brand/logo.svg').toString().replace(/<title>.*?<\/title>/, '');

/** A PNG in the repository as a data URL, for screenshots placed inside an image. */
export const pngDataUrl = (rel) => `data:image/png;base64,${read(rel).toString('base64')}`;

/**
 * Draws `html` at width x height with Chromium from web/ and writes a PNG to `out` (absolute path).
 * Fails when the content overflows the frame or the file is over `maxBytes`.
 */
export async function renderPng({ html, width, height, out, maxBytes, label }) {
  const require = createRequire(path.join(root, 'web', 'package.json'));
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.body.scrollHeight > innerHeight || document.body.scrollWidth > innerWidth,
    );
    if (overflow) throw new Error(`${label}: the content does not fit ${width} x ${height}; shorten the text`);
    await page.screenshot({ path: out, type: 'png' });
  } finally {
    await browser.close();
  }
  const bytes = statSync(out).size;
  console.log(`wrote ${path.relative(root, out)} (${width} x ${height}, ${bytes} bytes)`);
  if (bytes > maxBytes) {
    console.error(`${label}: ${bytes} bytes is over the ${maxBytes} byte limit in config/app.json`);
    process.exit(1);
  }
}
