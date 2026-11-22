import { walk, type Node } from './ast.js';
import { asLowLevelCall, callsPrecompile, destinationOf, readSlot, type Destination } from './calls.js';
import { bodyRule } from './body-rule.js';
import { qorechain } from './qorechain.js';

const FN = 'pqcKeyStatus';
const [REGISTERED, , , PROVEN] = qorechain.pqcKeyStatusFields;
const GUARDS: readonly [number, string | undefined][] = [
  [0, REGISTERED],
  [3, PROVEN],
];

/** Names the fields of a pqcKeyStatus result that are never read. */
function missing(body: Node, dest: Destination): string | undefined {
  const unread = GUARDS.filter(([i]) => readSlot(body, dest, i) === undefined).map(([, field]) => field);
  return unread.length ? `${unread.join(' and ')} ${unread.length > 1 ? 'are' : 'is'} never read.` : undefined;
}

/** abi.decode(data, (...)) calls under body that decode the given variable. */
function decodesOf(body: Node, data: string): Node[] {
  const out: Node[] = [];
  walk(body, (node) => {
    if (node.type !== 'FunctionCall') return;
    const callee = node.expression as Node;
    const first = node.arguments[0] as Node | undefined;
    if (callee.type === 'MemberAccess' && callee.memberName === 'decode' && callee.expression.name === 'abi' && first?.type === 'Identifier' && first.name === data) {
      out.push(node);
    }
  });
  return out;
}

/** S003: a pqcKeyStatus result is used without reading both registered and possessionProven. */
export const s003 = bodyRule('S003', ({ body, bindings, parentOf, report }) => {
  walk(body, (node) => {
    if (node.type !== 'FunctionCall') return;
    const callee = node.expression as Node;
    if (callee.type === 'MemberAccess' && callee.memberName === FN) {
      const dest = destinationOf(node, parentOf.get(node));
      const detail = dest && missing(body, dest);
      if (detail) report(node, detail);
      return;
    }
    const call = asLowLevelCall(node);
    if (!call || !callsPrecompile(call, FN, bindings)) return;
    const data = destinationOf(node, parentOf.get(node))?.slots[1];
    if (data === undefined) return;
    for (const decode of decodesOf(body, data)) {
      const types = decode.arguments[1] as Node | undefined;
      const count = types?.type === 'TupleExpression' ? types.components.length : 1;
      const dest = destinationOf(decode, parentOf.get(decode));
      if (count < 4) report(decode, `It decodes ${count} of the 4 return values, so ${PROVEN} is never read.`);
      else if (dest) {
        const detail = missing(body, dest);
        if (detail) report(decode, detail);
      }
    }
  });
});
