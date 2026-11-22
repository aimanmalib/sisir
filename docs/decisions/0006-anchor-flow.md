# 0006. Anchoring from the playground: a hybrid-signed window through QoreX, then SisirLedger.anchor

- Status: accepted
- Date: 2026-11-22

## Context

The playground should let a visitor record an inspection on the QoreChain testnet with the QoreX wallet. On QoreChain
an EVM transaction is accepted only from an account with a registered ML-DSA-87 key and an open EVM window, and the
window is opened by a native-lane message signed with both keys (`MsgOpenEVMWindow`).

What QoreX answers today (read from `@qorechain/qorex-types` 0.1.0 and `@qorechain/qorex-rainbowkit` 0.1.0):

- Native lane: `enable`, `getKey` and `signAndBroadcast`. `signAndBroadcast` takes protobuf messages, adds the
  ML-DSA-87 layer, broadcasts and reports `shield: "shielded"` when the committed transaction carries the layer.
- EVM lane: `eth_chainId`, `eth_accounts`, `eth_requestAccounts`, `wallet_switchEthereumChain`. Signing methods,
  `eth_sendTransaction` included, are refused with "QoreX: EVM method ... not yet supported". They are announced.
- The testnet REST API sends no CORS headers; the EVM RPC does. The site is static, with no proxy.

## Decision

- The report is hashed by `src/report/hash.ts`, shared with the CLI through the alias `@sisir/report`.
  `sourceHash` is keccak256 of the file (one file) or of the per-file hashes in path order (several).
  `reportHash` is keccak256 of a canonical JSON with schema `sisir-report/1`: files with their hash, and every
  finding by rule, level and position. Messages are left out, so English and Malay give the same hash. `findings`
  is the count, capped at 65,535 (`uint16`). In the browser the path is the file name; `sisir anchor` uses the same
  name for a single file, so both give the same hash.
- The ledger band has three steps. 1: connect QoreX through RainbowKit. 2: `signAndBroadcast` one
  `MsgOpenEVMWindow`, scoped to the ledger address alone (`allowedTargets`), for `anchor.windowMaxTxs` calls and
  `anchor.windowBlocks` blocks, with `maxValue` = gas limit × fee cap for each call. This is the hybrid-signed
  transaction. 3: `SisirLedger.anchor(reportHash, sourceHash, findings)` through wagmi.
- With QoreX as it is today, step 3 is refused by the wallet. The page says so in plain words and does not hide the
  step: the window in step 2 is already on chain. When QoreX ships EVM signing, step 3 works with no change here.
- The message is encoded by hand (protobuf fields 1 to 6 of `qorechain.pqc.v1.MsgOpenEVMWindow`, the same numbers
  the kit's codec uses) after `checkOpenEvmWindowParams` from `@qorechain/evm/window` checks the bounds. This avoids
  bundling `@qorechain/sdk` and its cosmjs tree for one message.
- Recent anchors are read with `latest(anchor.recentLimit)` over the public EVM RPC. No wallet needed.
- Every value that may change is in `config/app.json` (`chain.nativeId`, the `anchor` block). Until
  `contracts.sisirLedger` is set, the buttons are off and the page says the ledger is not deployed yet.
- wagmi, RainbowKit and the anchor code load in their own chunk after the inspector (`React.lazy`), which halves
  the main bundle.
- Tests: unit tests for the hash and the message bytes; Playwright runs the flow against
  `@qorechain/qorex-wallet-mock` 0.1.0 in both profiles (`current` and `planned`) and a fake chain answered inside
  the test (REST and EVM JSON-RPC), so CI never touches the testnet. The real QoreX is not driven by a test.

## Known gap

QoreX derives the native account at `m/44'/118'` and the EVM account at `m/44'/60'` (the mock documents the same).
A window opened from the native lane covers the native account's address; an EVM transaction from a different
address is refused for want of a window. The page shows the address the window opened for. A native-lane path that
calls the contract directly (`MsgCrossVMCall` to an EVM target) would avoid this; it is not used until it is shown
to work on the testnet.

## Rollback

Remove `web/src/anchor/`, `AnchorPanel.tsx`, `RecentAnchors.tsx`, `ledger.css`, the `anchor` keys in
`web/locales` and the `ledger` section in `App.tsx`; put the providers back in `main.tsx`. The CLI and the hash
module are not affected.
