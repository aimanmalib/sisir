import { deriveUnifiedAccount, generateMnemonic, MSG_SEND_TYPE_URL, verifyProofOfPossession, type PqcStatus } from '@qorechain/sdk';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig, type Role } from '../src/config.js';
import { emptyEvidence, type Evidence } from '../src/evidence.js';
import type { Lane } from '../src/lane.js';
import { actorFrom, fundOnce, readStatus, registerProjectKey, type Actor, type Ctx, type SignRequest } from '../src/setup.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const { testnet, chain } = loadConfig(root);
const QOR = 1_000_000n;

/** An in-memory Native lane. It refuses a classical tx that is not a key registration, and a hybrid tx from an account with no key. */
class FakeLane implements Lane {
  balances = new Map<string, bigint>();
  keys = new Map<string, PqcStatus>();
  sent: { from: string; req: SignRequest }[] = [];
  height = 100;

  account = async (a: string) => (this.balances.has(a) ? { accountNumber: 1n, sequence: BigInt(this.sent.length) } : undefined);
  balance = async (a: string) => this.balances.get(a) ?? 0n;
  pqcStatus = async (a: string) => this.keys.get(a) ?? { registered: false };
  window = async () => ({ live: false }) as Awaited<ReturnType<Lane['window']>>;
  broadcast = async (bytes: Uint8Array) => {
    const { from, req } = JSON.parse(new TextDecoder().decode(bytes)) as { from: string; req: SignRequest };
    const register = req.messages.every((m) => m.typeUrl.includes('MsgRegisterPQCKey'));
    if (req.classical && !register) throw new Error('classical tx refused');
    if (!req.classical && !this.keys.get(from)?.registered) throw new Error('hybrid tx from an account with no key');
    this.sent.push({ from, req });
    if (register) this.keys.set(from, { registered: true, possessionProven: true });
    return { hash: `TX${this.sent.length}`, height: ++this.height, gasUsed: 1 };
  };
}

/** An actor whose "signature" is its request as JSON, so the fake lane can read it back. */
function stubActor(role: Role, cosmos: string): Actor {
  return {
    role,
    cosmos,
    evm: `0x${cosmos.padStart(40, '0')}`,
    ecdsaPubkey: new Uint8Array(33),
    pqc: { publicKey: new Uint8Array(2592), secretKey: new Uint8Array(4896) },
    sign: (req) => new TextEncoder().encode(JSON.stringify({ from: cosmos, req }, (_, v) => (typeof v === 'bigint' ? v.toString() : v))),
    signEvm: async () => {
      throw new Error('the account setup never signs an EVM transaction');
    },
  };
}

const funder = stubActor('funder', 'f0');
const project = stubActor('project', 'p10');
const keyless = stubActor('keyless', 'k11');

function setup(): { lane: FakeLane; ctx: Ctx; ev: Evidence; logs: string[] } {
  const lane = new FakeLane();
  const logs: string[] = [];
  lane.balances.set(funder.cosmos, 100n * QOR);
  lane.keys.set(funder.cosmos, { registered: true, possessionProven: true });
  return { lane, ctx: { lane, chainId: chain.nativeId, config: testnet, log: (l) => logs.push(l) }, ev: emptyEvidence(chain.nativeId), logs };
}

describe('fundOnce', () => {
  it('sends the configured amount from the funder to the project in one hybrid tx and records it', async () => {
    const { lane, ctx, ev } = setup();
    expect(await fundOnce(ctx, ev, funder, project)).toBe(true);
    expect(lane.sent).toHaveLength(1);
    const { from, req } = lane.sent[0]!;
    expect(from).toBe(funder.cosmos);
    expect(req.classical).toBe(false);
    expect(req.messages).toEqual([
      { typeUrl: MSG_SEND_TYPE_URL, value: { fromAddress: 'f0', toAddress: 'p10', amount: [{ denom: testnet.denom, amount: String(5n * QOR) }] } },
    ]);
    expect(ev.funding).toMatchObject({ tx: 'TX1', from: 'f0', to: 'p10', amount: String(5n * QOR) });
  });

  it('never sends a second time once the evidence records a transfer', async () => {
    const { lane, ctx, ev } = setup();
    await fundOnce(ctx, ev, funder, project);
    await expect(fundOnce(ctx, ev, funder, project)).rejects.toThrow(/already funded once \(TX1\)/);
    expect(lane.sent).toHaveLength(1);
  });

  it('does nothing while the project holds the configured floor', async () => {
    const { lane, ctx, ev, logs } = setup();
    lane.balances.set(project.cosmos, 3n * QOR);
    expect(await fundOnce(ctx, ev, funder, project)).toBe(false);
    expect(lane.sent).toHaveLength(0);
    expect(logs.join('\n')).toMatch(/project holds 3 QOR/);
  });

  it("waits for the funder's own project to register its key, and never registers it", async () => {
    for (const status of [{ registered: false }, { registered: true, possessionProven: false }]) {
      const { lane, ctx, ev } = setup();
      lane.keys.set(funder.cosmos, status);
      await expect(fundOnce(ctx, ev, funder, project)).rejects.toThrow(/no proven ML-DSA-87 key/);
      expect(lane.sent).toHaveLength(0);
      expect(ev.funding).toBeUndefined();
    }
  });

  it('waits while the funder holds less than the configured minimum', async () => {
    const { lane, ctx, ev } = setup();
    lane.balances.set(funder.cosmos, 15n * QOR - 1n);
    await expect(fundOnce(ctx, ev, funder, project)).rejects.toThrow(/waits until it holds 15/);
    lane.balances.set(funder.cosmos, 15n * QOR);
    expect(await fundOnce(ctx, ev, funder, project)).toBe(true);
  });
});

describe('registerProjectKey', () => {
  it('registers the key classically with a proof, then reads it back proven', async () => {
    const { lane, ctx, ev } = setup();
    lane.balances.set(project.cosmos, 5n * QOR);
    const real = { ...project, pqc: (await deriveUnifiedAccount(generateMnemonic(256), 10)).pqc, ecdsaPubkey: new Uint8Array(0) };
    expect(await registerProjectKey(ctx, ev, real)).toBe(true);
    expect(lane.sent).toHaveLength(1);
    expect(lane.sent[0]!.req.classical).toBe(true);
    expect(ev.keys.project).toEqual({ tx: 'TX1', height: 101, gasUsed: 1 });
    expect(await registerProjectKey(ctx, ev, real)).toBe(false);
    expect(lane.sent).toHaveLength(1);
  });

  it('never gives the keyless account a key', async () => {
    const { lane, ctx, ev } = setup();
    lane.balances.set(keyless.cosmos, QOR);
    await expect(registerProjectKey(ctx, ev, keyless)).rejects.toThrow(/stays without one/);
    expect(lane.sent).toHaveLength(0);
  });

  it('stops on another key or an unproven key, before paying a fee', async () => {
    const { lane, ctx, ev } = setup();
    lane.balances.set(project.cosmos, 5n * QOR);
    lane.keys.set(project.cosmos, { registered: true, pubkey: new Uint8Array(2592).fill(7) });
    await expect(registerProjectKey(ctx, ev, project)).rejects.toThrow(/another ML-DSA-87 key/);
    lane.keys.set(project.cosmos, { registered: true, possessionProven: false });
    await expect(registerProjectKey(ctx, ev, project)).rejects.toThrow(/without proof of possession/);
    expect(lane.sent).toHaveLength(0);
  });

  it('needs funds on the project account first', async () => {
    const { ctx, ev } = setup();
    await expect(registerProjectKey(ctx, ev, { ...project, ecdsaPubkey: new Uint8Array(0) })).rejects.toThrow(/not on chain yet/);
  });
});

describe('readStatus', () => {
  it('reports balance, key and window per role', async () => {
    const { lane, ctx } = setup();
    lane.balances.set(project.cosmos, 2n);
    const rows = await readStatus(ctx, [funder, project, keyless]);
    expect(rows.map((r) => [r.role, r.balance, r.key, r.windowLive])).toEqual([
      ['funder', 100n * QOR, 'proven', false],
      ['project', 2n, 'none', false],
      ['keyless', 0n, 'none', false],
    ]);
  });
});

describe('actorFrom (SDK signer, offline)', () => {
  let actor: Actor;
  beforeAll(async () => {
    actor = actorFrom('project', await deriveUnifiedAccount(generateMnemonic(256), 10), chain.nativeId, 'v2');
  });

  it('derives the account at the configured index with a key the chain will accept as its own', async () => {
    expect(actor.cosmos).toMatch(/^qor1/);
    expect(actor.evm).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(actor.ecdsaPubkey).toHaveLength(33);
    const { signProofOfPossession, validateClassicalKeyForSender } = await import('@qorechain/sdk');
    expect(validateClassicalKeyForSender(actor.cosmos, actor.ecdsaPubkey)).toBe('eth');
    const proof = signProofOfPossession({ chainId: chain.nativeId, account: actor.cosmos, keypair: actor.pqc });
    expect(verifyProofOfPossession({ chainId: chain.nativeId, account: actor.cosmos, publicKey: actor.pqc.publicKey, proof })).toBe(true);
  });

  it('signs hybrid with an ML-DSA-87 layer and classical without one', () => {
    const req = {
      messages: [{ typeUrl: MSG_SEND_TYPE_URL, value: { fromAddress: actor.cosmos, toAddress: actor.cosmos, amount: [{ denom: 'uqor', amount: '1' }] } }],
      fee: { amount: [{ denom: 'uqor', amount: '60000' }], gas: '400000' },
      accountNumber: 1n,
      sequence: 0n,
    };
    const hybrid = actor.sign({ ...req, classical: false });
    const classical = actor.sign({ ...req, classical: true });
    // An ML-DSA-87 signature is 4,627 bytes; the hybrid tx carries one, the classical tx does not.
    expect(hybrid.length - classical.length).toBeGreaterThan(4627);
  });
});
