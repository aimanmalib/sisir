import { walk, type Node } from './ast.js';
import { asLowLevelCall, payloadFunction } from './calls.js';
import { contractRule } from './contract-rule.js';
import { counters, messageBinding } from './message.js';

const FN = 'pqcVerify';
/** Position of the message among pqcVerify(pubkey, signature, message). */
const MESSAGE = 2;

/** The message argument of a pqcVerify call, typed or encoded into a low-level payload. */
function messageOf(node: Node): Node | undefined {
  if (node.type !== 'FunctionCall') return undefined;
  const callee = node.expression as Node;
  if (callee.type === 'MemberAccess' && callee.memberName === FN) return node.arguments[MESSAGE] as Node | undefined;
  const call = asLowLevelCall(node);
  if (!call || payloadFunction(call.payload) !== FN) return undefined;
  const payload = call.payload as Node;
  const kind = (payload.expression as Node).memberName as string;
  if (kind === 'encodeCall') {
    const tuple = payload.arguments[1] as Node | undefined;
    return tuple?.type === 'TupleExpression' ? (tuple.components[MESSAGE] as Node | undefined) : undefined;
  }
  return payload.arguments[MESSAGE + 1] as Node | undefined;
}

/** S007: the message checked by pqcVerify leaves out the chain id, the contract address or a changing counter. */
export const s007 = contractRule('S007', (scope) => {
  const counted = counters(scope);
  for (const fn of scope.functions) {
    walk(fn.body as Node, (node) => {
      const message = messageOf(node);
      if (!message) return;
      const bound = messageBinding(message, fn, scope, counted);
      if (bound.opaque) return;
      // Keys into the catalog terms of S007, so the list can be rendered in any language.
      const parts = [
        bound.chainid ? undefined : 'chainid',
        bound.self ? undefined : 'self',
        bound.counter ? undefined : 'counter',
      ].filter((x): x is string => x !== undefined);
      if (parts.length) scope.report(node, { key: 'leavesOut', values: { parts } });
    });
  }
});
