import { literalValue, qorechain } from './qorechain.js';
import type { Rule } from './types.js';

/** S001: a QoreChain precompile address written with upper-case hex digits. */
export const s001: Rule = {
  id: 'S001',
  create: (context) => ({
    NumberLiteral(node) {
      const text = node.number;
      // Address-shaped literals only: 40 hex digits. Short numbers are not addresses.
      if (!/^0x[0-9a-fA-F]{40}$/.test(text) || !/[A-F]/.test(text)) return;
      const value = literalValue(text);
      const name = value === undefined ? undefined : qorechain.precompiles.get(value);
      if (name) context.report(node, `It points at ${name}.`);
    },
  }),
};
