import data from './qorechain.json' with { type: 'json' };

/** QoreChain facts the rules depend on. Addresses live in qorechain.json, not in rule code. */
export interface QoreChainFacts {
  precompiles: ReadonlyMap<bigint, string>;
  pqcKeyStatusFields: readonly string[];
  /** Function the cross-VM bridge precompile (crossVmBridge) exposes. */
  bridgeFunction: string;
}

/** Name of the cross-VM bridge entry in qorechain.json "precompiles". */
export const BRIDGE = 'crossVmBridge';

/** Value of a hex or decimal number literal, or undefined when it is not a plain integer. */
export function literalValue(text: string): bigint | undefined {
  const clean = text.replace(/_/g, '');
  if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(clean)) return undefined;
  return BigInt(clean);
}

export function loadQoreChain(raw: unknown): QoreChainFacts {
  const r = raw as { precompiles?: Record<string, unknown>; pqcKeyStatusFields?: unknown; crossVmBridgeFunction?: unknown };
  if (!r.precompiles || typeof r.precompiles !== 'object') throw new Error('qorechain: "precompiles" must be an object');
  const precompiles = new Map<bigint, string>();
  for (const [name, address] of Object.entries(r.precompiles)) {
    if (typeof address !== 'string' || !/^0x[0-9a-f]{40}$/.test(address)) {
      throw new Error(`qorechain: ${name} must be a lowercase 20-byte address`);
    }
    precompiles.set(BigInt(address), name);
  }
  const fields = r.pqcKeyStatusFields;
  if (!Array.isArray(fields) || fields.length !== 4 || !fields.every((f) => typeof f === 'string')) {
    throw new Error('qorechain: "pqcKeyStatusFields" must list the four return fields');
  }
  if (![...precompiles.values()].includes(BRIDGE)) throw new Error(`qorechain: "precompiles" must list ${BRIDGE}`);
  const bridgeFunction = r.crossVmBridgeFunction;
  if (typeof bridgeFunction !== 'string' || !/^[A-Za-z_]\w*$/.test(bridgeFunction)) {
    throw new Error('qorechain: "crossVmBridgeFunction" must be a function name');
  }
  return { precompiles, pqcKeyStatusFields: fields as string[], bridgeFunction };
}

export const qorechain: QoreChainFacts = loadQoreChain(data);
