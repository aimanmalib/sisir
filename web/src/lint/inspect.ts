import { lintSource, renderDetail, ruleText, rules, type FileResult, type Finding, type Language } from '@sisir/rules';

/** Runs the same engine and rules as the CLI over one source. */
export function inspect(source: string, file: string): FileResult {
  return lintSource(source, { file, rules });
}

export interface FindingText {
  message: string;
  detail?: string;
  fix: string;
}

/** The text of a finding in one language, from the rule catalog or its translation. */
export function findingText(finding: Finding, lang: Language): FindingText {
  const text = ruleText(finding.ruleId, lang);
  return {
    message: text.message,
    ...(finding.detail ? { detail: renderDetail(text, finding.detail, lang) } : {}),
    fix: text.fix,
  };
}

/** A stable key for one finding, used to open its tag. */
export function findingKey(f: Finding): string {
  return `${f.ruleId}:${f.line}:${f.column}:${f.endLine}:${f.endColumn}`;
}

/** Findings grouped by the line they start on. */
export function byLine(findings: readonly Finding[]): Map<number, Finding[]> {
  const out = new Map<number, Finding[]>();
  for (const f of findings) {
    const list = out.get(f.line);
    if (list) list.push(f);
    else out.set(f.line, [f]);
  }
  return out;
}
