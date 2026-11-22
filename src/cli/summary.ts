import type { FileResult, Finding, Level, ParseFailure } from '../rules/types.js';

export interface RunResult {
  version: string;
  files: FileResult[];
}

export interface Summary {
  files: number;
  findings: number;
  error: number;
  warning: number;
  info: number;
  parseErrors: number;
}

export function allFindings(run: RunResult): Finding[] {
  return run.files.flatMap((f) => f.findings);
}

export function parseFailures(run: RunResult): ParseFailure[] {
  return run.files.flatMap((f) => (f.error ? [f.error] : []));
}

export function summarize(run: RunResult): Summary {
  const counts: Record<Level, number> = { error: 0, warning: 0, info: 0 };
  const findings = allFindings(run);
  for (const f of findings) counts[f.level] += 1;
  return { files: run.files.length, findings: findings.length, ...counts, parseErrors: parseFailures(run).length };
}

/** 2 when a file could not be parsed, 1 when there is an error-level finding, else 0. */
export function exitCode(run: RunResult): number {
  const s = summarize(run);
  if (s.parseErrors > 0) return 2;
  return s.error > 0 ? 1 : 0;
}
