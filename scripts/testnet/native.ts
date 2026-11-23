/**
 * native: get Sisir's testnet accounts ready on the Native lane before any EVM transaction.
 *
 *   npm run native -- status   balance, ML-DSA-87 key and EVM window of the funder, project and keyless accounts
 *   npm run native -- fund     send the project account its gas money from the shared funder, one time only
 *   npm run native -- key      register the project account's ML-DSA-87 key with a proof of possession
 *   npm run native -- deploy   deploy SisirLedger from the project account through a one-transaction EVM window
 *   npm run native -- anchor [path]   anchor the report of a file or folder from the project account, then show
 *                              that the ledger refuses the same anchor from the keyless account
 *
 * Accounts are derived from the shared testnet phrase in the file named by SISIR_ACCOUNTS (absolute, outside the
 * repository, mode 600), at the indexes in config/testnet.json. Output is public data only: roles, addresses, amounts
 * and transaction hashes. Every command but `status` adds what it sent to evidence/testnet.json; `deploy` also writes
 * the ledger address into config/app.json.
 */
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveUnifiedAccount, resolveSignBytesVersion } from '@qorechain/sdk';
import { accountsPath, readMnemonic } from './src/accounts.js';
import { fromBase, loadConfig, ROLES, type Role } from './src/config.js';
import type { Hex } from 'viem';
import { loadArtifact, setLedgerAddress } from './src/artifact.js';
import { readEvidence, writeEvidence } from './src/evidence.js';
import { viemLane } from './src/evm.js';
import { restLane } from './src/lane.js';
import { anchorReport, deployLedger, probeKeyless, type LedgerCtx } from './src/ledger.js';
import { digestPath } from './src/report.js';
import { actorFrom, fundOnce, readStatus, registerProjectKey, type Actor, type Ctx } from './src/setup.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
export const USAGE = 'usage: npm run native -- status | fund | key | deploy | anchor [path]';
const COMMANDS = ['status', 'fund', 'key', 'deploy', 'anchor'];

export async function main(argv: string[], env: NodeJS.ProcessEnv, out: (line: string) => void): Promise<number> {
  const [cmd, path, ...rest] = argv;
  if (!cmd || !COMMANDS.includes(cmd) || rest.length > 0 || (path !== undefined && cmd !== 'anchor')) throw new Error(USAGE);
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
  const lctx: LedgerCtx = {
    ...ctx,
    chain,
    evm: viemLane({ rpc: chain.evmRpc, chainId: chain.evmId, waitMs: testnet.waitSeconds * 1000, pollMs: testnet.pollSeconds * 1000 }),
  };
  const artifact = () => loadArtifact(resolve(repoRoot, testnet.ledger.artifact));
  try {
    if (cmd === 'fund') await fundOnce(ctx, evidence, actors.funder, actors.project);
    else if (cmd === 'key') await registerProjectKey(ctx, evidence, actors.project);
    else if (cmd === 'deploy') {
      const address = await deployLedger(lctx, evidence, actors.project, artifact());
      setLedgerAddress(resolve(repoRoot, 'config/app.json'), address);
      out(`config/app.json contracts.sisirLedger = ${address}`);
    } else {
      const ledger = (evidence.ledger?.address ?? chain.ledger) as Hex;
      if (!ledger) throw new Error('SisirLedger is not deployed yet; run deploy first');
      const target = (path ?? testnet.ledger.defaultTarget).replace(/\/+$/, '');
      // The path is written to the public evidence, so it is taken from the repository root and must stay inside it.
      if (isAbsolute(target) || target.split('/').includes('..')) throw new Error('give the path from the repository root, inside it');
      const digest = await digestPath(resolve(repoRoot, target));
      out(`${target}: ${digest.files.length} files, ${digest.findings} findings, report ${digest.reportHash}`);
      const { abi } = artifact();
      // The negative case first: it sends nothing, and a ledger that accepts it must not get a real anchor.
      await probeKeyless(lctx, evidence, actors.keyless, ledger, abi, digest, target);
      await anchorReport(lctx, evidence, actors.project, ledger, abi, digest, target);
    }
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
