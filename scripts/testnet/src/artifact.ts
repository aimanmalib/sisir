import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { Abi, Hex } from 'viem';
import type { Artifact } from './ledger.js';

/** ABI and creation code from forge build output. */
export function loadArtifact(path: string): Artifact {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new Error(`no build output at ${path}; run 'forge build' in contracts/`);
  }
  const json = JSON.parse(raw) as { abi?: Abi; bytecode?: { object?: string } };
  const bytecode = json.bytecode?.object;
  if (!Array.isArray(json.abi) || typeof bytecode !== 'string' || !/^0x([0-9a-fA-F]{2})+$/.test(bytecode))
    throw new Error(`${path} has no ABI or creation code`);
  return { abi: json.abi, bytecode: bytecode as Hex };
}

const LEDGER_KEY = /("sisirLedger"\s*:\s*)"[^"]*"/;

/**
 * Write the ledger address into config/app.json as `contracts.sisirLedger`, changing that one value only so the rest
 * of the file keeps its layout. Refuses to replace a different address that is already there.
 */
export function setLedgerAddress(path: string, address: string): void {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error(`${address} is not an address`);
  const text = readFileSync(path, 'utf8');
  const current = (JSON.parse(text) as { contracts?: { sisirLedger?: unknown } }).contracts?.sisirLedger;
  if (typeof current !== 'string') throw new Error(`${path} has no contracts.sisirLedger`);
  if (current !== '' && current.toLowerCase() !== address.toLowerCase())
    throw new Error(`${path} already names ${current} as SisirLedger`);
  const next = text.replace(LEDGER_KEY, `$1"${address}"`);
  const check = (JSON.parse(next) as { contracts: { sisirLedger: string } }).contracts.sisirLedger;
  if (check !== address) throw new Error(`could not write contracts.sisirLedger in ${path}`);
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, next);
  renameSync(tmp, path);
}
