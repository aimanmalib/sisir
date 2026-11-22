import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const bin = join(root, 'dist/cli.js');
const script = join(root, 'scripts/action/run.sh');
const temps: string[] = [];

afterEach(() => {
  while (temps.length) rmSync(temps.pop()!, { recursive: true, force: true });
});

function runAction(paths: string) {
  const dir = mkdtempSync(join(tmpdir(), 'sisir-action-'));
  temps.push(dir);
  const outputFile = join(dir, 'output');
  const sarif = join(dir, 'sisir.sarif');
  const r = spawnSync('bash', [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      PATH: `${dirname(process.execPath)}:${process.env.PATH ?? ''}`,
      SISIR_CLI: bin,
      SISIR_PATHS: paths,
      SISIR_SARIF: sarif,
      GITHUB_OUTPUT: outputFile,
    },
  });
  const outputs = existsSync(outputFile)
    ? Object.fromEntries(readFileSync(outputFile, 'utf8').trim().split('\n').map((l) => l.split('=', 2)))
    : {};
  return { status: r.status, stdout: r.stdout, outputs, sarif };
}

// The gate builds dist/ before running tests (npm ci runs the prepare script).
describe.runIf(existsSync(bin))('GitHub Action run script', () => {
  it('reports S003 and S007 on the workshop draft as exit-code 1 with a SARIF file', () => {
    const r = runAction('fixtures/workshop');
    expect(r.status).toBe(0);
    expect(r.outputs['exit-code']).toBe('1');
    expect(r.outputs['sarif-file']).toBe(r.sarif);
    const results = JSON.parse(readFileSync(r.sarif, 'utf8')).runs[0].results;
    expect(results.map((x: { ruleId: string }) => x.ruleId).sort()).toEqual(['S003', 'S007']);
    expect(r.stdout).toContain('2 files, 2 errors');
  });

  it('accepts several paths on separate lines and exits clean on SisirLedger', () => {
    const r = runAction('contracts/src\n  test/fixtures/cli/clean.sol ');
    expect(r.status).toBe(0);
    expect(r.outputs['exit-code']).toBe('0');
    expect(r.stdout).toContain('0 errors');
  });

  it('fails with exit 2 and no SARIF output on a file that does not parse', () => {
    const r = runAction('test/fixtures/cli/broken');
    expect(r.status).toBe(2);
    expect(r.outputs['exit-code']).toBe('2');
    expect(r.outputs['sarif-file']).toBeUndefined();
    expect(existsSync(r.sarif)).toBe(false);
  });

  it('treats a path as data, not shell', () => {
    const r = runAction('$(touch pwned) ; echo injected');
    expect(r.status).toBe(2);
    expect(existsSync(join(root, 'pwned'))).toBe(false);
  });
});

describe('action.yml', () => {
  const text = readFileSync(join(root, 'action.yml'), 'utf8');
  it('passes inputs to shell only through env, never inline in a run block', () => {
    const runBlocks = text.split(/\n\s+- name:/).flatMap((step) => step.split(/\n\s+run: ?\|?/).slice(1));
    for (const block of runBlocks) expect(block.split(/\n\s+- /)[0]).not.toMatch(/\$\{\{\s*inputs\./);
  });
  it('pins the SARIF upload action to a full commit SHA', () => {
    expect(text).toMatch(/codeql-action\/upload-sarif@[0-9a-f]{40}\b/);
  });
});
