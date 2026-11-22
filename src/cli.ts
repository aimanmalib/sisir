#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { main } from './cli/main.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

main(
  process.argv.slice(2),
  {
    cwd: process.cwd(),
    env: process.env,
    isTTY: Boolean(process.stdout.isTTY),
    out: (text) => process.stdout.write(text),
    err: (text) => process.stderr.write(text),
  },
  { version: pkg.version },
).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`sisir: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
