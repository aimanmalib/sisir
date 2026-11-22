import { isConversion, isNode, walk, type Node } from './ast.js';
import { baseName, localCallee, stateNames, type ContractScope } from './contract-rule.js';

/** What a signed message is built from, as far as the source shows. */
export interface Binding {
  chainid: boolean;
  self: boolean;
  counter: boolean;
  /** Part of the message comes from somewhere the rule cannot read, so it stays silent. */
  opaque: boolean;
}

type Slot = { expr: Node; env: Env; file?: true } | 'opaque' | 'leaf';
type Env = Map<string, Slot>;

const BUILTINS = new Set(['keccak256', 'sha256', 'ripemd160']);
const MAX_DEPTH = 12;

/**
 * State variables that change like a counter outside the constructor: x++, x += n, or x = <something read
 * from x> (directly or through a local such as uint256 n = nonce; nonce = n + 1).
 */
export function counters(scope: ContractScope): Set<string> {
  const state = stateNames(scope.contract);
  const out = new Set<string>();
  for (const fn of scope.functions) {
    if (fn.isConstructor) continue;
    const locals = new Map<string, Node>();
    walk(fn.body as Node, (node) => {
      if (node.type === 'VariableDeclarationStatement' && node.variables.length === 1 && node.variables[0] && isNode(node.initialValue)) {
        locals.set(node.variables[0].name, node.initialValue);
      }
    });
    const mentions = (expr: Node, name: string, depth = 0): boolean => {
      let hit = false;
      walk(expr, (n) => {
        if (hit || n.type !== 'Identifier') return;
        if (n.name === name) hit = true;
        else if (depth < 4 && locals.has(n.name)) hit = mentions(locals.get(n.name) as Node, name, depth + 1);
      });
      return hit;
    };
    walk(fn.body as Node, (node) => {
      let name: string | undefined;
      if (node.type === 'UnaryOperation' && (node.operator === '++' || node.operator === '--')) name = baseName(node.subExpression);
      if (node.type === 'BinaryOperation' && (node.operator === '+=' || node.operator === '-=')) name = baseName(node.left);
      if (node.type === 'BinaryOperation' && node.operator === '=') {
        const target = baseName(node.left);
        if (target && mentions(node.right as Node, target)) name = target;
      }
      if (name && state.has(name)) out.add(name);
    });
  }
  return out;
}

/** Parameters and single-variable locals of a function. Arguments bind parameters when the function is called. */
function envOf(fn: Node, scope: ContractScope, args?: { nodes: Node[]; env: Env }): Env {
  const env: Env = new Map();
  for (const [name, expr] of scope.file) env.set(name, { expr, env: new Map(), file: true });
  const params = (fn.parameters as Node[]) ?? [];
  const external = fn.visibility === 'external' || fn.visibility === 'public';
  params.forEach((p, i) => {
    if (!p.name) return;
    const arg = args?.nodes[i];
    env.set(p.name, arg && args ? { expr: arg, env: args.env } : external ? 'leaf' : 'opaque');
  });
  walk(fn.body as Node, (node) => {
    if (node.type === 'VariableDeclarationStatement' && node.variables.length === 1 && node.variables[0] && isNode(node.initialValue)) {
      env.set(node.variables[0].name, { expr: node.initialValue, env });
    }
  });
  return env;
}

/** Collects what an expression is built from into out. */
function collect(expr: Node, env: Env, scope: ContractScope, counted: ReadonlySet<string>, out: Binding, depth: number): void {
  if (depth > MAX_DEPTH) {
    out.opaque = true;
    return;
  }
  const recurse = (child: Node, childEnv = env): void => collect(child, childEnv, scope, counted, out, depth + 1);
  switch (expr.type) {
    case 'Identifier': {
      if (expr.name === 'this') out.self = true;
      const slot = env.get(expr.name);
      if (slot === 'opaque') out.opaque = true;
      else if (slot && slot !== 'leaf' && !slot.file) recurse(slot.expr, slot.env);
      else if (counted.has(expr.name)) out.counter = true;
      else if (slot && slot !== 'leaf') recurse(slot.expr, slot.env);
      return;
    }
    case 'MemberAccess':
      if (expr.expression.type === 'Identifier' && expr.expression.name === 'block' && expr.memberName === 'chainid') out.chainid = true;
      else recurse(expr.expression as Node);
      return;
    case 'IndexAccess': {
      const base = baseName(expr);
      if (base && counted.has(base)) out.counter = true;
      if (isNode(expr.index)) recurse(expr.index as Node);
      return;
    }
    case 'FunctionCall': {
      const callee = expr.expression as Node;
      const args = expr.arguments as Node[];
      const local = localCallee(expr, scope);
      if (local) {
        const callEnv = envOf(local, scope, { nodes: args, env });
        let returned = false;
        walk(local.body as Node, (n) => {
          if (n.type === 'ReturnStatement' && isNode(n.expression)) {
            returned = true;
            recurse(n.expression as Node, callEnv);
          }
        });
        if (!returned) out.opaque = true;
        return;
      }
      const builtin =
        isConversion(callee) ||
        (callee.type === 'Identifier' && BUILTINS.has(callee.name)) ||
        (callee.type === 'MemberAccess' &&
          ((callee.expression.type === 'Identifier' && callee.expression.name === 'abi') ||
            (callee.expression.type === 'ElementaryTypeName' && callee.memberName === 'concat')));
      if (!builtin) out.opaque = true;
      args.forEach((a) => recurse(a));
      return;
    }
    default:
      for (const [key, value] of Object.entries(expr)) {
        if (key === 'loc' || key === 'range') continue;
        for (const item of Array.isArray(value) ? value : [value]) if (isNode(item)) recurse(item);
      }
  }
}

/** What the message expression in fn is built from, following locals, parameters and helper functions. */
export function messageBinding(message: Node, fn: Node, scope: ContractScope, counted: ReadonlySet<string>): Binding {
  const out: Binding = { chainid: false, self: false, counter: false, opaque: false };
  collect(message, envOf(fn, scope), scope, counted, out, 0);
  return out;
}
