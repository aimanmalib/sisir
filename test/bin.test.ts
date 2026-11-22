import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const bin = fileURLToPath(new URL('../dist/cli.js', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

// The gate builds dist/ before running tests (npm ci runs the prepare script).
describe.runIf(existsSync(bin))('built bin', () => {
  it('is the package bin and runs on a folder', () => {
    expect(pkg.bin).toEqual({ sisir: 'dist/cli.js' });
    const r = spawnSync(process.execPath, [bin, 'test/fixtures/cli/clean.sol'], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`sisir ${pkg.version}: 1 file, 0 errors`);
  });

  it('exits 2 on a file that does not parse', () => {
    const r = spawnSync(process.execPath, [bin, 'test/fixtures/cli/broken'], { cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH } });
    expect(r.status).toBe(2);
  });
});
