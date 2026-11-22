import { config } from '../config.js';

/** The part of SisirLedger the playground calls. Mirrors contracts/src/SisirLedger.sol. */
export const sisirLedgerAbi = [
  {
    type: 'function',
    name: 'anchor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'reportHash', type: 'bytes32' },
      { name: 'sourceHash', type: 'bytes32' },
      { name: 'findings', type: 'uint16' },
    ],
    outputs: [{ name: 'id', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'latest',
    stateMutability: 'view',
    inputs: [{ name: 'limit', type: 'uint256' }],
    outputs: [
      {
        name: 'list',
        type: 'tuple[]',
        components: [
          { name: 'account', type: 'address' },
          { name: 'reportHash', type: 'bytes32' },
          { name: 'sourceHash', type: 'bytes32' },
          { name: 'findings', type: 'uint16' },
          { name: 'blockNumber', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
  },
  { type: 'error', name: 'NotQuantumReady', inputs: [{ name: 'account', type: 'address' }] },
  { type: 'error', name: 'EmptyReportHash', inputs: [] },
] as const;

/** The deployed ledger from config/app.json, or null before it is deployed. */
export function ledgerAddress(): `0x${string}` | null {
  const a = config.contracts.sisirLedger;
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? (a as `0x${string}`) : null;
}
