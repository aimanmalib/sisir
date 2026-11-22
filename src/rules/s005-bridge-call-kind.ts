import { resolvePrecompile, walk } from './ast.js';
import { asLowLevelCall, asMemberCall, payloadFunction, sentValue } from './calls.js';
import { bodyRule } from './body-rule.js';
import { BRIDGE, qorechain } from './qorechain.js';

/** S005: the cross-VM bridge is reached with staticcall, delegatecall or value. */
export const s005 = bodyRule('S005', ({ body, bindings, report }) => {
  walk(body, (node) => {
    const call = asMemberCall(node);
    if (!call) return;
    const low = asLowLevelCall(node);
    const toBridge = resolvePrecompile(call.target, bindings) === BRIDGE || (low && payloadFunction(low.payload) === qorechain.bridgeFunction);
    if (!toBridge) return;
    if (low && low.kind !== 'call') return report(node, `It uses ${low.kind}, which the bridge refuses.`);
    if (sentValue(call)) report(node, 'It sends value, which the bridge does not accept.');
  });
});
