import { createPublicClient, http, type Hex } from 'viem';

/**
 * The EVM lane as the ledger steps need it, over the public JSON-RPC endpoint only. Signing happens in the actor;
 * this module only reads and sends signed bytes.
 */

export interface EvmReceipt {
  hash: Hex;
  success: boolean;
  blockNumber: bigint;
  gasUsed: bigint;
  contractAddress?: Hex;
  logs: { address: Hex; topics: Hex[]; data: Hex }[];
}

/** The result of a read-only call: the return data, or the revert data when it reverted. */
export type CallResult = { ok: true; data: Hex } | { ok: false; data: Hex; message: string };

export interface EvmLane {
  /** The account's next nonce, counted from pending transactions. */
  nonce(address: Hex): Promise<number>;
  blockNumber(): Promise<bigint>;
  code(address: Hex): Promise<Hex>;
  call(tx: { from: Hex; to: Hex; data: Hex }): Promise<CallResult>;
  /** Send signed bytes and wait for the receipt. Throws when the node refuses them or no receipt comes in time. */
  sendAndWait(raw: Hex): Promise<EvmReceipt>;
}

/** Revert data from a viem error chain, when the node returned any. */
export function revertData(err: unknown): Hex | undefined {
  for (let e = err as { data?: unknown; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (typeof e.data === 'string' && /^0x[0-9a-fA-F]*$/.test(e.data)) return e.data as Hex;
    if (e.data && typeof e.data === 'object' && typeof (e.data as { data?: unknown }).data === 'string')
      return (e.data as { data: Hex }).data;
  }
  return undefined;
}

export function viemLane(opts: { rpc: string; chainId: number; waitMs: number; pollMs: number }): EvmLane {
  const client = createPublicClient({
    chain: {
      id: opts.chainId,
      name: 'QoreChain',
      nativeCurrency: { name: 'QOR', symbol: 'QOR', decimals: 18 },
      rpcUrls: { default: { http: [opts.rpc] } },
    },
    transport: http(opts.rpc, { timeout: 30_000 }),
  });
  return {
    nonce: (address) => client.getTransactionCount({ address, blockTag: 'pending' }),
    blockNumber: () => client.getBlockNumber({ cacheTime: 0 }),
    code: async (address) => (await client.getCode({ address })) ?? '0x',
    async call(tx) {
      try {
        const r = await client.call({ account: tx.from, to: tx.to, data: tx.data });
        return { ok: true, data: r.data ?? '0x' };
      } catch (err) {
        const data = revertData(err);
        if (data === undefined) throw err;
        return { ok: false, data, message: err instanceof Error ? err.message.split('\n')[0]! : String(err) };
      }
    },
    async sendAndWait(raw) {
      const hash = await client.sendRawTransaction({ serializedTransaction: raw });
      const r = await client.waitForTransactionReceipt({ hash, timeout: opts.waitMs, pollingInterval: opts.pollMs });
      return {
        hash,
        success: r.status === 'success',
        blockNumber: r.blockNumber,
        gasUsed: r.gasUsed,
        contractAddress: r.contractAddress ?? undefined,
        logs: r.logs.map((l) => ({ address: l.address, topics: [...l.topics] as Hex[], data: l.data })),
      };
    },
  };
}
