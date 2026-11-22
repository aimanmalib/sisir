# Contributing

Thanks for helping. Sisir is only useful if its findings are right, so a change to a rule needs evidence from the
QoreChain docs and fixtures that show it.

## Set up

Node.js 22 (see `.nvmrc`). The test script installs a pinned Foundry and gitleaks if they are missing.

```sh
git clone --recurse-submodules https://github.com/aimanmalib/sisir.git
cd sisir
npm ci                          # also builds dist/
node dist/cli.js fixtures/workshop
bash scripts/gerbang-ujian.sh   # type check, vitest, playground build and tests, forge test, secret scan
```

The playground lives in `web/` with its own `package.json`: `cd web && npm ci && npm run dev`.

## Before you open a pull request

- Run `bash scripts/gerbang-ujian.sh`; CI runs the same script.
- Rules stay within S001 to S008, the QoreChain-specific mistakes that the official docs or workshops name. A general
  Solidity check belongs in another tool.
- A change to a rule needs a positive and a negative fixture in `fixtures/rules/<id>/` (mark the line that must report
  with `// expect <id>`), a test that fails without the change, and an update to [`docs/rules.md`](docs/rules.md),
  including what the rule still does not catch.
- Rule text, levels and documentation links go in `src/rules/catalog.json`; addresses go in
  `src/rules/qorechain.json`; playground settings go in `config/app.json`. Not in code.
- Text in the playground goes in `web/locales/en.json` and `web/locales/ms.json`, with the same keys in both.
- `SisirLedger` cannot be upgraded. A change to it means a new deployment, a new address in `config/app.json`, a
  `CHANGELOG.md` entry and a decision record.
- A design decision gets a short record in `docs/decisions/`, with how to undo it.
- Source files stay under 400 lines. One topic per pull request; say how you tested it.

## Reporting security issues

Please don't open a public issue. See [SECURITY.md](SECURITY.md).

By contributing you agree that your contribution is licensed under the [Apache License 2.0](LICENSE) and that you follow
the [Code of Conduct](CODE_OF_CONDUCT.md).
