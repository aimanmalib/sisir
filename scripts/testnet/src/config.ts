import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Message kinds this setup sends, each with a fixed gas limit in config/testnet.json. */
export type GasKind = 'send' | 'registerKey' | 'openWindow';
export const GAS_KINDS: readonly GasKind[] = ['send', 'registerKey', 'openWindow'];

/** The account roles, by their index on the shared testnet phrase. */
export type Role = 'funder' | 'project' | 'keyless';
export const ROLES: readonly Role[] = ['funder', 'project', 'keyless'];

/** config/testnet.json: every value of the testnet setup that may change. QOR amounts are decimal strings. */
export interface TestnetConfig {
  rest: string;
  denom: string;
  decimals: number;
  gasPriceUqor: string;
  gas: Record<GasKind, number>;
  waitSeconds: number;
  pollSeconds: number;
  accounts: Record<Role, number>;
  funding: { amountQor: string; fundBelowQor: string; funderMinQor: string };
  /** Deploying SisirLedger and anchoring with it. */
  ledger: LedgerConfig;
  /** Path from the repository root of the public record of what was sent. */
  evidence: string;
}

export interface LedgerConfig {
  /** forge build output with the ABI and creation code, from the repository root. */
  artifact: string;
  /** Gas limit of the deployment. */
  deployGas: number;
  /** EIP-1559 tip in wei; the fee cap is `anchor.maxFeePerGasWei` in config/app.json. */
  priorityFeeWei: string;
  /** What `anchor` lints and anchors when no path is given, from the repository root. */
  defaultTarget: string;
}

/** The anchor values shared with the playground (`anchor` in config/app.json). */
export interface AnchorConfig {
  windowBlocks: number;
  windowMaxTxs: number;
  gasLimit: number;
  maxFeePerGasWei: string;
}

/** The chain values shared with the playground, from config/app.json. */
export interface ChainConfig {
  /** Native-lane chain id, such as qorechain-diana. */
  nativeId: string;
  /** EVM chain id, such as 9800. */
  evmId: number;
  evmRpc: string;
  anchor: AnchorConfig;
  /** contracts.sisirLedger: empty until the ledger is deployed. */
  ledger: string;
}

const QOR = /^\d+(\.\d+)?$/;

function fail(msg: string): never {
  throw new Error(`config/testnet.json: ${msg}`);
}

/** Check the shape of config/testnet.json, so a typo stops the run before anything is signed. */
export function checkTestnetConfig(raw: unknown): TestnetConfig {
  const c = raw as TestnetConfig;
  if (!c || typeof c !== 'object') fail('not an object');
  if (typeof c.rest !== 'string' || !/^https?:\/\//.test(c.rest)) fail('rest must be an http(s) URL');
  if (typeof c.denom !== 'string' || c.denom === '') fail('denom is missing');
  if (!Number.isInteger(c.decimals) || c.decimals < 0) fail('decimals must be a whole number');
  if (typeof c.gasPriceUqor !== 'string' || !QOR.test(c.gasPriceUqor)) fail('gasPriceUqor must be a decimal string');
  for (const k of GAS_KINDS) {
    if (!Number.isInteger(c.gas?.[k]) || c.gas[k] <= 0) fail(`gas.${k} must be a positive whole number`);
  }
  if (!(c.waitSeconds > 0) || !(c.pollSeconds > 0)) fail('waitSeconds and pollSeconds must be positive');
  const seen = new Set<number>();
  for (const r of ROLES) {
    const i = c.accounts?.[r];
    if (!Number.isInteger(i) || (i as number) < 0) fail(`accounts.${r} must be an account index`);
    if (seen.has(i)) fail(`accounts.${r} repeats index ${i}`);
    seen.add(i);
  }
  for (const k of ['amountQor', 'fundBelowQor', 'funderMinQor'] as const) {
    if (typeof c.funding?.[k] !== 'string' || !QOR.test(c.funding[k])) fail(`funding.${k} must be a decimal string`);
  }
  const l = c.ledger;
  if (typeof l?.artifact !== 'string' || !l.artifact.endsWith('.json')) fail('ledger.artifact must name a forge build file');
  if (!Number.isInteger(l.deployGas) || l.deployGas <= 0) fail('ledger.deployGas must be a positive whole number');
  if (typeof l.priorityFeeWei !== 'string' || !/^\d+$/.test(l.priorityFeeWei)) fail('ledger.priorityFeeWei must be a whole number string');
  if (typeof l.defaultTarget !== 'string' || l.defaultTarget === '') fail('ledger.defaultTarget is missing');
  if (typeof c.evidence !== 'string' || c.evidence.startsWith('/') || c.evidence.includes('..'))
    fail('evidence must be a path inside the repository');
  return c;
}

/** Read config/testnet.json and the chain block of config/app.json from the repository at `root`. */
export function loadConfig(root: string): { testnet: TestnetConfig; chain: ChainConfig } {
  const read = (p: string): unknown => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
  const testnet = checkTestnetConfig(read('config/testnet.json'));
  const app = read('config/app.json') as {
    chain?: { nativeId?: unknown; id?: unknown; evmRpc?: unknown };
    anchor?: Partial<AnchorConfig>;
    contracts?: { sisirLedger?: unknown };
  };
  const { nativeId, id, evmRpc } = app.chain ?? {};
  if (typeof nativeId !== 'string' || typeof evmRpc !== 'string' || !Number.isInteger(id))
    throw new Error('config/app.json: chain.nativeId, chain.id and chain.evmRpc are required');
  const a = app.anchor ?? {};
  for (const k of ['windowBlocks', 'windowMaxTxs', 'gasLimit'] as const)
    if (!Number.isInteger(a[k]) || (a[k] as number) <= 0) throw new Error(`config/app.json: anchor.${k} must be a positive whole number`);
  if (typeof a.maxFeePerGasWei !== 'string' || !/^\d+$/.test(a.maxFeePerGasWei))
    throw new Error('config/app.json: anchor.maxFeePerGasWei must be a whole number string');
  const ledger = app.contracts?.sisirLedger ?? '';
  if (typeof ledger !== 'string') throw new Error('config/app.json: contracts.sisirLedger must be a string');
  return { testnet, chain: { nativeId, evmId: id as number, evmRpc, anchor: a as AnchorConfig, ledger } };
}

/** A QOR decimal string to base units, refusing anything that is not a plain non-negative decimal. */
export function toBase(qor: string, decimals: number): bigint {
  if (!QOR.test(qor)) throw new Error(`"${qor}" is not a QOR amount`);
  const [whole, frac = ''] = qor.split('.');
  if (frac.length > decimals) throw new Error(`"${qor}" has more than ${decimals} decimals`);
  return BigInt(whole! + frac.padEnd(decimals, '0'));
}

/** Base units to a QOR decimal string, for output. */
export function fromBase(amount: bigint, decimals: number): string {
  const s = amount.toString().padStart(decimals + 1, '0');
  const frac = s.slice(s.length - decimals).replace(/0+$/, '');
  return frac ? `${s.slice(0, s.length - decimals)}.${frac}` : s.slice(0, s.length - decimals);
}

/** Fee for `n` messages of one kind: gas limit and price from config, rounded up to a whole base unit. */
export function feeFor(c: TestnetConfig, kind: GasKind, n = 1): { amount: { denom: string; amount: string }[]; gas: string } {
  const gas = BigInt(c.gas[kind]) * BigInt(n);
  const [whole, frac = ''] = c.gasPriceUqor.split('.');
  const scale = 10n ** BigInt(frac.length);
  const amount = (gas * BigInt(whole! + frac) + scale - 1n) / scale;
  return { amount: [{ denom: c.denom, amount: amount.toString() }], gas: gas.toString() };
}
