# 0011. The page head is filled at build time from config and the default locale

- Status: accepted
- Date: 2026-11-22

## Context

Link preview crawlers read the HTML a server sends and run no JavaScript. The playground sets its title and
description in the browser (`web/src/i18n/i18n.tsx`), but `web/index.html` also carried a copy of both, so the two
could drift, and it had no Open Graph or Twitter tags at all. A shared link showed no card.

## Decision

- `web/index.html` holds two markers and no page text: `__META_LANG__` in `<html lang>` and `<!-- meta-head -->` in
  the head.
- `web/meta-head.ts` is a Vite plugin (`transformIndexHtml`, about 120 lines) that replaces them in dev and in
  the build. It reads `config/app.json` (`site`, `playground.defaultLanguage`) and `meta` from
  `web/locales/<language>.json`, and writes the title, description, canonical link, Open Graph tags (with the
  locale and its alternates) and Twitter tags.
- The image URL is absolute and ends in `?v=` plus the first 8 hex digits of the card's sha256. Crawlers and the CDN
  keep an image by URL for days; a new card gets a new URL.
- A URL that is not https, a missing image path, an image that is not PNG or JPEG, or an empty text stops the build.
- nginx serves `/og.png` itself with a one day cache and a 404 when the file is missing, so a crawler never gets
  the HTML page in place of the image.
- The static head is in the default language only. The page still switches the visible title when the reader picks
  another language.
- A plugin package such as `vite-plugin-html` was not added: the hook is a few lines and the package would bring a
  template engine for one replacement.

## How to undo

Revert the commit. `web/index.html` gets its fixed title and description back and the share card tags go away.
