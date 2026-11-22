import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { catalog as defaultCatalog, lintSource, rules as defaultRules } from '../rules/index.js';
import type { CatalogEntry, Rule } from '../rules/types.js';
import { collectFiles, displayPath, PathError } from './files.js';
import { formatJson } from './format-json.js';
import { formatSarif } from './format-sarif.js';
import { formatText } from './format-text.js';
import { exitCode, type RunResult } from './summary.js';

export const USAGE = `Usage: sisir [options] <file-or-folder>...

Lints Solidity contracts for QoreChain post-quantum and cross-VM mistakes.

Options:
  -f, --format <text|json|sarif>  output format (default: text)
      --no-color                  plain text output
  -v, --version                   print the version
  -h, --help                      print this help

Exit codes: 0 no error-level findings, 1 error-level findings, 2 parse or usage error.
`;

const FORMATS = ['text', 'json', 'sarif'] as const;
type Format = (typeof FORMATS)[number];

export interface Io {
  cwd: string;
  env: Record<string, string | undefined>;
  isTTY: boolean;
  out(text: string): void;
  err(text: string): void;
}

export interface MainOptions {
  version: string;
  rules?: readonly Rule[];
  catalog?: ReadonlyMap<string, CatalogEntry>;
}

function useColor(io: Io, noColor: boolean): boolean {
  if (noColor || io.env.NO_COLOR) return false;
  if (io.env.FORCE_COLOR && io.env.FORCE_COLOR !== '0') return true;
  return io.isTTY && io.env.TERM !== 'dumb';
}

/** Runs the CLI and returns the exit code. All output goes through io. */
export async function main(argv: readonly string[], io: Io, options: MainOptions): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        format: { type: 'string', short: 'f', default: 'text' },
        'no-color': { type: 'boolean', default: false },
        version: { type: 'boolean', short: 'v', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (e) {
    io.err(`sisir: ${(e as Error).message}\n\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    io.out(USAGE);
    return 0;
  }
  if (values.version) {
    io.out(`${options.version}\n`);
    return 0;
  }
  const format = values.format as Format;
  if (!FORMATS.includes(format)) {
    io.err(`sisir: unknown format "${values.format}" (use text, json or sarif)\n`);
    return 2;
  }
  if (positionals.length === 0) {
    io.err(`sisir: give at least one file or folder\n\n${USAGE}`);
    return 2;
  }

  let files: string[];
  try {
    files = await collectFiles(positionals, io.cwd);
  } catch (e) {
    if (e instanceof PathError) {
      io.err(`sisir: ${e.message}\n`);
      return 2;
    }
    throw e;
  }

  const rules = options.rules ?? defaultRules;
  const catalog = options.catalog ?? defaultCatalog;
  const run: RunResult = { version: options.version, files: [] };
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    run.files.push(lintSource(source, { file: displayPath(file, io.cwd), rules, catalog }));
  }

  if (format === 'json') io.out(formatJson(run));
  else if (format === 'sarif') io.out(formatSarif(run, catalog));
  else io.out(formatText(run, useColor(io, values['no-color'])));
  return exitCode(run);
}
