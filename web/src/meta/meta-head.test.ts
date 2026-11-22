import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HEAD_MARKER, LANG_MARKER, fillHead, headTags, readHeadInput, type HeadInput } from '../../meta-head.js';

const webDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = path.join(webDir, '..');

// A frozen input, so these tests do not follow the site's own wording.
const input: HeadInput = {
  site: {
    url: 'https://example.test',
    ogImage: '/card.png',
    ogImageWidth: 1200,
    ogImageHeight: 630,
    twitterCard: 'summary_large_image',
    locales: { en: 'en_US', ms: 'ms_MY' },
  },
  lang: 'en',
  meta: { siteName: 'Name', title: 'Name: a "quoted" <title>', description: 'One & two.', ogImageAlt: 'Alt text' },
  imageVersion: '0123abcd',
};

const content = (html: string, attr: string, key: string) =>
  [...html.matchAll(new RegExp(`<meta ${attr}="${key}" content="([^"]*)" />`, 'g'))].map((m) => m[1]);

describe('page head', () => {
  it('has every tag a link preview reads', () => {
    const html = headTags(input);
    const og = {
      'og:type': 'website',
      'og:site_name': 'Name',
      'og:url': 'https://example.test/',
      'og:title': 'Name: a &quot;quoted&quot; &lt;title&gt;',
      'og:description': 'One &amp; two.',
      'og:image': 'https://example.test/card.png?v=0123abcd',
      'og:image:type': 'image/png',
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:image:alt': 'Alt text',
      'og:locale': 'en_US',
      'og:locale:alternate': 'ms_MY',
    };
    for (const [key, value] of Object.entries(og)) expect(content(html, 'property', key), key).toEqual([value]);
    const twitter = {
      'twitter:card': 'summary_large_image',
      'twitter:title': og['og:title'],
      'twitter:description': og['og:description'],
      'twitter:image': og['og:image'],
      'twitter:image:alt': 'Alt text',
      description: og['og:description'],
    };
    for (const [key, value] of Object.entries(twitter)) expect(content(html, 'name', key), key).toEqual([value]);
    expect(html).toContain('<title>Name: a &quot;quoted&quot; &lt;title&gt;</title>');
  });

  it('stops the build on a value a crawler cannot use', () => {
    const bad = (site: Partial<HeadInput['site']>, meta: Partial<HeadInput['meta']> = {}) => () =>
      headTags({ ...input, site: { ...input.site, ...site }, meta: { ...input.meta, ...meta } });
    expect(bad({ url: 'http://example.test' })).toThrow(/https/);
    expect(bad({ url: 'not a url' })).toThrow(/not a URL/);
    expect(bad({ ogImage: '' })).toThrow(/ogImage/);
    expect(bad({ ogImage: '/card.gif' })).toThrow(/PNG or JPEG/);
    expect(bad({ ogImageWidth: 0 })).toThrow(/positive/);
    expect(bad({ twitterCard: '' })).toThrow(/twitterCard/);
    expect(bad({ locales: { ms: 'ms_MY' } })).toThrow(/default language/);
    expect(bad({}, { description: ' ' })).toThrow(/meta.description/);
  });

  it('fills both markers in index.html and refuses a page without them', () => {
    const page = readFileSync(path.join(webDir, 'index.html'), 'utf8');
    const filled = fillHead(page, input);
    expect(filled).toContain('<html lang="en">');
    expect(filled).not.toContain(LANG_MARKER);
    expect(filled).not.toContain(HEAD_MARKER);
    expect(page).not.toMatch(/<title>|name="description"/);
    expect(() => fillHead(page.replace(HEAD_MARKER, ''), input)).toThrow(/marker/);
    expect(() => fillHead(page.replace(LANG_MARKER, 'en'), input)).toThrow(/marker/);
  });

  it('reads the site config, the default locale and a version from the card itself', () => {
    const { site, lang, meta, imageVersion } = readHeadInput(repoRoot);
    const card = readFileSync(path.join(webDir, 'public', site.ogImage));
    expect(imageVersion).toBe(createHash('sha256').update(card).digest('hex').slice(0, 8));
    expect(site.locales[lang]).toBeTruthy();
    expect(() => headTags({ site, lang, meta, imageVersion })).not.toThrow();
  });
});
