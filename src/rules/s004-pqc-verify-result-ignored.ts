import { walk, type Node } from './ast.js';
import { asLowLevelCall, callsPrecompile, destinationOf, readSlot } from './calls.js';
import { bodyRule } from './body-rule.js';

const FN = 'pqcVerify';

/** S004: the result of pqcVerify is discarded or never read. */
export const s004 = bodyRule('S004', ({ body, bindings, parentOf, report }) => {
  walk(body, (node) => {
    if (node.type !== 'FunctionCall') return;
    const parent = parentOf.get(node);
    const callee = node.expression as Node;
    if (callee.type === 'MemberAccess' && callee.memberName === FN) {
      if (parent?.type === 'ExpressionStatement') return report(node, { key: 'discarded' });
      const dest = destinationOf(node, parent);
      if (dest?.slots.length === 1 && readSlot(body, dest, 0) === undefined) report(node, { key: 'storedUnread' });
      return;
    }
    const call = asLowLevelCall(node);
    if (!call || !callsPrecompile(call, FN, bindings)) return;
    const dest = destinationOf(node, parent);
    if (parent?.type === 'ExpressionStatement' || !dest || readSlot(body, dest, 1) === undefined) {
      report(node, { key: 'statusOnly' });
    }
  });
});
