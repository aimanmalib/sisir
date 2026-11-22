import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { config } from '../config.js';
import en from '../../locales/en.json';
import ms from '../../locales/ms.json';

const PNG_SIGNATURE = '89504e470d0a1a0a';

/** Width and height from the IHDR chunk, which every PNG starts with. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('share card', () => {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', config.site.ogImage);
  const bytes = readFileSync(file);

  it('is a PNG of the size the page head announces', () => {
    expect(pngSize(bytes)).toEqual({ width: config.site.ogImageWidth, height: config.site.ogImageHeight });
  });

  it('stays under the byte limit that link previews accept', () => {
    expect(bytes.length).toBeLessThanOrEqual(config.site.ogImageMaxBytes);
  });

  it('has alt text in every language', () => {
    for (const strings of [en, ms]) expect(strings.meta.ogImageAlt.trim().length).toBeGreaterThan(0);
  });
});
