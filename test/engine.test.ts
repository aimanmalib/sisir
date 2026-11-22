import { describe, expect, it } from 'vitest';
import { catalog, lintSource, loadCatalog, rules } from '../src/rules/index.js';
import type { Rule } from '../src/rules/types.js';
import { contractRule, functionRule, testCatalog, testRules } from './helpers.js';

const SOURCE = `pragma solidity ^0.8.24;
contract Flagged {
    function ping() external pure returns (uint256) { return 1; }
}
`;

describe('lintSource', () => {
  it('walks the AST once for all rules and maps catalog text onto findings', () => {
    const result = lintSource(SOURCE, { file: 'a.sol', rules: testRules, catalog: testCatalog });
    expect(result.error).toBeUndefined();
    expect(result.findings.map((f) => [f.ruleId, f.level, f.line, f.column])).toEqual([
      ['T003', 'info', 1, 1],
      ['T001', 'error', 2, 1],
      ['T002', 'warning', 3, 5],
    ]);
    const ping = result.findings.find((f) => f.ruleId === 'T002');
    expect(ping).toMatchObject({
      file: 'a.sol',
      message: 'Function is named ping. Seen in a test.',
      fix: 'Rename it.',
      docs: 'https://example.org/t002',
    });
  });

  it('reports a parse failure with a 1-based position instead of throwing', () => {
    const result = lintSource('contract A { function f( }', { file: 'bad.sol', rules: testRules, catalog: testCatalog });
    expect(result.findings).toEqual([]);
    expect(result.error).toMatchObject({ file: 'bad.sol', line: 1, column: 26 });
    expect(result.error?.message.length).toBeLessThanOrEqual(160);
  });

  it('refuses a rule that has no catalog entry', () => {
    const stray = { ...contractRule, id: 'T999' };
    expect(() => lintSource(SOURCE, { file: 'a.sol', rules: [stray], catalog: testCatalog })).toThrow(/T999/);
  });

  it('finds nothing when no rule matches', () => {
    const result = lintSource('contract Other {}', { file: 'b.sol', rules: [contractRule, functionRule], catalog: testCatalog });
    expect(result).toEqual({ file: 'b.sol', findings: [] });
  });

  it('reports a node once even though the parser stores a state variable value twice', () => {
    const literalRule: Rule = { id: 'T003', create: (ctx) => ({ NumberLiteral: (n) => ctx.report(n) }) };
    const result = lintSource('contract A { uint256 constant X = 7; }', { file: 'a.sol', rules: [literalRule], catalog: testCatalog });
    expect(result.findings.map((f) => [f.ruleId, f.line, f.column])).toEqual([['T003', 1, 35]]);
  });
});

describe('catalog', () => {
  it('has every field for every rule and an id for every shipped rule', () => {
    for (const entry of catalog.values()) {
      expect(entry.id).toMatch(/^S\d{3}$/);
      expect(entry.docs).toMatch(/^https:\/\//);
    }
    for (const rule of rules) expect(catalog.has(rule.id)).toBe(true);
  });

  it('rejects a broken catalog', () => {
    expect(() => loadCatalog({})).toThrow(/array/);
    expect(() => loadCatalog({ rules: [{ id: 'X1', name: 'x', level: 'loud', docs: 'https://x', message: 'm', fix: 'f' }] })).toThrow(
      /level/,
    );
    expect(() => loadCatalog({ rules: [{ id: 'X1', name: 'x', level: 'error', docs: 'http://x', message: 'm', fix: 'f' }] })).toThrow(
      /https/,
    );
    expect(() => loadCatalog({ rules: [{ id: 'X1', name: 'x', level: 'error', docs: 'https://x', message: ' ', fix: 'f' }] })).toThrow(
      /message/,
    );
    const one = { id: 'X1', name: 'x', level: 'error', docs: 'https://x', message: 'm', fix: 'f' };
    expect(() => loadCatalog({ rules: [one, one] })).toThrow(/twice/);
  });
});
