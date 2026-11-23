import { deriveUnifiedAccount, generateMnemonic, type EvmWindow } from '@qorechain/sdk';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  keccak256,
  parseTransaction,
  recoverTransactionAddress,
  type Hex,
} from 'viem';
import { afterEach, describe, expect, it } from 'vitest';
import { loadArtifact, setLedgerAddress } from '../src/artifact.js';
import { loadConfig, type Role } from '../src/config.js';
import { emptyEvidence, type Evidence } from '../src/evidence.js';
import type { EvmLane, EvmReceipt } from '../src/evm.js';
import type { Lane } from '../src/lane.js';
import { anchorReport, deployLedger, probeKeyless, windowValue, type Artifact, type Digest, type LedgerCtx } from '../src/ledger.js';
import { actorFrom, type Actor, type EvmTxRequest, type SignRequest } from '../src/setup.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const { testnet, chain } = loadConfig(root);

/** The ledger's ABI as the contract declares it, without a forge build: the parts these tests call. */
const abi = [
  { type: 'function', name: 'anchor', stateMutability: 'nonpayable', inputs: [{ name: 'reportHash', type: 'bytes32' }, { name: 'sourceHash', type: 'bytes32' }, { name: 'findings', type: 'uint16' }], outputs: [{ name: 'id', type: 'uint256' }] },
  { type: 'event', name: 'Anchored', anonymous: false, inputs: [{ name: 'id', type: 'uint256', indexed: true }, { name: 'account', type: 'address', indexed: true }, { name: 'reportHash', type: 'bytes32', indexed: true }, { name: 'sourceHash', type: 'bytes32', indexed: false }, { name: 'findings', type: 'uint16', indexed: false }] },
  { type: 'error', name: 'NotQuantumReady', inputs: [{ name: 'account', type: 'address' }] },
  { type: 'error', name: 'EmptyReportHash', inputs: [] },
] as const;
const artifact: Artifact = { abi: abi as never, bytecode: '0x6080604052' };
const LEDGER: Hex = '0x00000000000000000000000000000000000c0ffe';
const RUNTIME: Hex = '0x60806040';

type Win = EvmWindow & { targets: string[] };

/**
 * One in-memory chain for both lanes. The Native lane takes hybrid MsgOpenEVMWindow only. The EVM lane admits a
 * transaction only through a live window, refuses a creation or a recipient outside a scoped window, and plays
 * SisirLedger: `anchor` reverts with NotQuantumReady for an account without a proven key.
 */
class FakeChain {
  windows = new Map<string, Win>();
  ready = new Set<string>();
  code = new Map<string, Hex>();
  nativeTxs: SignRequest[] = [];
  evmTxs: (EvmTxRequest & { from: string })[] = [];
  height = 500n;
  anchors = 0n;
  /** Make the next anchor transaction revert on chain even though the call passed. */
  revertNext = false;

  lane: Lane = {
    account: async () => ({ accountNumber: 7n, sequence: BigInt(this.nativeTxs.length) }),
    balance: async () => 5_000_000n,
    pqcStatus: async () => ({ registered: true, possessionProven: true }),
    window: async (a) => this.windows.get(a) ?? ({ found: false, live: false } as Win),
    broadcast: async (bytes) => {
      const { from, req } = JSON.parse(new TextDecoder().decode(bytes)) as { from: string; req: SignRequest };
      if (req.classical) throw new Error('only the key registration is classical');
      const [m] = req.messages as { typeUrl: string; value: { maxTxs: string; allowedTargets: string[] } }[];
      if (!m?.typeUrl.endsWith('MsgOpenEVMWindow')) throw new Error(`unexpected ${m?.typeUrl}`);
      this.nativeTxs.push(req);
      const w = { found: true, live: true, remainingTxs: BigInt(m.value.maxTxs), remainingBlocks: 600n, targets: m.value.allowedTargets };
      this.windows.set(from, w as Win);
      return { hash: `WIN${this.nativeTxs.length}`, height: Number(++this.height), gasUsed: 1 };
    },
  };

  evm: EvmLane = {
    nonce: async (a) => this.nativeTxs.length + this.evmTxs.filter((t) => t.from === a).length,
    blockNumber: async () => this.height,
    code: async (a) => this.code.get(a.toLowerCase()) ?? '0x',
    call: async ({ from, data }) => {
      const { args } = decodeFunctionData({ abi, data });
      if (args[0] === `0x${'0'.repeat(64)}`) return { ok: false, data: encodeErrorResult({ abi, errorName: 'EmptyReportHash' }), message: 'reverted' };
      if (!this.ready.has(from.toLowerCase()))
        return { ok: false, data: encodeErrorResult({ abi, errorName: 'NotQuantumReady', args: [from] }), message: 'reverted' };
      return { ok: true, data: encodeAbiParameters([{ type: 'uint256' }], [this.anchors]) };
    },
    sendAndWait: async (raw) => {
      const { from, tx } = JSON.parse(Buffer.from(raw.slice(2), 'hex').toString()) as { from: string; tx: EvmTxRequest };
      const w = [...this.windows.entries()].find(([, v]) => v.live)?.[1];
      if (!w) throw new Error('no window');
      if (w.targets.length > 0 && (!tx.to || !w.targets.includes(tx.to))) throw new Error('outside the window scope');
      w.live = false;
      this.evmTxs.push({ ...tx, from });
      const hash = keccak256(raw);
      const base: EvmReceipt = { hash, success: true, blockNumber: ++this.height, gasUsed: 123n, logs: [] };
      if (!tx.to) {
        this.code.set(LEDGER, RUNTIME);
        return { ...base, contractAddress: LEDGER };
      }
      if (this.revertNext) return { ...base, success: false };
      const { args } = decodeFunctionData({ abi, data: tx.data });
      const topics = encodeEventTopics({ abi, eventName: 'Anchored', args: { id: this.anchors, account: from as Hex, reportHash: args[0] } });
      const data = encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint16' }], [args[1], args[2]]);
      this.anchors++;
      return { ...base, logs: [{ address: LEDGER, topics: topics as Hex[], data }] };
    },
  };
}

/** An actor whose signatures are its requests as JSON, so the fake chain can read them back. */
function stubActor(role: Role, cosmos: string, evm: Hex): Actor {
  const json = (x: unknown) => JSON.stringify(x, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
  return {
    role,
    cosmos,
    evm,
    ecdsaPubkey: new Uint8Array(33),
    pqc: { publicKey: new Uint8Array(2592), secretKey: new Uint8Array(4896) },
    sign: (req) => new TextEncoder().encode(json({ from: cosmos, req })),
    signEvm: async (tx) => `0x${Buffer.from(json({ from: evm, tx })).toString('hex')}`,
  };
}

const project = stubActor('project', 'qor1project', '0x00000000000000000000000000000000000000aa');
const keyless = stubActor('keyless', 'qor1keyless', '0x00000000000000000000000000000000000000bb');
const digest: Digest = { reportHash: `0x${'11'.repeat(32)}`, sourceHash: `0x${'22'.repeat(32)}`, findings: 4, files: ['a.sol', 'b.sol'] };

function setup(ledger = ''): { fake: FakeChain; ctx: LedgerCtx; ev: Evidence } {
  const fake = new FakeChain();
  fake.ready.add(project.evm.toLowerCase());
  const ctx: LedgerCtx = { lane: fake.lane, evm: fake.evm, chainId: chain.nativeId, config: testnet, chain: { ...chain, ledger }, log: () => {} };
  return { fake, ctx, ev: emptyEvidence(chain.nativeId) };
}

describe('windowValue', () => {
  it('converts gas × fee cap from wei to uqor, rounding up, per transaction', () => {
    expect(windowValue(21_000n, 112_500_000_000n, 1)).toBe(2_363n);
    expect(windowValue(1n, 1n, 3)).toBe(3n);
  });
});

describe('deployLedger', () => {
  it('opens a one-transaction unscoped window, deploys at the nonce after it, and records both', async () => {
    const { fake, ctx, ev } = setup();
    expect(await deployLedger(ctx, ev, project, artifact)).toBe(LEDGER);
    const win = fake.nativeTxs[0]!.messages[0]!.value as { maxTxs: string; maxValue: string; allowedTargets: string[] };
    expect(win.maxTxs).toBe('1');
    expect(win.allowedTargets).toEqual([]);
    expect(win.maxValue).toBe(windowValue(BigInt(testnet.ledger.deployGas), BigInt(chain.anchor.maxFeePerGasWei), 1).toString());
    const tx = fake.evmTxs[0]!;
    expect(tx).toMatchObject({ data: artifact.bytecode, gas: String(testnet.ledger.deployGas), nonce: 1, chainId: chain.evmId });
    expect(tx.to).toBeUndefined();
    expect(ev.ledger).toMatchObject({ address: LEDGER, cosmos_tx: 'WIN1', codeHash: keccak256(RUNTIME) });
    expect(ev.ledger!.evm_tx).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('never deploys twice: a recorded or configured ledger stops it before any transaction', async () => {
    const a = setup();
    await deployLedger(a.ctx, a.ev, project, artifact);
    await expect(deployLedger(a.ctx, a.ev, project, artifact)).rejects.toThrow(/already at/);
    expect(a.fake.nativeTxs).toHaveLength(1);
    const b = setup(LEDGER);
    await expect(deployLedger(b.ctx, b.ev, project, artifact)).rejects.toThrow(/holds no code/);
    expect(b.fake.nativeTxs).toHaveLength(0);
  });

  it('does not widen or replace a window that is already open', async () => {
    const { fake, ctx, ev } = setup();
    fake.windows.set(project.cosmos, { found: true, live: true, remainingBlocks: 42n, targets: [] } as unknown as Win);
    await expect(deployLedger(ctx, ev, project, artifact)).rejects.toThrow(/already open for 42 more blocks/);
    expect(fake.nativeTxs).toHaveLength(0);
  });

  it('only deploys from the project account', async () => {
    const { ctx, ev } = setup();
    await expect(deployLedger(ctx, ev, keyless, artifact)).rejects.toThrow(/only the project account/);
  });
});

describe('anchorReport', () => {
  it('anchors through a window scoped to the ledger alone and records the event id', async () => {
    const { fake, ctx, ev } = setup(LEDGER);
    const rec = await anchorReport(ctx, ev, project, LEDGER, artifact.abi, digest, 'fixtures/workshop');
    const win = fake.nativeTxs[0]!.messages[0]!.value as { allowedTargets: string[]; maxValue: string };
    expect(win.allowedTargets).toEqual([LEDGER]);
    expect(win.maxValue).toBe(windowValue(BigInt(chain.anchor.gasLimit), BigInt(chain.anchor.maxFeePerGasWei), 1).toString());
    expect(fake.evmTxs[0]).toMatchObject({ to: LEDGER, gas: String(chain.anchor.gasLimit) });
    expect(rec).toMatchObject({ expect: 'success', account: 'project', id: '0', cosmos_tx: 'WIN1', findings: 4, files: ['a.sol', 'b.sol'] });
    expect(ev.anchors).toEqual([rec]);
  });

  it('sends nothing when the ledger would refuse the call', async () => {
    const { fake, ctx, ev } = setup(LEDGER);
    fake.ready.clear();
    await expect(anchorReport(ctx, ev, project, LEDGER, artifact.abi, digest, 't')).rejects.toThrow(/would refuse this anchor: NotQuantumReady/);
    expect(fake.nativeTxs).toHaveLength(0);
    expect(ev.anchors).toHaveLength(0);
  });

  it('fails without a record when the transaction reverts on chain', async () => {
    const { fake, ctx, ev } = setup(LEDGER);
    fake.revertNext = true;
    await expect(anchorReport(ctx, ev, project, LEDGER, artifact.abi, digest, 't')).rejects.toThrow(/reverted at block/);
    expect(ev.anchors).toHaveLength(0);
  });
});

describe('probeKeyless', () => {
  it('records the ledger refusing the keyless account, without sending anything', async () => {
    const { fake, ctx, ev } = setup(LEDGER);
    const rec = await probeKeyless(ctx, ev, keyless, LEDGER, artifact.abi, digest, 'fixtures/workshop');
    expect(rec).toMatchObject({ expect: 'revert', account: 'keyless', method: 'eth_call', reason: 'NotQuantumReady', height: 500 });
    expect(rec.evm_tx).toBeUndefined();
    expect(fake.nativeTxs).toHaveLength(0);
    expect(fake.evmTxs).toHaveLength(0);
  });

  it('fails when the ledger accepts the keyless account, or refuses it for another reason', async () => {
    const a = setup(LEDGER);
    a.fake.ready.add(keyless.evm.toLowerCase());
    await expect(probeKeyless(a.ctx, a.ev, keyless, LEDGER, artifact.abi, digest, 't')).rejects.toThrow(/accepted an anchor from the keyless/);
    const b = setup(LEDGER);
    const empty = { ...digest, reportHash: `0x${'0'.repeat(64)}` as Hex };
    await expect(probeKeyless(b.ctx, b.ev, keyless, LEDGER, artifact.abi, empty, 't')).rejects.toThrow(/EmptyReportHash, not NotQuantumReady/);
    expect([...a.ev.anchors, ...b.ev.anchors]).toHaveLength(0);
  });
});

describe('signEvm', () => {
  it("signs an EIP-1559 transaction with the account's own key", async () => {
    const account = await deriveUnifiedAccount(generateMnemonic(256), 10);
    const actor = actorFrom('project', account, chain.nativeId, 'v2');
    const raw = await actor.signEvm({ chainId: chain.evmId, nonce: 3, to: LEDGER, data: '0x1234', gas: 250_000n, maxFeePerGas: 2n, maxPriorityFeePerGas: 1n });
    const tx = parseTransaction(raw);
    expect(tx).toMatchObject({ type: 'eip1559', chainId: chain.evmId, nonce: 3, to: LEDGER, gas: 250_000n });
    expect(tx.value ?? 0n).toBe(0n);
    expect((await recoverTransactionAddress({ serializedTransaction: raw as never })).toLowerCase()).toBe(account.evm.toLowerCase());
  });
});

describe('artifact and config', () => {
  let dir = '';
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('reads ABI and creation code from forge output, and refuses a file without them', () => {
    dir = mkdtempSync(join(tmpdir(), 'sisir-art-'));
    writeFileSync(join(dir, 'ok.json'), JSON.stringify({ abi, bytecode: { object: '0x6080' } }));
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ abi, bytecode: { object: '0x' } }));
    expect(loadArtifact(join(dir, 'ok.json')).bytecode).toBe('0x6080');
    expect(() => loadArtifact(join(dir, 'bad.json'))).toThrow(/no ABI or creation code/);
    expect(() => loadArtifact(join(dir, 'none.json'))).toThrow(/forge build/);
  });

  it('writes contracts.sisirLedger alone, keeps the layout, and never replaces another address', () => {
    dir = mkdtempSync(join(tmpdir(), 'sisir-app-'));
    const path = join(dir, 'app.json');
    const before = readFileSync(join(root, 'config/app.json'), 'utf8').replace(/("sisirLedger"\s*:\s*)"[^"]*"/, '$1""');
    writeFileSync(path, before);
    const address = '0x00000000000000000000000000000000000C0FFe';
    setLedgerAddress(path, address);
    const after = readFileSync(path, 'utf8');
    expect(after).toBe(before.replace('"sisirLedger": ""', `"sisirLedger": "${address}"`));
    // The same address in another case is not a replacement.
    setLedgerAddress(path, address.toLowerCase());
    expect(() => setLedgerAddress(path, `0x${'1'.repeat(40)}`)).toThrow(/already names/);
  });
});
