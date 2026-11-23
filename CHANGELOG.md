# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). `SisirLedger` cannot be upgraded: a fix to a deployed
contract is a new deployment, listed here with its new address.

## [Unreleased]

## [1.0.0] - 2026-11-23

### Changed

- CI pins `actions/checkout` v7.0.1 and `actions/setup-node` v7.1.0 by commit. Both run on Node 24.

### Fixed

- The testnet setup creates `evidence/` before its first write, so the first transfer is always recorded.

### Added

- `brand/sisir-cover.png`, the 1920 x 1080 cover image, drawn by `scripts/cover-image.mjs` from the site's colours,
  fonts and a real playground screenshot. Size and byte limit live in `config/app.json` `cover`.
- `SisirLedger` on `qorechain-diana` at `0xd457db8651842898ca63784dfc006b6d85dacc50` (block 10607847), set in
  `config/app.json`. Anchor 0 is the report of `fixtures/workshop`; the same anchor from the keyless account reverts
  with `NotQuantumReady`. Both are in `evidence/testnet.json`.
- `npm run native -- deploy` and `npm run native -- anchor [path]` in `scripts/testnet`, each EVM transaction through
  a one-transaction EVM window.
- Testnet setup in `scripts/testnet`: one transfer of gas money to the project account, its ML-DSA-87 key with
  proof of possession, and a status view. Values in `config/testnet.json`, record in `evidence/testnet.json`.
- `evidence/testnet.json`: the project account's funding transfer and its registered ML-DSA-87 key on
  `qorechain-diana`, with transaction hashes and heights.
- `sisir` CLI: lints `.sol` files and folders, prints text, `JSON` or `SARIF` 2.1.0, and exits 1 on error-level
  findings and 2 on a parse or usage error. Installs from GitHub with `npx github:aimanmalib/sisir`.
- Eight rules, S001 to S008, for QoreChain's post-quantum precompiles and Cross-VM bridge, each with the official page
  it comes from, positive and negative fixtures, and a list of what it does not catch in `docs/rules.md`.
- The workshop 2 audit vault, first draft and fixed version, as fixtures: two findings on the draft, none on the fix.
- Report and source hashes shared by the CLI and the playground (`sisir-report/1`).
- `SisirLedger` contract: anchors a report hash only from an account with a registered post-quantum key and proof of
  possession. No owner, pause, upgrade or payable function. 14 Foundry tests.
- Playground at https://sisir.sasateguh.com, started from `create-qorechain-dapp` 0.14.0 (`viem-wagmi` template): the
  same rule engine in the browser, English and Bahasa Melayu, QoreX through RainbowKit, and the anchor flow (an EVM
  access window opened with a hybrid-signed `MsgOpenEVMWindow`, then `SisirLedger.anchor`).
- GitHub Action (`action.yml`): runs Sisir on given paths, uploads `SARIF` to code scanning, fails on error-level
  findings. Sisir's own CI uses it.
- Static site image with nginx, a deploy script with rollback, and a health watch.
- README, `AI_USAGE.md`, contributing guide, security policy, code of conduct, and decision records in
  `docs/decisions/`.
- Link preview card `web/public/og.png` (1200 x 630), drawn by `scripts/og-image.mjs` from the default language's
  title and description, the colour tokens and the logo. The address and card size live in `config/app.json` `site`.
- The page head now names the share card: title, description, Open Graph and Twitter tags are filled at build time
  from `config/app.json` `site` and the default language's `meta` text. The image URL carries a hash of the card.

### Fixed

- S003 no longer flags a contract that decodes the raw `pqcKeyStatus` answer twice, for example the head first and
  the full answer after. All decodes of one answer are now judged together.
- Folder scans no longer skip a `lib`, `out` or `build` folder of your own, such as `contracts/lib/Math.sol`. These
  names are now skipped only inside a toolchain root (a folder with `foundry.toml`, `hardhat.config.*`,
  `truffle-config.js` or `package.json`). `node_modules` and `.git` are still skipped everywhere. The lists live in
  `src/cli/walk.json`.
- The wallet dialogs in the playground now fit a 320 px browser window on a computer. RainbowKit gave such a window its
  desktop dialog, at least 368 px wide, so the right side was cut off. Phones keep RainbowKit's bottom sheet unchanged.

[Unreleased]: https://github.com/aimanmalib/sisir/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/aimanmalib/sisir/releases/tag/v1.0.0
