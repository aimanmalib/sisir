import { isRead, resolvePrecompile, type Node } from './ast.js';

export type LowLevelKind = 'call' | 'staticcall' | 'delegatecall';
const KINDS = new Set<string>(['call', 'staticcall', 'delegatecall']);

/** A low-level call such as target.staticcall{gas: g}(payload). */
export interface LowLevelCall {
  node: Node;
  kind: LowLevelKind;
  target: Node;
  options: ReadonlyMap<string, Node>;
  payload: Node | undefined;
}

export function asLowLevelCall(node: Node): LowLevelCall | undefined {
  if (node.type !== 'FunctionCall') return undefined;
  let callee = node.expression as Node;
  const options = new Map<string, Node>();
  if (callee.type === 'NameValueExpression') {
    const list = callee.arguments as Node;
    (list.names as string[]).forEach((name, i) => options.set(name, list.arguments[i] as Node));
    callee = callee.expression as Node;
  }
  if (callee.type !== 'MemberAccess' || !KINDS.has(callee.memberName)) return undefined;
  return { node, kind: callee.memberName as LowLevelKind, target: callee.expression as Node, options, payload: node.arguments[0] };
}

/**
 * The function a call payload encodes, read from abi.encodeWithSignature("name(...)"),
 * abi.encodeWithSelector(X.name.selector, ...) or abi.encodeCall(X.name, ...).
 */
export function payloadFunction(payload: Node | undefined): string | undefined {
  if (!payload || payload.type !== 'FunctionCall') return undefined;
  const callee = payload.expression as Node;
  if (callee.type !== 'MemberAccess' || (callee.expression as Node).type !== 'Identifier' || callee.expression.name !== 'abi') {
    return undefined;
  }
  const first = payload.arguments[0] as Node | undefined;
  if (!first) return undefined;
  if (callee.memberName === 'encodeWithSignature' && first.type === 'StringLiteral') {
    return /^([A-Za-z_$][\w$]*)\(/.exec(first.value as string)?.[1];
  }
  if (callee.memberName === 'encodeWithSelector' && first.type === 'MemberAccess' && first.memberName === 'selector') {
    const fn = first.expression as Node;
    return fn.type === 'MemberAccess' ? (fn.memberName as string) : undefined;
  }
  if (callee.memberName === 'encodeCall' && first.type === 'MemberAccess') return first.memberName as string;
  return undefined;
}

/** True when a low-level call reaches the named precompile, by address or by the function it encodes. */
export function callsPrecompile(call: LowLevelCall, name: string, bindings: ReadonlyMap<string, Node>): boolean {
  return resolvePrecompile(call.target, bindings) === name || payloadFunction(call.payload) === name;
}

/** Where the values returned by an expression go: the slots of a declaration or a tuple assignment. */
export interface Destination {
  /** Name in each slot, or undefined for an empty slot. */
  slots: (string | undefined)[];
  /** Nodes that write the names, to skip when looking for reads. */
  writers: Node[];
}

export function destinationOf(expr: Node, parent: Node | undefined): Destination | undefined {
  if (!parent) return undefined;
  if (parent.type === 'VariableDeclarationStatement' && parent.initialValue === expr) {
    const vars = parent.variables as (Node | null)[];
    return { slots: vars.map((v) => (v ? (v.name as string) : undefined)), writers: [] };
  }
  if (parent.type === 'BinaryOperation' && parent.operator === '=' && parent.right === expr) {
    const left = parent.left as Node;
    if (left.type === 'TupleExpression') {
      const slots = (left.components as (Node | null)[]).map((c) => (c && c.type === 'Identifier' ? (c.name as string) : undefined));
      return { slots, writers: [left] };
    }
    if (left.type === 'Identifier') return { slots: [left.name as string], writers: [left] };
  }
  return undefined;
}

/** Name in a slot if it is read again in body; undefined when the slot is empty or never read. */
export function readSlot(body: Node, dest: Destination, index: number): string | undefined {
  const name = dest.slots[index];
  return name !== undefined && isRead(body, name, dest.writers) ? name : undefined;
}

