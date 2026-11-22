import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lintSource, rules } from '../src/rules/index.js';

const DIR = join(import.meta.dirname, '..', 'fixtures', 'workshop');
const DRAFT = 'QDayVault_v0_buggy.sol';
const FIXED = 'QDayVault_v1_fixed.sol';

function read(name: string): string {
  return readFileSync(join(DIR, name), 'utf8');
}

function lint(name: string) {
  const result = lintSource(read(name), { file: name, rules });
  expect(result.error, `${name} must parse`).toBeUndefined();
  return result.findings;
}

describe('workshop 2 audit vault', () => {
  it('keeps both files byte for byte as recorded in fixtures/workshop/README.md', () => {
    const readme = read('README.md');
    for (const name of [DRAFT, FIXED]) {
      const sha = createHash('sha256').update(readFileSync(join(DIR, name))).digest('hex');
      expect(readme, `${name} sha256 ${sha}`).toContain(`| \`${name}\` | \`${sha}\` |`);
    }
  });

  it('S003 and S007 flag the first draft, each matching a line of the workshop audit notes', () => {
    const found = lint(DRAFT).map((f) => ({ id: f.ruleId, level: f.level, line: f.line }));
    expect(found).toEqual([
      // The guardian key is used without checking registered or possessionProven
      // (audit README: "One thing the auditor did not flag, and we fixed anyway").
      { id: 'S003', level: 'error', line: 29 },
      // abi.encodePacked(to, amount) can be replayed (audit finding 4).
      { id: 'S007', level: 'error', line: 31 },
    ]);
  });

  it('finds nothing in the fixed version', () => {
    expect(lint(FIXED)).toEqual([]);
  });
});
