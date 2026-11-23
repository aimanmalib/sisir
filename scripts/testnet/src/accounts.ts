import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

/**
 * The shared testnet phrase is kept in a file outside the repository. Only this module reads it, and only the
 * process that signs ever holds the phrase. Nothing here prints or returns it beyond the caller.
 */

export const ACCOUNTS_ENV = 'SISIR_ACCOUNTS';

/** Resolve the accounts file from the environment: absolute, and never inside the repository. */
export function accountsPath(env: NodeJS.ProcessEnv, repoRoot: string): string {
  const p = env[ACCOUNTS_ENV];
  if (!p) throw new Error(`${ACCOUNTS_ENV} is not set: give the absolute path of the accounts file`);
  if (!isAbsolute(p)) throw new Error(`${ACCOUNTS_ENV} must be an absolute path`);
  const rel = relative(resolve(repoRoot), resolve(p));
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)))
    throw new Error(`${ACCOUNTS_ENV} points inside the repository; keep the file outside it`);
  return p;
}

/** Read the phrase, refusing a file that group or others can read, or one of an unknown shape. */
export function readMnemonic(path: string): string {
  const mode = statSync(path).mode & 0o777;
  if ((mode & 0o077) !== 0) throw new Error(`accounts file mode is ${mode.toString(8)}; it must be 600`);
  let parsed: { version?: unknown; mnemonic?: unknown };
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as typeof parsed;
  } catch {
    // The parser's message can quote the file, so it is not passed on.
    throw new Error('accounts file is not JSON');
  }
  if (parsed.version !== 1 || typeof parsed.mnemonic !== 'string') throw new Error('accounts file has an unknown shape');
  return parsed.mnemonic;
}
