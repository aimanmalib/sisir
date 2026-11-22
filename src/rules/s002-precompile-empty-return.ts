import { isRead, resolvePrecompile, walk, type Node } from './ast.js';
import { asLowLevelCall, destinationOf } from './calls.js';
import { bodyRule } from './body-rule.js';

/** True when body reads name.length anywhere. */
function checksLength(body: Node, name: string): boolean {
  let found = false;
  walk(body, (node) => {
    if (node.type === 'MemberAccess' && node.memberName === 'length' && node.expression.type === 'Identifier' && node.expression.name === name) {
      found = true;
    }
  });
  return found;
}

/** S002: return data of a low-level precompile call is used without a length check. */
export const s002 = bodyRule('S002', ({ body, bindings, parentOf, report }) => {
  walk(body, (node) => {
    const call = asLowLevelCall(node);
    if (!call) return;
    const name = resolvePrecompile(call.target, bindings);
    if (!name) return;
    const dest = destinationOf(node, parentOf.get(node));
    const data = dest?.slots[1];
    if (!dest || data === undefined || !isRead(body, data, dest.writers)) return;
    if (!checksLength(body, data)) report(node, { key: 'callsTo', values: { name } });
  });
});
