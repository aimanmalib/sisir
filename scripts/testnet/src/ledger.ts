import { openEvmWindowMsg } from '@qorechain/sdk';
import { decodeErrorResult, decodeEventLog, encodeFunctionData, keccak256, type Abi, type Hex } from 'viem';
import type { ChainConfig } from './config.js';
import type { AnchorRecord, Evidence, TxRecord } from './evidence.js';
import type { EvmLane, EvmReceipt } from './evm.js';
import { send, type Actor, type Ctx, type EvmTxRequest } from './setup.js';

/**
 * SisirLedger on the testnet, from the project account:
 * - `deployLedger` opens a one-transaction EVM window and deploys the contract, at most once;
 * - `anchorReport` opens a one-transaction window scoped to the ledger and anchors one report;
 * - `probeKeyless` asks the ledger, without sending anything, whether the keyless account may anchor. It must refuse.
 * Every EVM transaction is simulated first, so a call the contract would refuse stops here and costs nothing.
 */

export interface LedgerCtx extends Ctx {
  evm: EvmLane;
  chain: ChainConfig;
}

export interface Artifact {
  abi: Abi;
  bytecode: Hex;
}

/** What `SisirLedger.anchor` takes, and the files the report covers. */
export interface Digest {
  reportHash: Hex;
  sourceHash: Hex;
  findings: number;
  files: string[];
}

const WEI_PER_UQOR = 10n ** 12n;

/** The most a window must allow for `n` transactions: gas limit × fee cap each, wei to uqor rounded up. */
export function windowValue(gas: bigint, maxFeePerGas: bigint, n: number): bigint {
  return ((gas * maxFeePerGas + WEI_PER_UQOR - 1n) / WEI_PER_UQOR) * BigInt(n);
}

function fees(ctx: LedgerCtx): Pick<EvmTxRequest, 'maxFeePerGas' | 'maxPriorityFeePerGas' | 'chainId'> {
  return {
    chainId: ctx.chain.evmId,
    maxFeePerGas: BigInt(ctx.chain.anchor.maxFeePerGasWei),
    maxPriorityFeePerGas: BigInt(ctx.config.ledger.priorityFeeWei),
  };
}

/**
 * Open a window for one EVM transaction of at most `gas`, optionally scoped to `targets`. An open window is never
 * widened or replaced: the run stops and says when it ends.
 */
export async function openWindow(ctx: LedgerCtx, actor: Actor, gas: bigint, targets?: Hex[]): Promise<TxRecord> {
  const before = await ctx.lane.window(actor.cosmos);
  if (before.live)
    throw new Error(`${actor.role}: a window is already open for ${before.remainingBlocks} more blocks; run again after it ends`);
  const maxValue = windowValue(gas, BigInt(ctx.chain.anchor.maxFeePerGasWei), 1);
  const msg = openEvmWindowMsg({
    sender: actor.cosmos,
    blocks: ctx.chain.anchor.windowBlocks,
    maxTxs: 1,
    maxValue: maxValue.toString(),
    ...(targets ? { allowedTargets: targets } : {}),
  });
  const rec = await send(ctx, actor, [msg], 'openWindow', false);
  const after = await ctx.lane.window(actor.cosmos);
  if (!after.live) throw new Error(`${actor.role}: window ${rec.tx} left no live window`);
  ctx.log(`${actor.role}: opened a one-transaction window: ${rec.tx} at height ${rec.height}`);
  return rec;
}

/** Sign at the nonce read after the window opened (opening advances it), send, and require success. */
async function sendEvm(ctx: LedgerCtx, actor: Actor, tx: Omit<EvmTxRequest, 'nonce' | 'chainId' | 'maxFeePerGas' | 'maxPriorityFeePerGas'>): Promise<EvmReceipt> {
  const nonce = await ctx.evm.nonce(actor.evm as Hex);
  const raw = await actor.signEvm({ ...tx, ...fees(ctx), nonce });
  const r = await ctx.evm.sendAndWait(raw);
  if (!r.success) throw new Error(`${actor.role}: EVM tx ${r.hash} reverted at block ${r.blockNumber}`);
  return r;
}

function errorName(abi: Abi, data: Hex): string {
  try {
    return decodeErrorResult({ abi, data }).errorName;
  } catch {
    return data === '0x' ? 'empty revert' : `unknown error ${data.slice(0, 10)}`;
  }
}

/** Deploy SisirLedger from the project account, unless the evidence or the config already names a ledger. */
export async function deployLedger(ctx: LedgerCtx, evidence: Evidence, actor: Actor, artifact: Artifact): Promise<Hex> {
  if (actor.role !== 'project') throw new Error(`only the project account deploys the ledger, not ${actor.role}`);
  const known = evidence.ledger?.address ?? ctx.chain.ledger;
  if (known) {
    const code = await ctx.evm.code(known as Hex);
    if (code !== '0x') throw new Error(`SisirLedger is already at ${known}; the contract is not upgradable, deploy a new version by decision`);
    throw new Error(`${known} is recorded as SisirLedger but holds no code; check the record before deploying again`);
  }
  const gas = BigInt(ctx.config.ledger.deployGas);
  const window = await openWindow(ctx, actor, gas);
  const r = await sendEvm(ctx, actor, { data: artifact.bytecode, gas });
  if (!r.contractAddress) throw new Error(`deploy ${r.hash} has no contract address`);
  const code = await ctx.evm.code(r.contractAddress);
  if (code === '0x') throw new Error(`no code at ${r.contractAddress} after ${r.hash}`);
  evidence.ledger = {
    address: r.contractAddress,
    evm_tx: r.hash,
    cosmos_tx: window.tx,
    height: Number(r.blockNumber),
    gasUsed: Number(r.gasUsed),
    codeHash: keccak256(code),
  };
  ctx.log(`deployed SisirLedger at ${r.contractAddress}: ${r.hash} at block ${r.blockNumber}`);
  return r.contractAddress;
}

function anchorData(abi: Abi, d: Digest): Hex {
  return encodeFunctionData({ abi, functionName: 'anchor', args: [d.reportHash, d.sourceHash, d.findings] });
}

/** Anchor one report from the project account through a window scoped to the ledger alone. */
export async function anchorReport(ctx: LedgerCtx, evidence: Evidence, actor: Actor, ledger: Hex, abi: Abi, d: Digest, target: string): Promise<AnchorRecord> {
  if (actor.role !== 'project') throw new Error(`only the project account anchors, not ${actor.role}`);
  const data = anchorData(abi, d);
  const sim = await ctx.evm.call({ from: actor.evm as Hex, to: ledger, data });
  if (!sim.ok) throw new Error(`the ledger would refuse this anchor: ${errorName(abi, sim.data)}`);
  const gas = BigInt(ctx.chain.anchor.gasLimit);
  const window = await openWindow(ctx, actor, gas, [ledger]);
  const r = await sendEvm(ctx, actor, { to: ledger, data, gas });
  const event = r.logs
    .filter((l) => l.address.toLowerCase() === ledger.toLowerCase())
    .map((l) => decodeEventLog({ abi, data: l.data, topics: l.topics as [Hex, ...Hex[]] }))
    .find((e) => e.eventName === 'Anchored');
  if (!event) throw new Error(`anchor ${r.hash} emitted no Anchored event`);
  const rec: AnchorRecord = {
    expect: 'success',
    account: actor.role,
    from: actor.evm,
    target,
    files: d.files,
    reportHash: d.reportHash,
    sourceHash: d.sourceHash,
    findings: d.findings,
    id: String((event.args as unknown as { id: bigint }).id),
    evm_tx: r.hash,
    cosmos_tx: window.tx,
    height: Number(r.blockNumber),
    gasUsed: Number(r.gasUsed),
  };
  evidence.anchors.push(rec);
  ctx.log(`anchored ${target} as id ${rec.id}: ${r.hash} at block ${r.blockNumber}`);
  return rec;
}

/**
 * The negative case: the same anchor from the keyless account, as a read-only call at a recorded block. The keyless
 * account cannot send a transaction at all (no key, so no window, and no gas), so the call is the only way to show
 * the ledger's own answer. It must revert with NotQuantumReady.
 */
export async function probeKeyless(ctx: LedgerCtx, evidence: Evidence, actor: Actor, ledger: Hex, abi: Abi, d: Digest, target: string): Promise<AnchorRecord> {
  if (actor.role !== 'keyless') throw new Error(`the negative case runs from the keyless account, not ${actor.role}`);
  const height = await ctx.evm.blockNumber();
  const sim = await ctx.evm.call({ from: actor.evm as Hex, to: ledger, data: anchorData(abi, d) });
  if (sim.ok) throw new Error(`the ledger accepted an anchor from the keyless account ${actor.evm}`);
  const reason = errorName(abi, sim.data);
  if (reason !== 'NotQuantumReady') throw new Error(`the keyless call reverted with ${reason}, not NotQuantumReady`);
  const rec: AnchorRecord = {
    expect: 'revert',
    account: actor.role,
    from: actor.evm,
    target,
    files: d.files,
    reportHash: d.reportHash,
    sourceHash: d.sourceHash,
    findings: d.findings,
    method: 'eth_call',
    reason,
    revertData: sim.data,
    height: Number(height),
  };
  evidence.anchors.push(rec);
  ctx.log(`keyless ${actor.evm}: the ledger refuses with ${reason} (eth_call at block ${height})`);
  return rec;
}
