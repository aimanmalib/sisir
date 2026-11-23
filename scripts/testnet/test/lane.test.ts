import { describe, expect, it } from 'vitest';
import { parseAccount, restLane, type Fetch } from '../src/lane.js';

type Route = (url: string, init?: RequestInit) => { status: number; body: unknown } | undefined;

function fakeFetch(...routes: Route[]): { f: Fetch; calls: string[] } {
  const calls: string[] = [];
  const f = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    for (const r of routes) {
      const hit = r(url, init);
      if (hit) return new Response(JSON.stringify(hit.body), { status: hit.status });
    }
    return new Response('{"code":5,"message":"not found"}', { status: 404 });
  }) as Fetch;
  return { f, calls };
}

const lane = (f: Fetch, now = () => 0) =>
  restLane({ rest: 'https://rest.test/', denom: 'uqor', waitMs: 1000, pollMs: 1, fetch: f, sleep: async () => {}, now });

describe('parseAccount', () => {
  it('reads a plain account and one that wraps base_account', () => {
    expect(parseAccount({ account: { account_number: '7', sequence: '3' } })).toEqual({ accountNumber: 7n, sequence: 3n });
    expect(parseAccount({ account: { base_account: { account_number: '9' } } })).toEqual({ accountNumber: 9n, sequence: 0n });
    expect(() => parseAccount({ account: {} })).toThrow(/account_number/);
  });
});

describe('restLane', () => {
  it('reads an unknown account as undefined and other errors as failures', async () => {
    expect(await lane(fakeFetch().f).account('qor1x')).toBeUndefined();
    const broken = fakeFetch((u) => (u.includes('/accounts/') ? { status: 500, body: {} } : undefined));
    await expect(lane(broken.f).account('qor1x')).rejects.toThrow(/HTTP 500/);
  });

  it('reads the balance in the base denom, and no entry as zero', async () => {
    const some = fakeFetch((u) => (u.includes('/balances/') ? { status: 200, body: { balance: { denom: 'uqor', amount: '5000000' } } } : undefined));
    expect(await lane(some.f).balance('qor1x')).toBe(5_000_000n);
    expect(some.calls[0]).toBe('GET https://rest.test/cosmos/bank/v1beta1/balances/qor1x/by_denom?denom=uqor');
    const none = fakeFetch((u) => (u.includes('/balances/') ? { status: 200, body: {} } : undefined));
    expect(await lane(none.f).balance('qor1x')).toBe(0n);
    const odd = fakeFetch((u) => (u.includes('/balances/') ? { status: 200, body: { balance: { amount: '-1' } } } : undefined));
    await expect(lane(odd.f).balance('qor1x')).rejects.toThrow(/unreadable/);
  });

  it('broadcasts in sync mode and waits until the tx is in a block', async () => {
    let polls = 0;
    const { f, calls } = fakeFetch(
      (u, init) => (init?.method === 'POST' ? { status: 200, body: { tx_response: { txhash: 'AB', code: 0 } } } : undefined),
      (u) => {
        if (!u.endsWith('/txs/AB')) return undefined;
        polls += 1;
        return polls < 3 ? { status: 404, body: {} } : { status: 200, body: { tx_response: { code: 0, height: '12', gas_used: '300' } } };
      },
    );
    expect(await lane(f).broadcast(new Uint8Array([1, 2]))).toEqual({ hash: 'AB', height: 12, gasUsed: 300 });
    expect(calls[0]).toBe('POST https://rest.test/cosmos/tx/v1beta1/txs');
    expect(polls).toBe(3);
  });

  it('throws on a refused broadcast, a failed tx, and a tx that never lands', async () => {
    const refused = fakeFetch(() => ({ status: 200, body: { tx_response: { txhash: 'AB', code: 13, raw_log: 'insufficient fee' } } }));
    await expect(lane(refused.f).broadcast(new Uint8Array())).rejects.toThrow(/refused AB: code 13 insufficient fee/);
    const failed = fakeFetch(
      (u, i) => (i?.method === 'POST' ? { status: 200, body: { tx_response: { txhash: 'AB', code: 0 } } } : undefined),
      (u) => (u.endsWith('/txs/AB') ? { status: 200, body: { tx_response: { code: 21, raw_log: 'bad signature' } } } : undefined),
    );
    await expect(lane(failed.f).broadcast(new Uint8Array())).rejects.toThrow(/failed: code 21/);
    const lost = fakeFetch((u, i) => (i?.method === 'POST' ? { status: 200, body: { tx_response: { txhash: 'AB', code: 0 } } } : undefined));
    let t = 0;
    await expect(lane(lost.f, () => (t += 400)).broadcast(new Uint8Array())).rejects.toThrow(/not in a block/);
  });
});
