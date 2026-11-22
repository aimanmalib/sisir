import { loadCatalog } from '../src/rules/catalog.js';
import type { Rule } from '../src/rules/types.js';
import type { Io } from '../src/cli/main.js';

/** Test-only catalog: real rules are tested against fixtures/rules. */
export const testCatalog = loadCatalog({
  rules: [
    { id: 'T001', name: 'flag-contract', level: 'error', docs: 'https://example.org/t001', message: 'Contract is named Flagged.', fix: 'Rename it.' },
    { id: 'T002', name: 'flag-function', level: 'warning', docs: 'https://example.org/t002', message: 'Function is named ping.', fix: 'Rename it.' },
    { id: 'T003', name: 'flag-pragma', level: 'info', docs: 'https://example.org/t003', message: 'File has a pragma.', fix: 'Nothing to do.' },
  ],
});

export const contractRule: Rule = {
  id: 'T001',
  create: (ctx) => ({
    ContractDefinition(node) {
      if (node.name === 'Flagged') ctx.report(node);
    },
  }),
};

export const functionRule: Rule = {
  id: 'T002',
  create: (ctx) => ({
    FunctionDefinition(node) {
      if (node.name === 'ping') ctx.report(node, 'Seen in a test.');
    },
  }),
};

export const pragmaRule: Rule = {
  id: 'T003',
  create: (ctx) => ({
    PragmaDirective(node) {
      ctx.report(node);
    },
  }),
};

export const testRules: readonly Rule[] = [contractRule, functionRule, pragmaRule];

export interface CapturedIo extends Io {
  stdout: string;
  stderr: string;
}

export function captureIo(cwd: string, env: Record<string, string | undefined> = {}, isTTY = false): CapturedIo {
  const io: CapturedIo = {
    cwd,
    env,
    isTTY,
    stdout: '',
    stderr: '',
    out(text) {
      io.stdout += text;
    },
    err(text) {
      io.stderr += text;
    },
  };
  return io;
}
