import { fetchEvmWindow, fetchPqcStatus, type EvmWindow, type PqcStatus } from '@qorechain/sdk';

/**
 * The Native lane as the setup needs it, over the public REST endpoint only: account number and sequence, balance,
 * ML-DSA-87 key status, EVM window, and broadcasting signed bytes. No key passes through here; the caller signs.
 */

export interface LaneAccount {
  accountNumber: bigint;
  sequence: bigint;
}

export interface Included {
  hash: string;
  height: number;
  gasUsed: number;
}

export interface Lane {
  /** Account number and sequence, or undefined when the chain has never seen the address. */
  account(address: string): Promise<LaneAccount | undefined>;
  /** Balance in the base denom. */
  balance(address: string): Promise<bigint>;
  pqcStatus(address: string): Promise<PqcStatus>;
  window(address: string): Promise<EvmWindow>;
  /** Broadcast signed bytes and wait until the tx is in a block. Throws when it is refused or fails. */
  broadcast(txBytes: Uint8Array): Promise<Included>;
}

export type Fetch = typeof fetch;

export interface RestLaneOptions {
  rest: string;
  denom: string;
  waitMs: number;
  pollMs: number;
  fetch?: Fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj => (x && typeof x === 'object' ? (x as Obj) : {});

async function getJson(f: Fetch, url: string): Promise<{ status: number; body: unknown }> {
  const res = await f(url, { headers: { accept: 'application/json' } });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) as unknown };
  } catch {
    return { status: res.status, body: undefined };
  }
}

/** Account number and sequence from the auth module: a plain account, or a type that wraps one as `base_account`. */
export function parseAccount(body: unknown): LaneAccount {
  const account = obj(obj(body).account);
  const base = account.base_account ? obj(account.base_account) : account;
  const num = base.account_number;
  const seq = base.sequence ?? '0';
  if (typeof num !== 'string' || typeof seq !== 'string') throw new Error('account answer has no account_number');
  return { accountNumber: BigInt(num), sequence: BigInt(seq) };
}

function notFound(status: number, body: unknown): boolean {
  const b = obj(body);
  return status === 404 || b.code === 5 || (typeof b.message === 'string' && b.message.includes('not found'));
}

export function restLane(opts: RestLaneOptions): Lane {
  const f = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const base = opts.rest.replace(/\/+$/, '');

  return {
    async account(address) {
      const { status, body } = await getJson(f, `${base}/cosmos/auth/v1beta1/accounts/${address}`);
      if (status === 200) return parseAccount(body);
      if (notFound(status, body)) return undefined;
      throw new Error(`account ${address}: HTTP ${status}`);
    },

    async balance(address) {
      const url = `${base}/cosmos/bank/v1beta1/balances/${address}/by_denom?denom=${encodeURIComponent(opts.denom)}`;
      const { status, body } = await getJson(f, url);
      if (status !== 200) throw new Error(`balance ${address}: HTTP ${status}`);
      const amount = obj(obj(body).balance).amount;
      if (amount === undefined) return 0n;
      if (typeof amount !== 'string' || !/^\d+$/.test(amount)) throw new Error(`balance ${address}: unreadable amount`);
      return BigInt(amount);
    },

    pqcStatus(address) {
      return fetchPqcStatus({ rest: base, address, fetch: f as never });
    },

    window(address) {
      return fetchEvmWindow({ rest: base, address, fetch: f as never });
    },

    async broadcast(txBytes) {
      const res = await f(`${base}/cosmos/tx/v1beta1/txs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tx_bytes: Buffer.from(txBytes).toString('base64'), mode: 'BROADCAST_MODE_SYNC' }),
      });
      const sent = obj(obj(await res.json().catch(() => undefined)).tx_response);
      const hash = sent.txhash;
      if (!res.ok || typeof hash !== 'string') throw new Error(`broadcast: HTTP ${res.status}`);
      if (sent.code !== 0) throw new Error(`broadcast refused ${hash}: code ${String(sent.code)} ${String(sent.raw_log ?? '')}`);

      const deadline = now() + opts.waitMs;
      for (;;) {
        const { status, body } = await getJson(f, `${base}/cosmos/tx/v1beta1/txs/${hash}`);
        if (status === 200) {
          const r = obj(obj(body).tx_response);
          if (r.code !== 0) throw new Error(`tx ${hash} failed: code ${String(r.code)} ${String(r.raw_log ?? '')}`);
          return { hash, height: Number(r.height), gasUsed: Number(r.gas_used) };
        }
        // An unknown hash answers 404 or 400 on some nodes until the tx is indexed.
        if (!notFound(status, body) && status !== 400) throw new Error(`tx ${hash}: HTTP ${status}`);
        if (now() >= deadline) throw new Error(`tx ${hash} not in a block after ${opts.waitMs} ms`);
        await sleep(opts.pollMs);
      }
    },
  };
}
