// Renders the cover image for the project page to the path in config/app.json `cover.file`, with Chromium from web/.
// Name, tagline and note come from web/locales/<default language>.json, colours from web/src/styles/tokens.css, the
// mark from brand/logo.svg and the product view from `cover.screenshot` (a real playground screenshot that
// scripts/readme-screenshots.mjs captures). Run it again when any of those change.
// Usage: node scripts/cover-image.mjs
import path from 'node:path';
import { config, escape, fontFaces, logoSvg, pngDataUrl, renderPng, root, strings, token } from './lib/brand-card.mjs';

const { cover, site } = config;
const W = cover.width;
const H = cover.height;
const { meta } = strings;

const html = `<!doctype html><html lang="${config.playground.defaultLanguage}"><head><meta charset="utf-8"><style>
${fontFaces()}
*{margin:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:${token('bench')};overflow:hidden}
body{position:relative;font-family:"Card UI",sans-serif;color:${token('on-bench')}}
.copy{position:absolute;left:96px;top:96px;bottom:96px;width:660px;display:flex;flex-direction:column;justify-content:space-between}
.brand{display:flex;align-items:center;gap:28px}
.brand svg{width:120px;height:120px;display:block}
.name{font-size:96px;font-weight:700;font-stretch:112%;color:${token('manila')};letter-spacing:.01em;line-height:1}
h1{font-size:60px;line-height:1.12;font-weight:700;font-stretch:100%}
p{margin-top:32px;font-size:30px;line-height:1.4;color:${token('on-bench-soft')}}
.rule{height:6px;width:160px;background:${token('manila')};border-radius:3px;margin-bottom:28px}
.foot{display:flex;flex-direction:column;gap:12px;font-family:"Card Code",monospace;font-size:26px}
.host{color:${token('manila')}}
.badge{color:${token('on-bench-soft')}}
.shot{position:absolute;left:840px;top:96px;right:0;bottom:0;overflow:hidden;border-radius:18px 0 0 0;
  border:2px solid ${token('bench-line')};border-right:0;border-bottom:0;background:${token('bench-raised')}}
.shot img{display:block;width:1180px;height:auto}
</style></head><body>
<div class="copy">
  <div class="brand">${logoSvg()}<span class="name">${escape(meta.siteName)}</span></div>
  <div><div class="rule"></div><h1>${escape(meta.tagline)}</h1><p>${escape(meta.coverNote)}</p></div>
  <div class="foot"><span class="host">${escape(new URL(site.url).host)}</span><span class="badge">${escape(meta.coverBadge)}</span></div>
</div>
<div class="shot"><img src="${pngDataUrl(cover.screenshot)}" alt=""></div>
</body></html>`;

await renderPng({ html, width: W, height: H, out: path.join(root, cover.file), maxBytes: cover.maxBytes, label: 'cover-image' });
