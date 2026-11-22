# 0005. The playground runs the CLI's rule engine in the browser

- Status: accepted
- Date: 2026-11-22

## Context

The playground in `web/` must find the same problems as the CLI, in English and Malay, without a server. The rules
used to build their detail sentences in code, in English only.

## Decision

- `web/` imports the rules from `../src/rules` through the alias `@sisir/rules` (Vite and TypeScript). There is no
  copy of any rule. Linting runs on the main thread: a contract parses in milliseconds.
- Rule text lives in JSON. A rule reports a detail key and values (`{ key: 'leavesOut', values: { parts: [...] } }`);
  `src/rules/catalog.json` holds the English templates and `src/rules/i18n/ms.json` the Malay ones. Lists are joined
  with `Intl.ListFormat`, so English reads "a, b and c" and Malay "a, b dan c". The CLI output is unchanged. A test
  checks that every language has the same keys and placeholders.
- UI text lives in `web/locales/en.json` and `web/locales/ms.json`. The language comes from `?lang=`, then the last
  choice, then the browser, then `config/app.json`.
- Values that may change live in `config/app.json`: the examples offered (paths under `fixtures/`), the typing delay
  before a check, the largest file accepted, the default language, links and chain settings.
- Look: a source sheet on a dark bench. Each finding is a tag hung on its line (in the margin on wide screens, under
  the line on narrow ones), with the problem, the fix and the official docs link. The register lists the eight rules
  with counts and filters the sheet; a file with no errors gets a "Cleared" stamp. Fonts are Archivo and JetBrains
  Mono, served from the site (`@fontsource`), so no request leaves the page.
- Dependency versions in `web/package.json` are exact. The wallet providers from the scaffold stay in `main.tsx` for
  the anchor flow.

## Consequences

- The gate builds and tests `web/` (typecheck, vitest with jsdom, Vite build).
- A new rule needs its English text in the catalog and its Malay text in `i18n/ms.json`, or the tests fail.
- Parser error messages come from `@solidity-parser/parser` and stay in English; the label around them is translated.

## Rollback

Revert the commits that add `web/src` beyond the scaffold and `config/app.json`. The detail templates can stay: the
CLI output is the same either way.
