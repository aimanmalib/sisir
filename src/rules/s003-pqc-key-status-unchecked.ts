import { walk, type Node } from './ast.js';
import { asLowLevelCall, callsPrecompile, destinationOf, readSlot, type Destination } from './calls.js';
import { bodyRule } from './body-rule.js';
import { qorechain } from './qorechain.js';
import type { DetailRef } from './text.js';
import type { RuleContext } from './types.js';

type Report = RuleContext['report'];

const FN = 'pqcKeyStatus';
const [REGISTERED, , , PROVEN] = qorechain.pqcKeyStatusFields;
const GUARDS: readonly [number, string | undefined][] = [
  [0, REGISTERED],
  [3, PROVEN],
];

/** Names the fields of a pqcKeyStatus result that are never read. */
function missing(body: Node, dest: Destination): DetailRef | undefined {
  const fields = GUARDS.filter(([i]) => readSlot(body, dest, i) === undefined).map(([, field]) => field as string);
  if (!fields.length) return undefined;
  return { key: fields.length > 1 ? 'unreadMany' : 'unreadOne', values: { fields } };
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

/** Number of types an abi.decode call asks for. */
function typeCount(decode: Node): number {
  const types = decode.arguments[1] as Node | undefined;
  return types?.type === 'TupleExpression' ? types.components.length : 1;
}

/**
 * Judges every decode of one answer together: a field counts as read when any decode reads it, so a head-only
 * decode followed by a full one is not flagged. Without a decode that reaches possessionProven, each short decode
 * is reported; otherwise the first full decode carries the unread fields.
 */
function reportDecodes(body: Node, decodes: Node[], parentOf: ReadonlyMap<Node, Node>, report: Report): void {
  const destOf = (d: Node): Destination | undefined => destinationOf(d, parentOf.get(d));
  const short = decodes.filter((d) => typeCount(d) < 4);
  const full = decodes.filter((d) => typeCount(d) >= 4);
  if (!full.length) {
    for (const d of short) report(d, { key: 'decodesFew', values: { count: typeCount(d), field: PROVEN as string } });
    return;
  }
  // A full decode whose values go nowhere we can follow (returned, passed on) is not judged, as before.
  const anchor = full.find((d) => destOf(d) !== undefined);
  if (!anchor) return;
  const read = (i: number): boolean =>
    decodes.some((d) => {
      const dest = typeCount(d) > i ? destOf(d) : undefined;
      return dest !== undefined && readSlot(body, dest, i) !== undefined;
    });
  const fields = GUARDS.filter(([i]) => !read(i)).map(([, field]) => field as string);
  if (fields.length) report(anchor, { key: fields.length > 1 ? 'unreadMany' : 'unreadOne', values: { fields } });
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
    reportDecodes(body, decodesOf(body, data), parentOf, report);
  });
});
