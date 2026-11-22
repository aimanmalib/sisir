# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). `SisirLedger` cannot be upgraded: a fix to a deployed
contract is a new deployment, listed here with its new address.

## [Unreleased]

### Added

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
- Static site image with nginx, a deploy script with rollback, and a health watch.
- README, `AI_USAGE.md`, contributing guide, security policy, code of conduct, and decision records in
  `docs/decisions/`.
