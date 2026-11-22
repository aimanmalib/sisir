import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';
import type { Finding } from '../rules/types.js';

/** Bumped only when the canonical form below changes, so an old anchor can still be recomputed. */
export const REPORT_SCHEMA = 'sisir-report/1';

/** The largest findings count the ledger stores (`uint16`). */
export const MAX_FINDINGS = 0xffff;

export interface ReportFile {
  /** The name the report shows: the file name for one file, the path below the scanned folder otherwise. */
  path: string;
  source: string;
}

/** The three values `SisirLedger.anchor` takes. Hashes are 0x-prefixed, 32 bytes. */
export interface ReportDigest {
  reportHash: `0x${string}`;
  sourceHash: `0x${string}`;
  findings: number;
  /** The exact JSON that `reportHash` is the keccak256 of. */
  canonical: string;
}

type Hex = `0x${string}`;

function keccak(bytes: Uint8Array): Uint8Array {
  return keccak_256(bytes);
}

function hex(bytes: Uint8Array): Hex {
  return `0x${bytesToHex(bytes)}`;
}

function byPath(a: ReportFile, b: ReportFile): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/**
 * keccak256 of the linted source. One file: the hash of its UTF-8 bytes, the same as `cast keccak` of the file.
 * Several files: the hash of their 32-byte hashes joined in path order.
 */
export function sourceHash(files: readonly ReportFile[]): Hex {
  const sorted = [...files].sort(byPath);
  const first = sorted[0];
  if (sorted.length === 1 && first) return hex(keccak(utf8ToBytes(first.source)));
  const joined = new Uint8Array(32 * sorted.length);
  sorted.forEach((f, i) => joined.set(keccak(utf8ToBytes(f.source)), 32 * i));
  return hex(keccak(joined));
}

/**
 * The canonical report: schema, files with their source hash, and every finding by rule, level and position.
 * Messages are left out, so the same scan has the same hash in every language. Keys are written in a fixed order.
 */
export function canonicalReport(files: readonly ReportFile[], findings: readonly Finding[]): string {
  const sorted = [...files].sort(byPath);
  const rows = findings
    .map((f) => ({
      rule: f.ruleId,
      level: f.level,
      path: f.file,
      line: f.line,
      column: f.column,
      endLine: f.endLine,
      endColumn: f.endColumn,
    }))
    .sort(
      (a, b) =>
        (a.path < b.path ? -1 : a.path > b.path ? 1 : 0) ||
        a.line - b.line ||
        a.column - b.column ||
        (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0) ||
        a.endLine - b.endLine ||
        a.endColumn - b.endColumn,
    );
  return JSON.stringify({
    schema: REPORT_SCHEMA,
    files: sorted.map((f) => ({ path: f.path, sourceHash: hex(keccak(utf8ToBytes(f.source))) })),
    findings: rows,
  });
}

/** Everything the ledger needs for one scan. The CLI and the playground both call this. */
export function reportDigest(files: readonly ReportFile[], findings: readonly Finding[]): ReportDigest {
  if (files.length === 0) throw new Error('A report needs at least one file');
  const canonical = canonicalReport(files, findings);
  return {
    reportHash: hex(keccak(utf8ToBytes(canonical))),
    sourceHash: sourceHash(files),
    findings: Math.min(findings.length, MAX_FINDINGS),
    canonical,
  };
}
