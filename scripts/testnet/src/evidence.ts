import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';

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

export interface Evidence {
  network: string;
  accounts: Record<string, { cosmos: string; evm: string }>;
  funding?: FundingRecord;
  keys: Record<string, TxRecord>;
  anchors: unknown[];
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

/** Write through a temporary file and a rename, so a stopped run never leaves half a file. */
export function writeEvidence(path: string, e: Evidence): void {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(e, null, 2) + '\n');
  renameSync(tmp, path);
}
