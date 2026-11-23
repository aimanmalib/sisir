import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * evidence/testnet.json: the public record of what Sisir sent on the testnet. It holds addresses, amounts, heights
 * and transaction hashes only. The funding entry also guards the one transfer from the shared funder: once it is
 * written, `fund` refuses to send again.
 */

export interface TxRecord {
  tx: string;
  height: number;
  gasUsed: number;
}

export interface FundingRecord extends TxRecord {
  from: string;
  to: string;
  amount: string;
  denom: string;
}

/** SisirLedger as deployed: the EVM deployment and the Native-lane window that admitted it. */
export interface LedgerRecord {
  address: string;
  evm_tx: string;
  cosmos_tx: string;
  height: number;
  gasUsed: number;
  /** keccak256 of the runtime code read back from the chain. */
  codeHash: string;
}

/**
 * One anchor case. `success`: a sent transaction (`evm_tx` and the window `cosmos_tx`). `revert`: the same call from
 * the keyless account, answered by the ledger through `eth_call` at `height`.
 */
export interface AnchorRecord {
  expect: 'success' | 'revert';
  account: string;
  from: string;
  target: string;
  files: string[];
  reportHash: string;
  sourceHash: string;
  findings: number;
  height: number;
  id?: string;
  evm_tx?: string;
  cosmos_tx?: string;
  gasUsed?: number;
  method?: 'eth_call';
  reason?: string;
  revertData?: string;
}

export interface Evidence {
  network: string;
  accounts: Record<string, { cosmos: string; evm: string }>;
  funding?: FundingRecord;
  keys: Record<string, TxRecord>;
  ledger?: LedgerRecord;
  anchors: AnchorRecord[];
}

export function emptyEvidence(network: string): Evidence {
  return { network, accounts: {}, keys: {}, anchors: [] };
}

/** Read the record, or start one. A record for another network stops the run rather than being mixed in. */
export function readEvidence(path: string, network: string): Evidence {
  if (!existsSync(path)) return emptyEvidence(network);
  const e = JSON.parse(readFileSync(path, 'utf8')) as Partial<Evidence>;
  if (e.network !== network) throw new Error(`${path} is for network ${String(e.network)}, not ${network}`);
  return { ...emptyEvidence(network), ...e } as Evidence;
}

/**
 * Write through a temporary file and a rename, so a stopped run never leaves half a file. The folder is created on
 * the first write: the first `fund` sends before anything else exists, and its record must not be lost.
 */
export function writeEvidence(path: string, e: Evidence): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(e, null, 2) + '\n');
  renameSync(tmp, path);
}
