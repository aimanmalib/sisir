import {
  EthNativeSigner,
  MSG_SEND_TYPE_URL,
  buildRegisterPqcKeyMsg,
  isRegisteredPqcKey,
  signProofOfPossession,
  validateClassicalKeyForSender,
  type PqcKeypair,
  type SignBytesVersion,
  type UnifiedAccount,
} from '@qorechain/sdk';
import { feeFor, fromBase, toBase, type GasKind, type Role, type TestnetConfig } from './config.js';
import type { Evidence, TxRecord } from './evidence.js';
import type { Lane } from './lane.js';

/**
 * Sisir's account setup on the Native lane, before any EVM transaction:
 * - `fundOnce` sends the project account its gas money from the shared funder, one time only;
 * - `registerProjectKey` registers the project account's ML-DSA-87 key with a proof of possession.
 * The keyless account is never registered: it is the negative case for SisirLedger. The funder's key belongs to the
 * other project of the same entry; Sisir only reads it and signs one transfer with it.
 */

export interface SignRequest {
  messages: { typeUrl: string; value: unknown }[];
  fee: ReturnType<typeof feeFor>;
  accountNumber: bigint;
  sequence: bigint;
  /** True only for the key registration itself; everything else is signed hybrid. */
  classical: boolean;
}

/** One account the setup acts for. The keys stay inside `sign`. */
export interface Actor {
  role: Role;
  cosmos: string;
  evm: string;
  /** 33-byte compressed secp256k1 public key, sent with the key registration. */
  ecdsaPubkey: Uint8Array;
  pqc: PqcKeypair;
  sign(r: SignRequest): Uint8Array;
}

/** An actor for a unified eth-native account, signed through the SDK's eth-native signer. */
export function actorFrom(role: Role, account: UnifiedAccount, chainId: string, version: SignBytesVersion): Actor {
  const signer = (mode: 'hybrid' | 'classical') =>
    new EthNativeSigner(account, { signMode: mode, signBytesVersion: version });
  const hybrid = signer('hybrid');
  const classical = signer('classical');
  return {
    role,
    cosmos: account.cosmos,
    evm: account.evm,
    ecdsaPubkey: Uint8Array.from(Buffer.from(account.publicKey.replace(/^0x/, ''), 'hex')),
    pqc: account.pqc,
    sign: (r) =>
      (r.classical ? classical : hybrid).sign({
        chainId,
        messages: r.messages as never,
        fee: r.fee,
        accountNumber: r.accountNumber,
        sequence: r.sequence,
      }).txRawBytes,
  };
}

export interface Ctx {
  lane: Lane;
  chainId: string;
  config: TestnetConfig;
  log: (line: string) => void;
}

async function send(ctx: Ctx, actor: Actor, messages: SignRequest['messages'], kind: GasKind, classical: boolean): Promise<TxRecord> {
  const acct = await ctx.lane.account(actor.cosmos);
  if (!acct) throw new Error(`${actor.role} ${actor.cosmos} is not on chain yet (no funds)`);
  const fee = feeFor(ctx.config, kind, messages.length);
  const bytes = actor.sign({ messages, fee, accountNumber: acct.accountNumber, sequence: acct.sequence, classical });
  const inc = await ctx.lane.broadcast(bytes);
  return { tx: inc.hash, height: inc.height, gasUsed: inc.gasUsed };
}

/** Whether the account has our key registered and proven. A different key on chain throws. */
async function keyReady(ctx: Ctx, actor: Actor): Promise<boolean> {
  const status = await ctx.lane.pqcStatus(actor.cosmos);
  if (!status.registered) return false;
  if (isRegisteredPqcKey(status, actor.pqc.publicKey) === false)
    throw new Error(`${actor.role} ${actor.cosmos} has another ML-DSA-87 key registered`);
  return status.possessionProven !== false;
}

/**
 * Send `funding.amountQor` from the funder to the project account, at most once. Refuses when the evidence already
 * records a transfer, when the funder's key is not registered and proven (that step belongs to the funder's own
 * project), or when the funder would end below `funding.funderMinQor`. Does nothing while the project account holds
 * `funding.fundBelowQor` or more.
 */
export async function fundOnce(ctx: Ctx, evidence: Evidence, funder: Actor, project: Actor): Promise<boolean> {
  const { denom, decimals, funding } = ctx.config;
  if (evidence.funding) throw new Error(`the project account was already funded once (${evidence.funding.tx}); not sending again`);
  const has = await ctx.lane.balance(project.cosmos);
  if (has >= toBase(funding.fundBelowQor, decimals)) {
    ctx.log(`project holds ${fromBase(has, decimals)} QOR; no transfer needed`);
    return false;
  }
  if (!(await keyReady(ctx, funder)))
    throw new Error(`the funder ${funder.cosmos} has no proven ML-DSA-87 key yet; its own project registers it first`);
  const amount = toBase(funding.amountQor, decimals);
  const fee = BigInt(feeFor(ctx.config, 'send').amount[0]!.amount);
  const funderHas = await ctx.lane.balance(funder.cosmos);
  const floor = toBase(funding.funderMinQor, decimals);
  if (funderHas < floor || funderHas < amount + fee)
    throw new Error(`the funder holds ${fromBase(funderHas, decimals)} QOR; the transfer waits until it holds ${funding.funderMinQor}`);

  const msg = {
    typeUrl: MSG_SEND_TYPE_URL,
    value: { fromAddress: funder.cosmos, toAddress: project.cosmos, amount: [{ denom, amount: amount.toString() }] },
  };
  const rec = await send(ctx, funder, [msg], 'send', false);
  evidence.funding = { ...rec, from: funder.cosmos, to: project.cosmos, amount: amount.toString(), denom };
  ctx.log(`sent ${funding.amountQor} QOR to project ${project.cosmos}: ${rec.tx} at height ${rec.height}`);
  return true;
}

/**
 * Register the project account's ML-DSA-87 key with a proof of possession bound to this account and chain, and the
 * account's own compressed secp256k1 key. It is the only transaction signed classically. After it, the status is read
 * back and must show the key registered and proven.
 */
export async function registerProjectKey(ctx: Ctx, evidence: Evidence, actor: Actor): Promise<boolean> {
  if (actor.role !== 'project') throw new Error(`only the project account gets a key; ${actor.role} stays without one`);
  if (await keyReady(ctx, actor)) {
    ctx.log(`${actor.role}: key already registered and proven`);
    return false;
  }
  const status = await ctx.lane.pqcStatus(actor.cosmos);
  if (status.registered) throw new Error(`${actor.role}: key registered without proof of possession; rotate it by hand`);
  if (!(await ctx.lane.account(actor.cosmos))) throw new Error(`${actor.role} ${actor.cosmos} is not on chain yet (no funds)`);
  validateClassicalKeyForSender(actor.cosmos, actor.ecdsaPubkey);
  const proof = signProofOfPossession({ chainId: ctx.chainId, account: actor.cosmos, keypair: actor.pqc });
  const msg = buildRegisterPqcKeyMsg(actor.cosmos, { pqcKeypair: actor.pqc, ecdsaPubkey: actor.ecdsaPubkey, proofOfPossession: proof });
  const rec = await send(ctx, actor, [msg as SignRequest['messages'][number]], 'registerKey', true);
  if (!(await keyReady(ctx, actor))) throw new Error(`${actor.role}: registration ${rec.tx} did not leave a proven key`);
  evidence.keys[actor.role] = rec;
  ctx.log(`${actor.role}: registered ML-DSA-87 key: ${rec.tx} at height ${rec.height}`);
  return true;
}

export interface StatusRow {
  role: Role;
  cosmos: string;
  evm: string;
  balance: bigint;
  key: 'none' | 'unproven' | 'proven';
  windowLive: boolean;
}

/** Public state of each account: balance, key and window. */
export async function readStatus(ctx: Ctx, actors: Pick<Actor, 'role' | 'cosmos' | 'evm'>[]): Promise<StatusRow[]> {
  return Promise.all(
    actors.map(async (a) => {
      const [balance, pqc, w] = await Promise.all([ctx.lane.balance(a.cosmos), ctx.lane.pqcStatus(a.cosmos), ctx.lane.window(a.cosmos)]);
      const key = !pqc.registered ? 'none' : pqc.possessionProven === false ? 'unproven' : 'proven';
      return { role: a.role, cosmos: a.cosmos, evm: a.evm, balance, key, windowLive: w.live } as StatusRow;
    }),
  );
}
