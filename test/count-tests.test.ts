import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const lib = join(import.meta.dirname, '..', 'scripts', 'lib', 'count-tests.sh');
const ESC = '\x1b';

// Runs one counter from the gate's library on the given runner output and returns "<passed> <skipped>".
const count = (fn: string, input: string) => {
  const r = spawnSync('bash', ['-c', `source "$1"; ${fn}`, 'count', lib], { input, encoding: 'utf8' });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout.trim();
};

describe('gate test counters (scripts/lib/count-tests.sh)', () => {
  it('reads a plain vitest summary', () => {
    expect(count('count_vitest', ' Test Files  8 passed (8)\n      Tests  109 passed (109)\n')).toBe('109 0');
  });

  it('reads a vitest summary with skipped tests', () => {
    expect(count('count_vitest', '      Tests  7 passed | 2 skipped (9)\n')).toBe('7 2');
  });

  // CI runners force colour, so vitest wraps every word of the summary in ANSI codes.
  it('reads a coloured vitest summary as printed in CI', () => {
    const line = `${ESC}[2m      Tests ${ESC}[22m ${ESC}[1m${ESC}[32m109 passed${ESC}[39m${ESC}[22m${ESC}[90m (109)${ESC}[39m\n`;
    expect(count('count_vitest', line)).toBe('109 0');
    const skipped = `${ESC}[2m      Tests ${ESC}[22m ${ESC}[1m${ESC}[32m7 passed${ESC}[39m${ESC}[22m${ESC}[2m | ${ESC}[22m${ESC}[33m2 skipped${ESC}[39m${ESC}[90m (9)${ESC}[39m\n`;
    expect(count('count_vitest', skipped)).toBe('7 2');
  });

  it('reads the forge total and a coloured playwright summary', () => {
    expect(count('count_forge', 'Ran 2 test suites: 14 tests passed, 0 failed, 0 skipped (14 total tests)\n')).toBe('14 0');
    expect(count('count_playwright', `  ${ESC}[32m4 passed${ESC}[39m${ESC}[2m (3.1s)${ESC}[22m\n`)).toBe('4 0');
  });
});
