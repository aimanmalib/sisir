import { resolvePrecompile, walk } from './ast.js';
import { asMemberCall, sentValue } from './calls.js';
import { bodyRule } from './body-rule.js';
import { BRIDGE } from './qorechain.js';

/** S008: value goes to a precompile. Value to the bridge is reported by S005 instead. */
export const s008 = bodyRule('S008', ({ body, bindings, report }) => {
  walk(body, (node) => {
    const call = asMemberCall(node);
    if (!call || !sentValue(call)) return;
    const name = resolvePrecompile(call.target, bindings);
    if (name && name !== BRIDGE) report(node, { key: 'valueTo', values: { name } });
  });
});
