import { allFindings, parseFailures, summarize, type RunResult } from './summary.js';

export function formatJson(run: RunResult): string {
  const body = {
    tool: 'sisir',
    version: run.version,
    summary: summarize(run),
    findings: allFindings(run),
    parseErrors: parseFailures(run),
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}
