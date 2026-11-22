import { bodyBindings, isConversion, isNode, parents, resolvePrecompile, walk, type Node } from './ast.js';
import { asLowLevelCall, asMemberCall, payloadFunction } from './calls.js';
import { contractRule, localCallee, reaching, type ContractScope } from './contract-rule.js';
import { BRIDGE, qorechain } from './qorechain.js';

/** string.concat, bytes.concat or abi.encodePacked. */
function isConcat(node: Node): boolean {
  if (node.type !== 'FunctionCall') return false;
  const callee = node.expression as Node;
  if (callee.type !== 'MemberAccess') return false;
  const owner = callee.expression as Node;
  if (callee.memberName === 'concat') return owner.type === 'ElementaryTypeName' && (owner.name === 'string' || owner.name === 'bytes');
  return callee.memberName === 'encodePacked' && owner.type === 'Identifier' && owner.name === 'abi';
}

/** True when body calls the bridge directly, by address or by the function it encodes. */
function callsBridge(body: Node, bindings: ReadonlyMap<string, Node>): boolean {
  let found = false;
  walk(body, (node) => {
    const call = asMemberCall(node);
    if (!call) return;
    const low = asLowLevelCall(node);
    if (resolvePrecompile(call.target, bindings) === BRIDGE || (low && payloadFunction(low.payload) === qorechain.bridgeFunction)) {
      found = true;
    }
  });
  return found;
}

/** Name of a parameter used as an argument, directly or through a conversion such as bytes(note). */
function argName(arg: Node): string | undefined {
  if (arg.type === 'Identifier') return arg.name as string;
  if (arg.type === 'FunctionCall' && isConversion(arg.expression as Node) && arg.arguments.length === 1) return argName(arg.arguments[0] as Node);
  return undefined;
}

/** Names of the string and bytes parameters of a function. */
function textParams(fn: Node): Set<string> {
  const out = new Set<string>();
  for (const p of (fn.parameters as Node[]) ?? []) {
    const t = p.typeName as Node | null;
    if (p.name && t?.type === 'ElementaryTypeName' && (t.name === 'string' || t.name === 'bytes')) out.add(p.name as string);
  }
  return out;
}

const CONDITION: Record<string, string> = {
  IfStatement: 'condition',
  WhileStatement: 'condition',
  DoWhileStatement: 'condition',
  ForStatement: 'conditionExpression',
  Conditional: 'condition',
};

/**
 * True when a read of the parameter checks it: it sits in a condition, or is passed to a call that does not
 * lead to the bridge, such as require(...) or a helper like _checkNote(bytes(note)).
 */
function isCheck(read: Node, parentOf: ReadonlyMap<Node, Node>, scope: ContractScope, bridged: ReadonlySet<Node>): boolean {
  let child = read;
  let up = parentOf.get(child);
  while (up) {
    if (CONDITION[up.type] && up[CONDITION[up.type] as string] === child) return true;
    if (up.type === 'FunctionCall' && up.expression !== child && !isConversion(up.expression as Node)) {
      const callee = up.expression as Node;
      if (isConcat(up) || (callee.type === 'MemberAccess' && callee.expression?.name === 'abi')) return false;
      const local = localCallee(up, scope);
      return local ? !bridged.has(local) : callee.type === 'Identifier' || callee.type === 'MemberAccess';
    }
    child = up;
    up = parentOf.get(child);
  }
  return false;
}

/** True when the function checks the parameter anywhere outside concatenations and events. */
function isValidated(body: Node, name: string, scope: ContractScope, bridged: ReadonlySet<Node>): boolean {
  const parentOf = parents(body);
  let found = false;
  const visit = (node: Node): void => {
    if (found || isConcat(node) || node.type === 'EmitStatement') return;
    if (node.type === 'Identifier' && node.name === name && isCheck(node, parentOf, scope, bridged)) found = true;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'range') continue;
      for (const item of Array.isArray(value) ? value : [value]) if (isNode(item)) visit(item);
    }
  };
  visit(body);
  return found;
}

/** S006: a bridge payload is built by concatenating a string or bytes parameter that the function never checks. */
export const s006 = contractRule('S006', (scope) => {
  const bridged = reaching(scope, (fn) => callsBridge(fn.body as Node, bodyBindings(fn.body as Node, scope.file)));
  for (const fn of bridged) {
    const params = textParams(fn);
    if (params.size === 0) continue;
    const body = fn.body as Node;
    walk(body, (node) => {
      if (!isConcat(node) || !(node.arguments as Node[]).some((a) => a.type === 'StringLiteral')) return;
      for (const arg of node.arguments as Node[]) {
        const name = argName(arg);
        if (name && params.has(name) && !isValidated(body, name, scope, bridged)) {
          scope.report(node, { key: 'unchecked', values: { name } });
        }
      }
    });
  }
});
