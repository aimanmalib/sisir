import type { ASTNode } from './types.js';
import { literalValue, qorechain } from './qorechain.js';

/** Loose view of a parser node. The parser's own types are a wide union that is awkward to narrow. */
export interface Node {
  type: string;
  loc?: ASTNode['loc'] | undefined;
  [key: string]: any;
}

export function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

/** Calls fn for every node under root (root included) with its parent. */
export function walk(root: Node, fn: (node: Node, parent: Node | undefined) => void, parent?: Node): void {
  fn(root, parent);
  for (const [key, value] of Object.entries(root)) {
    if (key === 'loc' || key === 'range') continue;
    const items: unknown[] = Array.isArray(value) ? value : [value];
    for (const item of items) if (isNode(item)) walk(item, fn, root);
  }
}

/** Maps every node under root to its parent. */
export function parents(root: Node): Map<Node, Node> {
  const map = new Map<Node, Node>();
  walk(root, (node, parent) => {
    if (parent) map.set(node, parent);
  });
  return map;
}

/** True when an Identifier with this name is read somewhere under root, outside the nodes in skip. */
export function isRead(root: Node, name: string, skip: readonly Node[] = []): boolean {
  let found = false;
  const visit = (node: Node, parent: Node | undefined): void => {
    if (found || skip.includes(node)) return;
    if (node.type === 'Identifier' && node.name === name && parent?.type !== 'VariableDeclaration') {
      found = true;
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'range') continue;
      const items: unknown[] = Array.isArray(value) ? value : [value];
      for (const item of items) if (isNode(item)) visit(item, node);
    }
  };
  visit(root, undefined);
  return found;
}

/** Name to initial value for file-level constants and state variables. */
export function fileBindings(unit: Node): Map<string, Node> {
  const out = new Map<string, Node>();
  const take = (node: Node): void => {
    if (node.type === 'FileLevelConstant' && isNode(node.initialValue)) out.set(node.name, node.initialValue);
    if (node.type === 'StateVariableDeclaration') {
      for (const v of node.variables as Node[]) if (isNode(v.expression)) out.set(v.name, v.expression);
    }
    if (node.type === 'ContractDefinition') (node.subNodes as Node[]).forEach(take);
  };
  (unit.children as Node[]).forEach(take);
  return out;
}

/** File bindings plus the single-variable local declarations in one function body. */
export function bodyBindings(body: Node, file: ReadonlyMap<string, Node>): Map<string, Node> {
  const out = new Map(file);
  walk(body, (node) => {
    if (node.type === 'VariableDeclarationStatement' && node.variables.length === 1) {
      const v = node.variables[0] as Node | null;
      if (v && isNode(node.initialValue)) out.set(v.name, node.initialValue);
    }
  });
  return out;
}

const CONVERSIONS = new Set(['address', 'payable']);

/** Name of the QoreChain precompile an expression points at, when it can be read from the source. */
export function resolvePrecompile(expr: unknown, bindings: ReadonlyMap<string, Node>, depth = 0): string | undefined {
  if (!isNode(expr) || depth > 8) return undefined;
  switch (expr.type) {
    case 'NumberLiteral': {
      if (expr.subdenomination) return undefined;
      const value = literalValue(expr.number);
      return value === undefined ? undefined : qorechain.precompiles.get(value);
    }
    case 'Identifier':
      return resolvePrecompile(bindings.get(expr.name), bindings, depth + 1);
    case 'TupleExpression':
      return expr.components.length === 1 ? resolvePrecompile(expr.components[0], bindings, depth + 1) : undefined;
    case 'FunctionCall': {
      // Only type conversions such as address(x), payable(x) or IQorePQC(x).
      const callee = expr.expression as Node;
      const conversion =
        callee.type === 'ElementaryTypeName' ||
        callee.type === 'TypeNameExpression' ||
        (callee.type === 'Identifier' && (CONVERSIONS.has(callee.name) || /^[A-Z]/.test(callee.name)));
      if (!conversion || expr.arguments.length !== 1 || expr.names.length > 0) return undefined;
      return resolvePrecompile(expr.arguments[0], bindings, depth + 1);
    }
    default:
      return undefined;
  }
}

/** The function bodies a rule should inspect: functions and modifiers that have a body. */
export function isBodyOwner(node: Node): boolean {
  return (node.type === 'FunctionDefinition' || node.type === 'ModifierDefinition') && isNode(node.body);
}
