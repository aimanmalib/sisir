import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const config = JSON.parse(readFileSync(path.join(root, 'config/app.json'), 'utf8')) as {
  cover: { file: string; width: number; height: number; maxBytes: number; screenshot: string };
};

/** Width and height from the IHDR chunk, which every PNG starts with. */
function pngSize(bytes: Buffer): { width: number; height: number } {
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('cover image', () => {
  const { cover } = config;
  const bytes = readFileSync(path.join(root, cover.file));

  it('is a PNG of the size in config/app.json', () => {
    expect(pngSize(bytes)).toEqual({ width: cover.width, height: cover.height });
  });

  it('stays under the byte limit in config/app.json', () => {
    expect(bytes.length).toBeLessThanOrEqual(cover.maxBytes);
  });

  it('is drawn from a screenshot that is in the repository', () => {
    expect(pngSize(readFileSync(path.join(root, cover.screenshot))).width).toBeGreaterThan(0);
  });
});
