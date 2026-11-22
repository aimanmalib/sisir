import { config } from '../config.js';

export { sisirLedgerAbi } from './abi.js';

/**
 * The deployed ledger from config/app.json, or null before it is deployed. VITE_SISIR_LEDGER, read at build
 * time, points a local build at another deployment (a local node, or the fake chain the e2e tests answer).
 */
export function ledgerAddress(): `0x${string}` | null {
  const a = import.meta.env.VITE_SISIR_LEDGER || config.contracts.sisirLedger;
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as `0x${string}`) : null;
}
