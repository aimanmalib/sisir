import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reportDigest } from '../../../src/report/hash.js';
import { catalog, lintSource, rules } from '../../../src/rules/index.js';
import { digestPath } from '../src/report.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const draft = 'QDayVault_v0_buggy.sol';
const fixed = 'QDayVault_v1_fixed.sol';

function expected(names: string[]) {
  const files = names.map((path) => ({ path, source: readFileSync(`${root}fixtures/workshop/${path}`, 'utf8') }));
  const findings = files.flatMap((f) => lintSource(f.source, { file: f.path, rules, catalog }).findings);
  return reportDigest(files, findings);
}

describe('digestPath', () => {
  it('names a folder by the paths below it, and gives the CLI engine and hash', async () => {
    const d = await digestPath(`${root}fixtures/workshop`);
    expect(d.files).toEqual([draft, fixed]);
    const e = expected([draft, fixed]);
    expect(d).toMatchObject({ reportHash: e.reportHash, sourceHash: e.sourceHash, findings: e.findings });
    expect(d.findings).toBeGreaterThan(0);
  });

  it('names one file by its file name, as the playground does, so both give the same hash', async () => {
    const d = await digestPath(`${root}fixtures/workshop/${draft}`);
    expect(d.files).toEqual([draft]);
    expect(d.reportHash).toBe(expected([draft]).reportHash);
  });

  it('refuses a missing path and a folder without Solidity', async () => {
    await expect(digestPath(`${root}fixtures/none`)).rejects.toThrow(/no such file or folder/);
    await expect(digestPath(`${root}config`)).rejects.toThrow(/no .sol files/);
  });
});
