import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

// Fills the static <head> that link preview crawlers read. They do not run JavaScript, so the title, the
// description and the Open Graph and Twitter tags must be in index.html itself. Every value comes from
// config/app.json (`site`, `playground.defaultLanguage`) and web/locales/<language>.json (`meta`).

/** index.html holds these two markers and no page text of its own. */
export const LANG_MARKER = "__META_LANG__";
export const HEAD_MARKER = "<!-- meta-head -->";

export interface SiteConfig {
  url: string;
  ogImage: string;
  ogImageWidth: number;
  ogImageHeight: number;
  twitterCard: string;
  locales: Record<string, string>;
}

export interface MetaStrings {
  siteName: string;
  title: string;
  description: string;
  ogImageAlt: string;
}

export interface HeadInput {
  site: SiteConfig;
  lang: string;
  meta: MetaStrings;
  /** First hex digits of the image's sha256, so a changed card gets a new URL past every cache. */
  imageVersion: string;
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const IMAGE_TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

/** Checks the values a crawler cannot do without; a bad value stops the build instead of shipping a broken card. */
export function checkInput({ site, lang, meta }: HeadInput): void {
  let url: URL;
  try {
    url = new URL(site.url);
  } catch {
    throw new Error(`site.url is not a URL: ${JSON.stringify(site.url)}`);
  }
  if (url.protocol !== "https:") throw new Error(`site.url must use https: ${site.url}`);
  if (!site.ogImage?.startsWith("/")) throw new Error(`site.ogImage must be a path from the site root: ${JSON.stringify(site.ogImage)}`);
  if (!IMAGE_TYPES[path.extname(site.ogImage).toLowerCase()]) throw new Error(`site.ogImage must be a PNG or JPEG: ${site.ogImage}`);
  if (!(site.ogImageWidth > 0 && site.ogImageHeight > 0)) throw new Error("site.ogImageWidth and site.ogImageHeight must be positive");
  if (!site.twitterCard) throw new Error("site.twitterCard is empty");
  if (!site.locales?.[lang]) throw new Error(`site.locales has no entry for the default language ${JSON.stringify(lang)}`);
  for (const key of ["siteName", "title", "description", "ogImageAlt"] as const) {
    if (!meta[key]?.trim()) throw new Error(`meta.${key} is empty in the ${lang} locale`);
  }
}

/** The <head> tags for one language, as HTML. */
export function headTags(input: HeadInput): string {
  checkInput(input);
  const { site, lang, meta, imageVersion } = input;
  const pageUrl = new URL("/", site.url).href;
  const image = `${new URL(site.ogImage, site.url).href}?v=${imageVersion}`;
  const prop = (p: string, v: string | number) => `<meta property="${p}" content="${escapeAttr(String(v))}" />`;
  const name = (n: string, v: string) => `<meta name="${n}" content="${escapeAttr(v)}" />`;
  return [
    `<title>${escapeAttr(meta.title)}</title>`,
    name("description", meta.description),
    `<link rel="canonical" href="${escapeAttr(pageUrl)}" />`,
    prop("og:type", "website"),
    prop("og:site_name", meta.siteName),
    prop("og:url", pageUrl),
    prop("og:title", meta.title),
    prop("og:description", meta.description),
    prop("og:image", image),
    prop("og:image:type", IMAGE_TYPES[path.extname(site.ogImage).toLowerCase()]),
    prop("og:image:width", site.ogImageWidth),
    prop("og:image:height", site.ogImageHeight),
    prop("og:image:alt", meta.ogImageAlt),
    prop("og:locale", site.locales[lang]),
    ...Object.entries(site.locales)
      .filter(([l]) => l !== lang)
      .map(([, locale]) => prop("og:locale:alternate", locale)),
    name("twitter:card", site.twitterCard),
    name("twitter:title", meta.title),
    name("twitter:description", meta.description),
    name("twitter:image", image),
    name("twitter:image:alt", meta.ogImageAlt),
  ].join("\n    ");
}

/** Puts the language and the tags into index.html; fails when a marker is missing. */
export function fillHead(html: string, input: HeadInput): string {
  if (!html.includes(LANG_MARKER)) throw new Error(`index.html has no ${LANG_MARKER} marker`);
  if (!html.includes(HEAD_MARKER)) throw new Error(`index.html has no ${HEAD_MARKER} marker`);
  return html.replace(LANG_MARKER, escapeAttr(input.lang)).replace(HEAD_MARKER, () => headTags(input));
}

/** Reads config/app.json, the default locale and the card image from the repository. */
export function readHeadInput(repoRoot: string): HeadInput {
  const app = JSON.parse(readFileSync(path.join(repoRoot, "config", "app.json"), "utf8"));
  const lang: string = app.playground?.defaultLanguage;
  const strings = JSON.parse(readFileSync(path.join(repoRoot, "web", "locales", `${lang}.json`), "utf8"));
  const site: SiteConfig = app.site;
  if (!site) throw new Error("config/app.json has no site section");
  const image = readFileSync(path.join(repoRoot, "web", "public", site.ogImage ?? ""));
  return { site, lang, meta: strings.meta, imageVersion: createHash("sha256").update(image).digest("hex").slice(0, 8) };
}

/** Vite plugin: fills index.html in dev and in the build. */
export function metaHead(repoRoot: string): Plugin {
  return {
    name: "sisir-meta-head",
    transformIndexHtml: { order: "pre", handler: (html) => fillHead(html, readHeadInput(repoRoot)) },
  };
}
