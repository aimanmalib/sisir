import parser from '@solidity-parser/parser';
import { catalog as defaultCatalog } from './catalog.js';
import type { ASTNode, ASTVisitor, CatalogEntry, FileResult, Finding, Rule } from './types.js';

export interface LintOptions {
  file: string;
  rules: readonly Rule[];
  catalog?: ReadonlyMap<string, CatalogEntry>;
}

const MAX_ERROR_LENGTH = 160;

function shorten(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_ERROR_LENGTH ? `${oneLine.slice(0, MAX_ERROR_LENGTH - 1)}…` : oneLine;
}

/** Joins the visitors of all rules so the AST is walked once. */
function combine(visitors: ASTVisitor[]): ASTVisitor {
  const merged: Record<string, ((node: ASTNode) => void)[]> = {};
  for (const v of visitors) {
    for (const [key, fn] of Object.entries(v)) {
      if (typeof fn === 'function') (merged[key] ??= []).push(fn as (node: ASTNode) => void);
    }
  }
  const out: Record<string, (node: ASTNode) => void> = {};
  for (const [key, fns] of Object.entries(merged)) {
    out[key] = (node) => {
      for (const fn of fns) fn(node);
    };
  }
  return out as ASTVisitor;
}

export function compareFindings(a: Finding, b: Finding): number {
  return a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column || a.ruleId.localeCompare(b.ruleId);
}

/** Parses one Solidity source and runs every rule over it. Never throws on bad Solidity. */
export function lintSource(source: string, options: LintOptions): FileResult {
  const { file, rules } = options;
  const catalog = options.catalog ?? defaultCatalog;
  let ast: ASTNode;
  try {
    ast = parser.parse(source, { loc: true, range: true }) as ASTNode;
  } catch (e) {
    if (e instanceof parser.ParserError) {
      const first = e.errors[0];
      return {
        file,
        findings: [],
        error: { file, line: first?.line ?? 1, column: (first?.column ?? 0) + 1, message: shorten(first?.message ?? e.message) },
      };
    }
    throw e;
  }
  const findings: Finding[] = [];
  const visitors = rules.map((rule) => {
    const entry = catalog.get(rule.id);
    if (!entry) throw new Error(`rule ${rule.id} is not in the catalog`);
    return rule.create({
      file,
      source,
      report(node, detail) {
        const loc = node.loc ?? { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } };
        findings.push({
          ruleId: entry.id,
          level: entry.level,
          file,
          line: loc.start.line,
          column: loc.start.column + 1,
          endLine: loc.end.line,
          endColumn: loc.end.column + 1,
          message: detail ? `${entry.message} ${detail}` : entry.message,
          fix: entry.fix,
          docs: entry.docs,
        });
      },
    });
  });
  parser.visit(ast, combine(visitors));
  findings.sort(compareFindings);
  return { file, findings };
}
