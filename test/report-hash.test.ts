import { describe, expect, it } from 'vitest';
import { canonicalReport, MAX_FINDINGS, reportDigest, sourceHash } from '../src/report/hash.js';
import type { Finding } from '../src/rules/types.js';

// Published keccak256 vectors: the empty string and "abc".
const EMPTY = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470';
const ABC = '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45';

function finding(ruleId: string, file: string, line: number, column = 5, message = 'text'): Finding {
  return { ruleId, level: 'error', file, line, column, endLine: line, endColumn: column + 3, message, fix: 'fix', docs: 'https://x' };
}

describe('report hash for SisirLedger.anchor', () => {
  it('hashes one file as keccak256 of its UTF-8 bytes', () => {
    expect(sourceHash([{ path: 'a.sol', source: '' }])).toBe(EMPTY);
    expect(sourceHash([{ path: 'a.sol', source: 'abc' }])).toBe(ABC);
  });

  it('hashes several files by their hashes in path order, whatever order they arrive in', () => {
    const a = { path: 'a.sol', source: 'abc' };
    const b = { path: 'b.sol', source: '' };
    expect(sourceHash([b, a])).toBe(sourceHash([a, b]));
    expect(sourceHash([a, b])).not.toBe(ABC);
  });

  it('writes the canonical report with fixed keys, sorted files and findings, and no message text', () => {
    const files = [
      { path: 'b.sol', source: '' },
      { path: 'a.sol', source: 'abc' },
    ];
    const json = canonicalReport(files, [finding('S004', 'b.sol', 2), finding('S007', 'a.sol', 9), finding('S003', 'a.sol', 9, 1)]);
    expect(json).toBe(
      '{"schema":"sisir-report/1","files":[' +
        `{"path":"a.sol","sourceHash":"${ABC}"},{"path":"b.sol","sourceHash":"${EMPTY}"}],"findings":[` +
        '{"rule":"S003","level":"error","path":"a.sol","line":9,"column":1,"endLine":9,"endColumn":4},' +
        '{"rule":"S007","level":"error","path":"a.sol","line":9,"column":5,"endLine":9,"endColumn":8},' +
        '{"rule":"S004","level":"error","path":"b.sol","line":2,"column":5,"endLine":2,"endColumn":8}]}',
    );
  });

  it('gives the same report hash in every language and a different one when a finding moves', () => {
    const files = [{ path: 'v.sol', source: 'contract V {}' }];
    const en = reportDigest(files, [finding('S001', 'v.sol', 3, 5, 'Mixed case')]);
    const ms = reportDigest(files, [finding('S001', 'v.sol', 3, 5, 'Huruf campur')]);
    const moved = reportDigest(files, [finding('S001', 'v.sol', 4)]);
    expect(ms.reportHash).toBe(en.reportHash);
    expect(moved.reportHash).not.toBe(en.reportHash);
    expect(en.reportHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(en.findings).toBe(1);
  });

  it('caps the findings count at what a uint16 holds and refuses an empty report', () => {
    const many = Array.from({ length: MAX_FINDINGS + 2 }, (_, i) => finding('S001', 'v.sol', i + 1));
    expect(reportDigest([{ path: 'v.sol', source: '' }], many).findings).toBe(MAX_FINDINGS);
    expect(() => reportDigest([], [])).toThrow(/at least one file/);
  });
});
