# 0001. CLI core: one rule engine, three output formats

- Status: accepted
- Date: 2026-11-22

## Context

Sisir is a Node command line tool that must also run its rules in the browser playground later. It has to install
straight from GitHub (`npx github:aimanmalib/sisir <path>`), so the JavaScript must be built on install. Results must be
readable by people in a terminal, by scripts, and by code scanning tools.

## Decision

- One npm package at the repository root. TypeScript in strict mode, built by the `prepare` script into `dist/`, so a
  GitHub install builds the CLI. The `files` field ships `dist/`, `LICENSE`, `NOTICE` and `README.md` only.
- One rule engine in `src/rules`. It takes source text and returns findings, and never touches the file system, so the
  playground can bundle the same code. The AST is parsed once with `@solidity-parser/parser` (pinned to an exact
  version) and every rule's visitor runs in a single walk.
- A rule only finds nodes. Its id, level, message, fix and documentation URL live in `src/rules/catalog.json`, so text
  can change without touching code. The engine refuses a rule that has no catalog entry.
- Output: coloured text (off when not a terminal, with `NO_COLOR` or `--no-color`), `--format json`, and
  `--format sarif` (SARIF 2.1.0; `info` maps to `note`; parse errors become tool execution notifications).
- Exit codes: 0 without error-level findings, 1 with error-level findings, 2 when a file does not parse or the
  arguments are wrong. A parse error wins over findings, because a file we could not read was not checked.
- Folder scans skip `node_modules`, `lib`, `out`, `cache`, `artifacts`, `dist` and `.git`, which hold dependencies or
  build output rather than the user's contracts.
- Node 20.10 or newer, for JSON import attributes. Development and CI use Node 22 (`.nvmrc`).
- The SARIF test validates output against the official OASIS schema, copied unchanged into `test/schema/` and credited
  in `NOTICE`.
- The test gate (`scripts/gerbang-ujian.sh`) runs typecheck, build, unit tests and a secret scan, and fails when no
  tests ran or any test was skipped. That check lives in the repository so it works the same on any machine and in CI.

## Consequences

- Adding a rule means one file in `src/rules`, one catalog entry, fixtures and a test.
- The playground can import `src/rules` directly; it must not copy rule code.

## How to undo

Revert the commits that added `src/`, `test/`, `package.json` and the gate scripts. Nothing outside the repository
depends on them yet.
