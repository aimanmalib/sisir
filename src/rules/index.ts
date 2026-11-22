import type { Rule } from './types.js';

export { catalog, loadCatalog } from './catalog.js';
export { compareFindings, lintSource } from './engine.js';
export type { LintOptions } from './engine.js';
export type * from './types.js';

/** Every shipped rule, in id order. Each rule lives in its own file next to this one. */
export const rules: readonly Rule[] = [];
