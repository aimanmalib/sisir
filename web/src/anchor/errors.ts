import { classifyEvmWindowRejection } from '@qorechain/evm/window';
import { isQorexIntegrationError, isQorexUnsupportedMethodError } from '@qorechain/qorex-types';

/** Why a step failed, as the panel explains it. Each kind has a line in web/locales under `anchor.error`. */
export type AnchorErrorKind =
  | 'rejected'
  | 'notInstalled'
  | 'unsupported'
  | 'noKey'
  | 'noWindow'
  | 'exhausted'
  | 'notReady'
  | 'chainRefused'
  | 'failed';

/** The error and every `cause` below it: viem and wagmi wrap the wallet's answer. */
function chain(error: unknown): unknown[] {
  const out: unknown[] = [];
  let e: unknown = error;
  while (e !== undefined && e !== null && out.length < 8) {
    out.push(e);
    e = (e as { cause?: unknown }).cause;
  }
  return out;
}

function text(e: unknown): string {
  if (typeof e === 'string') return e;
  const o = e as { shortMessage?: unknown; message?: unknown; details?: unknown };
  return [o.shortMessage, o.message, o.details].filter((x) => typeof x === 'string').join(' ');
}

/** Sorts a wallet or chain refusal into one kind the panel can explain in either language. */
export function classifyAnchorError(error: unknown): AnchorErrorKind {
  const all = chain(error);
  for (const e of all) {
    const code = (e as { code?: unknown }).code;
    if (code === 4001 || code === 'ACTION_REJECTED' || /user rejected|rejected by the user|request rejected/i.test(text(e))) {
      return 'rejected';
    }
    if (isQorexIntegrationError(e) && e.code === 'QOREX_NOT_INSTALLED') return 'notInstalled';
    if (isQorexUnsupportedMethodError(e)) return 'unsupported';
  }
  const joined = all.map(text).join(' ');
  if (/NotQuantumReady/.test(joined)) return 'notReady';
  const window = classifyEvmWindowRejection(joined);
  if (window === 'no-pqc-key') return 'noKey';
  if (window === 'no-window') return 'noWindow';
  if (window === 'exhausted') return 'exhausted';
  if (/not yet supported/i.test(joined)) return 'unsupported';
  return 'failed';
}
