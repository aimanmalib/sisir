// Renders the link preview card to web/public/og.png with Chromium from web/.
// Text comes from web/locales/<default language>.json, colours from web/src/styles/tokens.css, the mark from
// brand/logo.svg and size limits from config/app.json `site`. Run it again when any of those change.
// Usage: node scripts/og-image.mjs
import path from 'node:path';
import { config, escape, fontFaces, logoSvg, renderPng, root, strings, token } from './lib/brand-card.mjs';

const { site } = config;
const W = site.ogImageWidth;
const H = site.ogImageHeight;

const html = `<!doctype html><html lang="${config.playground.defaultLanguage}"><head><meta charset="utf-8"><style>
${fontFaces()}
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
<div class="brand">${logoSvg()}<span class="name">Sisir</span></div>
<div><h1>${escape(strings.meta.title)}</h1><p>${escape(strings.meta.description)}</p></div>
<div class="foot"><span class="host">${escape(new URL(site.url).host)}</span><span class="rule"></span></div>
</body></html>`;

await renderPng({
  html,
  width: W,
  height: H,
  out: path.join(root, 'web', 'public', path.basename(site.ogImage)),
  maxBytes: site.ogImageMaxBytes,
  label: 'og-image',
});
