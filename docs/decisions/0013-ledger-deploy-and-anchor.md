# 0013. The ledger is deployed and the first report anchored from the testnet setup, not from the published CLI

- Status: accepted
- Date: 2026-11-23

## Context

`SisirLedger` must be on the testnet with one real anchor, and the ledger's refusal of an account without a proven
key must be shown too. On QoreChain every EVM transaction needs the sender's registered ML-DSA-87 key and an EVM
window opened by a hybrid-signed Native-lane message (`MsgOpenEVMWindow`). Opening a window advances the account's
EVM nonce. A window scoped with `allowedTargets` refuses contract creation. This was read from `@qorechain/sdk`
0.14.0 and `@qorechain/evm` 0.14.0, the current releases on 23 November 2026.

The project account (index 10) holds a proven key since decision 0012. The keyless account (index 11) holds no key
and no QOR, so it cannot open a window or pay for a transaction.

## Decision

- Two more commands in `scripts/testnet` (decision 0012), not a `sisir anchor` subcommand in the published CLI. The
  window needs the chain SDK and its signer, which `npx github:aimanmalib/sisir` should not install. The CLI and the
  playground keep computing the same hashes (`src/report/hash.ts`); the setup imports that module and the rule
  engine from `src/`, so there is still one engine.
- `npm run native -- deploy`: opens a window for one transaction with no target scope (a creation is not allowed in
  a scoped window), sized at `ledger.deployGas` × `anchor.maxFeePerGasWei`, reads the nonce after it, deploys the
  forge build output, reads the code back, records the deployment and the window in `evidence/testnet.json`
  (`ledger`) and writes the address to `config/app.json` `contracts.sisirLedger`. It refuses when the evidence or the
  config already names a ledger: the contract has no upgrade path, so a new version is its own decision.
- `npm run native -- anchor [path]` (default `ledger.defaultTarget`, `fixtures/workshop`): lints the path with the
  CLI's engine, then:
  1. the negative case: `eth_call` of the same `anchor` from the keyless account at a recorded block. It must revert
     with `NotQuantumReady`; anything else stops the run before a transaction is sent. Recorded with
     `expect: "revert"`. A sent transaction is not possible from this account, and a transfer to it would only add a
     second refusal by the chain before the contract is reached, which says nothing about the ledger.
  2. the anchor: `eth_call` from the project account first, then a window for one transaction scoped to the ledger
     address alone, then `anchor(reportHash, sourceHash, findings)`. The `Anchored` event gives the id. Recorded with
     `expect: "success"`, the EVM hash and the window's Native-lane hash.
- Paths in the report follow decision 0006 (the file name for one file, the path below the folder otherwise). The
  path written to the evidence must be relative to the repository root.
- New values live in `config/testnet.json` (`gas.openWindow`, `ledger.*`). Window length, gas limit of an anchor and
  the fee cap are the playground's (`anchor` in `config/app.json`). The tip is 12.5 gwei, the testnet's answer to
  `eth_maxPriorityFeePerGas` on 23 November 2026; with the 100 gwei base fee it fits the 112.5 gwei cap.

## Consequences

- Each run opens a fresh window and never widens or replaces a live one; a run stopped between the window and the
  transaction waits for that window to end (`anchor.windowBlocks` blocks).
- Tests run against one in-memory chain for both lanes that admits an EVM transaction only through a live window,
  refuses a creation or another recipient in a scoped window, and plays the ledger's `NotQuantumReady`. CI never
  touches the testnet.

## How to undo

Remove `src/ledger.ts`, `src/evm.ts`, `src/report.ts`, `src/artifact.ts`, their tests and the two commands in
`native.ts`, and the `ledger` block and `gas.openWindow` in `config/testnet.json`. A deployed ledger and its anchors
stay on chain; set `contracts.sisirLedger` back to `""` to turn the playground's ledger buttons off.
