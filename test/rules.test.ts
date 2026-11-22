import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog, lintSource, loadQoreChain, qorechain, rules } from '../src/rules/index.js';

const ROOT = join(import.meta.dirname, '..', 'fixtures', 'rules');
const SHIPPED = rules.map((r) => r.id);

/** Lines marked with "// expect <id>" in a fixture. */
function expectedLines(source: string, id: string): number[] {
  return source
    .split('\n')
    .flatMap((line, i) => (new RegExp(`//\\s*expect\\s+${id}\\b`).test(line) ? [i + 1] : []));
}

function fixtures(id: string): { name: string; source: string }[] {
  return readdirSync(join(ROOT, id))
    .filter((f) => f.endsWith('.sol'))
    .sort()
    .map((name) => ({ name, source: readFileSync(join(ROOT, id, name), 'utf8') }));
}

function linesFor(id: string, name: string, source: string): number[] {
  const result = lintSource(source, { file: name, rules });
  expect(result.error, `${name} must parse`).toBeUndefined();
  return result.findings.filter((f) => f.ruleId === id).map((f) => f.line);
}

describe('rule registry', () => {
  it('ships S001 to S004 in id order, each with a catalog entry', () => {
    expect(SHIPPED.slice(0, 4)).toEqual(['S001', 'S002', 'S003', 'S004']);
    expect([...SHIPPED].sort()).toEqual(SHIPPED);
    for (const id of SHIPPED) expect(catalog.get(id), id).toBeDefined();
  });
});

describe.each(SHIPPED)('%s fixtures', (id) => {
  const all = fixtures(id);
  const positives = all.filter((f) => f.name.startsWith('positive-'));
  const negatives = all.filter((f) => f.name.startsWith('negative-'));

  it('has at least two positive and two negative fixtures', () => {
    expect(positives.length).toBeGreaterThanOrEqual(2);
    expect(negatives.length).toBeGreaterThanOrEqual(2);
  });

  it.each(positives.map((f) => [f.name, f.source]))('flags exactly the marked lines in %s', (name, source) => {
    const want = expectedLines(source, id);
    expect(want.length, `${name} needs an "// expect ${id}" marker`).toBeGreaterThan(0);
    expect(linesFor(id, name, source)).toEqual(want);
  });

  it.each(negatives.map((f) => [f.name, f.source]))('leaves %s alone', (name, source) => {
    expect(expectedLines(source, id)).toEqual([]);
    expect(linesFor(id, name, source)).toEqual([]);
  });
});

describe('finding text', () => {
  it('S001 names the precompile it points at', () => {
    const src = 'contract A { address constant P = 0x0000000000000000000000000000000000000A02; }';
    const [f] = lintSource(src, { file: 'a.sol', rules }).findings;
    expect(f).toMatchObject({ ruleId: 'S001', level: 'warning', docs: 'https://build.qorechain.io/faq' });
    expect(f?.message).toMatch(/pqcKeyStatus\.$/);
  });

  it('S003 names each unread field', () => {
    const src = `contract A { function f(address a) external view {
      (bool registered, , , bool proven) = K.pqcKeyStatus(a);
    } }`;
    const messages = lintSource(src, { file: 'a.sol', rules }).findings.map((f) => f.message);
    expect(messages).toEqual([expect.stringMatching(/registered and possessionProven are never read\.$/)]);
  });

  it('S004 says why a successful low-level call is not enough', () => {
    const src = `contract A { function f(bytes calldata m) external view {
      (bool ok, ) = address(0x0000000000000000000000000000000000000a01).staticcall(m); require(ok);
    } }`;
    const ids = lintSource(src, { file: 'a.sol', rules }).findings.map((f) => f.ruleId);
    expect(ids).toEqual(['S004']);
  });

  it('S002 follows a local variable that holds the precompile address', () => {
    const src = `contract A { function f(bytes calldata m) external view returns (bytes memory) {
      address target = address(0x0000000000000000000000000000000000000c01);
      (bool ok, bytes memory ret) = target.staticcall(m); require(ok); return ret;
    } }`;
    expect(lintSource(src, { file: 'a.sol', rules }).findings.map((f) => [f.ruleId, f.line])).toEqual([['S002', 3]]);
  });
});

describe('qorechain.json', () => {
  it('lists the precompiles the rules depend on, by lowercase address', () => {
    const names = [...qorechain.precompiles.values()];
    expect(names).toEqual(expect.arrayContaining(['pqcVerify', 'pqcKeyStatus', 'crossVmBridge']));
    expect(qorechain.pqcKeyStatusFields[3]).toBe('possessionProven');
  });

  it('refuses a mixed-case address and a short field list', () => {
    expect(() => loadQoreChain({ precompiles: { x: '0x0000000000000000000000000000000000000A01' }, pqcKeyStatusFields: ['a', 'b', 'c', 'd'] })).toThrow(/lowercase/);
    expect(() => loadQoreChain({ precompiles: {}, pqcKeyStatusFields: ['a'] })).toThrow(/four/);
  });
});
