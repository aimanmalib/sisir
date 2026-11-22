import { s001 } from './s001-precompile-address-case.js';
import { s002 } from './s002-precompile-empty-return.js';
import { s003 } from './s003-pqc-key-status-unchecked.js';
import { s004 } from './s004-pqc-verify-result-ignored.js';
import type { Rule } from './types.js';

export { catalog, loadCatalog } from './catalog.js';
export { compareFindings, lintSource } from './engine.js';
export type { LintOptions } from './engine.js';
export { loadQoreChain, qorechain } from './qorechain.js';
export type * from './types.js';

/** Every shipped rule, in id order. Each rule lives in its own file next to this one. */
export const rules: readonly Rule[] = [s001, s002, s003, s004];
