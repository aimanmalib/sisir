# 0012. One command gets the project account ready on the testnet, and funds it only once

- Status: accepted
- Date: 2026-11-23

## Context

`SisirLedger.anchor` accepts a call only from an account with a registered ML-DSA-87 key and a proof of possession,
and on QoreChain an EVM transaction needs that key and an open EVM window anyway. Before the ledger can be deployed
or used, the project account needs gas money and a key.

The entry's two projects share one testnet phrase. The funded account (index 0) belongs to the other project, which
registers its key itself. Sisir may move gas money from it to its own project account one time, and must not touch it
otherwise. Index 10 is Sisir's project account. Index 11 stays without a key on purpose: it is the case where the
ledger must refuse.

The accounts are unified eth-native accounts (one secp256k1 key with Ethereum address derivation), which cosmjs's
standard signer cannot sign for. The chain SDK `@qorechain/sdk` 0.14.0 has an eth-native signer, the registration
message and the proof of possession.

## Decision

- The setup lives in `scripts/testnet/`, a package with its own lockfile, like `web/`. The published CLI does not
  depend on the chain SDK, so `npx github:aimanmalib/sisir` stays small.
- `npm run native -- status | fund | key`:
  - `status` prints the balance, key state and window of the funder, project and keyless accounts.
  - `fund` sends `funding.amountQor` from the funder to the project account in one hybrid-signed bank send. It
    refuses when `evidence/testnet.json` already records a transfer, when the funder's key is not registered and
    proven (that step belongs to the funder's own project; Sisir never registers it), and when the funder holds less
    than `funding.funderMinQor`. It does nothing while the project holds `funding.fundBelowQor` or more.
  - `key` registers the project account's key with `MsgRegisterPQCKeyV2`, a proof of possession bound to the account
    and chain id, and the account's compressed secp256k1 key (checked with `validateClassicalKeyForSender` first). It
    is the only transaction signed classically. It stops before paying a fee when another key, or an unproven key,
    is already there, and it refuses the keyless account. After sending it reads the status back and fails unless the
    key is registered and proven.
- Every value that may change is in `config/testnet.json`: REST endpoint, denom, gas limit per message kind, gas
  price, waits, account indexes, amounts and the evidence path. The chain id comes from `config/app.json`.
- The phrase is read from the file named by `SISIR_ACCOUNTS`: an absolute path outside the repository, mode 600.
  Output and `evidence/testnet.json` hold addresses, amounts, heights, gas used and transaction hashes only.
- Gas limits are fixed (400,000 for a send, 500,000 for a registration) at 0.15 uqor per gas, a fee under 0.1 QOR,
  so no hybrid transaction is simulated before it is signed. The first real run records the gas used in the evidence;
  a limit that proves wrong gets its own decision.

## Consequences

- With the funder ready, the order before deploying the ledger is `fund`, then `key`, then `status` as the proof.
- Tests run against an in-memory chain that refuses a classical transaction that is not a key registration and a
  hybrid transaction from an account with no key, a fake REST endpoint, and the SDK signer offline with a phrase made
  inside the test. Removing any of the five guards in `fundOnce` and `registerProjectKey` turns a test red. CI never
  touches the testnet.
- Opening the EVM window, deploying `SisirLedger` and `sisir anchor` come next and are decided separately.

## How to undo

Delete `scripts/testnet/`, `config/testnet.json` and the testnet block in `scripts/gerbang-ujian.sh`. A transfer or
key registration already sent stays on chain; its record stays in `evidence/testnet.json`.
