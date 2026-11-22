import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import AjvDraft04 from 'ajv-draft-04';
import { describe, expect, it } from 'vitest';
import { main } from '../src/cli/main.js';
import { captureIo, testCatalog, testRules } from './helpers.js';

const fixtures = fileURLToPath(new URL('./fixtures/cli/', import.meta.url));
const options = { version: '9.9.9', rules: testRules, catalog: testCatalog };

async function run(args: string[], env: Record<string, string | undefined> = {}, isTTY = false) {
  const io = captureIo(fixtures, env, isTTY);
  const code = await main(args, io, options);
  return { code, out: io.stdout, err: io.stderr };
}

describe('exit codes', () => {
  it('is 0 when there is no error-level finding', async () => {
    expect((await run(['clean.sol'])).code).toBe(0);
  });

  it('is 1 when there is an error-level finding', async () => {
    expect((await run(['nested'])).code).toBe(1);
  });

  it('is 2 when a file does not parse, even next to findings', async () => {
    const r = await run(['nested', 'broken']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('broken/broken.sol:5:20  parse error');
    expect(r.out).toContain('T001');
  });

  it('is 2 for a missing path, an unknown format, an unknown flag or no path', async () => {
    expect(await run(['nope.sol'])).toMatchObject({ code: 2, err: expect.stringContaining('no such file or folder: nope.sol') });
    expect(await run(['--format', 'xml', 'clean.sol'])).toMatchObject({ code: 2, err: expect.stringContaining('unknown format') });
    expect((await run(['--bogus', 'clean.sol'])).code).toBe(2);
    expect((await run([])).code).toBe(2);
  });

  it('prints help and version with exit 0', async () => {
    expect(await run(['--help'])).toMatchObject({ code: 0, out: expect.stringContaining('Usage: sisir') });
    expect(await run(['-v'])).toMatchObject({ code: 0, out: '9.9.9\n' });
  });
});

describe('file discovery', () => {
  it('walks folders, de-duplicates, and skips dependency and build folders', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sisir-files-'));
    try {
      for (const sub of ['src/deep', 'node_modules/pkg', 'lib/forge-std', 'out']) mkdirSync(join(dir, sub), { recursive: true });
      for (const f of ['src/A.sol', 'src/deep/B.sol', 'node_modules/pkg/C.sol', 'lib/forge-std/D.sol', 'out/E.sol', 'src/notes.txt']) {
        writeFileSync(join(dir, f), 'contract Flagged {}\n');
      }
      const io = captureIo(dir);
      const code = await main(['-f', 'json', '.', 'src/A.sol'], io, options);
      const body = JSON.parse(io.stdout);
      expect(code).toBe(1);
      expect(body.summary.files).toBe(2);
      expect(body.findings.map((f: { file: string }) => f.file)).toEqual(['src/A.sol', 'src/deep/B.sol']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('text format', () => {
  it('prints file:line:col, level, id, message, fix and docs, then a summary', async () => {
    const r = await run(['nested']);
    expect(r.out).toContain('nested/flagged.sol:4:1  error  T001  Contract is named Flagged.');
    expect(r.out).toContain('  fix:  Rename it.');
    expect(r.out).toContain('  docs: https://example.org/t001');
    expect(r.out.trimEnd().split('\n').at(-1)).toBe('sisir 9.9.9: 1 file, 1 error, 1 warning, 1 info');
    expect(r.out).not.toContain('\u001b[');
  });

  it('uses colour on a terminal unless NO_COLOR or --no-color is set', async () => {
    expect((await run(['nested'], {}, true)).out).toContain('\u001b[31merror');
    expect((await run(['nested'], { NO_COLOR: '1' }, true)).out).not.toContain('\u001b[');
    expect((await run(['--no-color', 'nested'], {}, true)).out).not.toContain('\u001b[');
    expect((await run(['nested'], { FORCE_COLOR: '1' }, false)).out).toContain('\u001b[');
  });
});

describe('json format', () => {
  it('lists findings with every field and a summary', async () => {
    const body = JSON.parse((await run(['-f', 'json', 'nested', 'broken'])).out);
    expect(body.tool).toBe('sisir');
    expect(body.version).toBe('9.9.9');
    expect(body.summary).toEqual({ files: 2, findings: 3, error: 1, warning: 1, info: 1, parseErrors: 1 });
    expect(body.findings[1]).toEqual({
      ruleId: 'T001',
      level: 'error',
      file: 'nested/flagged.sol',
      line: 4,
      column: 1,
      endLine: 8,
      endColumn: 1,
      message: 'Contract is named Flagged.',
      fix: 'Rename it.',
      docs: 'https://example.org/t001',
    });
    expect(body.parseErrors[0]).toMatchObject({ file: 'broken/broken.sol', line: 5, column: 20 });
  });
});

describe('sarif format', () => {
  const schema = JSON.parse(readFileSync(new URL('./schema/sarif-schema-2.1.0.json', import.meta.url), 'utf8'));
  const validate = new AjvDraft04.default({ allErrors: true, strict: false }).compile(schema);

  it('is valid SARIF 2.1.0 with findings, rules and a parse error', async () => {
    const log = JSON.parse((await run(['--format', 'sarif', 'nested', 'broken'])).out);
    expect(validate(log), JSON.stringify(validate.errors)).toBe(true);
    const sarifRun = log.runs[0];
    expect(sarifRun.tool.driver.rules.map((r: { id: string }) => r.id)).toEqual(['T001', 'T002', 'T003']);
    expect(sarifRun.results.map((r: { ruleId: string; level: string }) => [r.ruleId, r.level])).toEqual([
      ['T003', 'note'],
      ['T001', 'error'],
      ['T002', 'warning'],
    ]);
    expect(sarifRun.results[1].ruleIndex).toBe(0);
    expect(sarifRun.results[1].locations[0].physicalLocation).toEqual({
      artifactLocation: { uri: 'nested/flagged.sol' },
      region: { startLine: 4, startColumn: 1, endLine: 8, endColumn: 1 },
    });
    expect(sarifRun.invocations[0].executionSuccessful).toBe(false);
    expect(sarifRun.invocations[0].toolExecutionNotifications).toHaveLength(1);
  });

  it('is valid SARIF for a clean run with the shipped catalog', async () => {
    const io = captureIo(fixtures);
    const code = await main(['--format', 'sarif', 'clean.sol'], io, { version: '9.9.9' });
    const log = JSON.parse(io.stdout);
    expect(code).toBe(0);
    expect(validate(log), JSON.stringify(validate.errors)).toBe(true);
    expect(log.runs[0].results).toEqual([]);
    expect(log.runs[0].invocations[0].executionSuccessful).toBe(true);
  });

  it('rejects a log that breaks the schema, so the check is real', () => {
    expect(validate({ version: '2.1.0', runs: [{ tool: {} }] })).toBe(false);
  });
});
