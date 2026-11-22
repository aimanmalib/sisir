import type { Level } from '../rules/types.js';
import { allFindings, parseFailures, summarize, type RunResult } from './summary.js';

const CODES = { red: 31, yellow: 33, cyan: 36, dim: 2, bold: 1 } as const;
type Style = keyof typeof CODES;

const LEVEL_STYLE: Record<Level, Style> = { error: 'red', warning: 'yellow', info: 'cyan' };

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function formatText(run: RunResult, color: boolean): string {
  const paint = (style: Style, text: string) => (color ? `\u001b[${CODES[style]}m${text}\u001b[0m` : text);
  const lines: string[] = [];
  for (const f of allFindings(run)) {
    lines.push(`${paint('bold', `${f.file}:${f.line}:${f.column}`)}  ${paint(LEVEL_STYLE[f.level], f.level)}  ${f.ruleId}  ${f.message}`);
    lines.push(`  ${paint('dim', 'fix:')}  ${f.fix}`);
    lines.push(`  ${paint('dim', 'docs:')} ${f.docs}`);
  }
  for (const e of parseFailures(run)) {
    lines.push(`${paint('bold', `${e.file}:${e.line}:${e.column}`)}  ${paint('red', 'parse error')}  ${e.message}`);
  }
  const s = summarize(run);
  const parts = [plural(s.files, 'file'), plural(s.error, 'error'), plural(s.warning, 'warning'), `${s.info} info`];
  if (s.parseErrors > 0) parts.push(plural(s.parseErrors, 'parse error'));
  if (lines.length > 0) lines.push('');
  lines.push(`sisir ${run.version}: ${parts.join(', ')}`);
  return `${lines.join('\n')}\n`;
}
