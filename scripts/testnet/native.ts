/**
 * native: get Sisir's testnet accounts ready on the Native lane before any EVM transaction.
 *
 *   npm run native -- status   balance, ML-DSA-87 key and EVM window of the funder, project and keyless accounts
 *   npm run native -- fund     send the project account its gas money from the shared funder, one time only
 *   npm run native -- key      register the project account's ML-DSA-87 key with a proof of possession
 *
 * Accounts are derived from the shared testnet phrase in the file named by SISIR_ACCOUNTS (absolute, outside the
 * repository, mode 600), at the indexes in config/testnet.json. Output is public data only: roles, addresses, amounts
 * and transaction hashes. `fund` and `key` add what they sent to evidence/testnet.json.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveUnifiedAccount, resolveSignBytesVersion } from '@qorechain/sdk';
import { accountsPath, readMnemonic } from './src/accounts.js';
import { fromBase, loadConfig, ROLES, type Role } from './src/config.js';
import { readEvidence, writeEvidence } from './src/evidence.js';
import { restLane } from './src/lane.js';
import { actorFrom, fundOnce, readStatus, registerProjectKey, type Actor, type Ctx } from './src/setup.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
export const USAGE = 'usage: npm run native -- status | fund | key';

export async function main(argv: string[], env: NodeJS.ProcessEnv, out: (line: string) => void): Promise<number> {
  const [cmd] = argv;
  if (cmd !== 'status' && cmd !== 'fund' && cmd !== 'key') throw new Error(USAGE);
  const { testnet, chain } = loadConfig(repoRoot);
  const mnemonic = readMnemonic(accountsPath(env, repoRoot));
  const version = await resolveSignBytesVersion({ chainId: chain.nativeId, rest: testnet.rest });
  const actors = {} as Record<Role, Actor>;
  for (const role of ROLES)
    actors[role] = actorFrom(role, await deriveUnifiedAccount(mnemonic, testnet.accounts[role]), chain.nativeId, version);
  const ctx: Ctx = {
    lane: restLane({ rest: testnet.rest, denom: testnet.denom, waitMs: testnet.waitSeconds * 1000, pollMs: testnet.pollSeconds * 1000 }),
    chainId: chain.nativeId,
    config: testnet,
    log: out,
  };

  if (cmd === 'status') {
    for (const r of await readStatus(ctx, ROLES.map((role) => actors[role]))) {
      const qor = fromBase(r.balance, testnet.decimals);
      out(`${r.role.padEnd(8)} ${r.evm} ${r.cosmos}  ${qor} QOR  key ${r.key}  window ${r.windowLive ? 'open' : 'closed'}`);
    }
    return 0;
  }

  const evidencePath = resolve(repoRoot, testnet.evidence);
  const evidence = readEvidence(evidencePath, chain.nativeId);
  for (const role of ['project', 'keyless'] as const) evidence.accounts[role] = { cosmos: actors[role].cosmos, evm: actors[role].evm };
  try {
    if (cmd === 'fund') await fundOnce(ctx, evidence, actors.funder, actors.project);
    else await registerProjectKey(ctx, evidence, actors.project);
  } finally {
    // A sent transaction is recorded even when a later check fails.
    writeEvidence(evidencePath, evidence);
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2), process.env, (line) => console.log(line)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(`native: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    },
  );
}
