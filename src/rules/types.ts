import type { ASTVisitor, ASTNode } from '@solidity-parser/parser/dist/src/ast-types.js';

export type Level = 'error' | 'warning' | 'info';

/** One rule as described in catalog.json. */
export interface CatalogEntry {
  id: string;
  name: string;
  level: Level;
  docs: string;
  message: string;
  fix: string;
}

export interface Position {
  line: number;
  column: number;
}

/** One problem found in one file. Lines and columns are 1-based. */
export interface Finding {
  ruleId: string;
  level: Level;
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  message: string;
  fix: string;
  docs: string;
}

/** A file that could not be parsed. */
export interface ParseFailure {
  file: string;
  line: number;
  column: number;
  message: string;
}

export interface FileResult {
  file: string;
  findings: Finding[];
  error?: ParseFailure;
}

export interface Report {
  data?: string;
  node: ASTNode;
}

export interface RuleContext {
  file: string;
  source: string;
  report(node: ASTNode, detail?: string): void;
}

/** A rule only walks the AST. Text, level and docs come from the catalog. */
export interface Rule {
  id: string;
  create(context: RuleContext): ASTVisitor;
}

export type { ASTNode, ASTVisitor };
