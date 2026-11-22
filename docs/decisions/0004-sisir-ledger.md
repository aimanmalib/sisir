# 0004. SisirLedger: anchors only from quantum-ready accounts, one head-only decode of pqcKeyStatus

- Status: accepted
- Date: 2026-11-22

## Context

The playground and the `sisir anchor` command record a report on the QoreChain testnet. The record should come from an
account that is ready for Q-Day, so the contract has to read the account's post-quantum key from the PQC Key Status
precompile (`0x…0a02`). Since v3.2.4 the precompile answers `(bool registered, uint8 algorithmId, bytes pubkey, bool
possessionProven)`; the docs ask contracts that trust the key to check the fourth value. Where the precompile is not
active the call succeeds and returns no data.

## Decision

- `anchor(bytes32 reportHash, bytes32 sourceHash, uint16 findings)` reverts with `NotQuantumReady(account)` unless the
  sender is `registered` with `possessionProven`. A zero `reportHash` is rejected. The event is `Anchored`;
  `anchorOf(id)` and `latest(limit)` (newest first) read the record.
- The precompile is called with a low-level `staticcall`. A failed call or an answer shorter than 160 bytes (the
  smallest valid four-value answer) counts as not ready.
- The answer is decoded once, as `(bool, uint8, uint256, bool)`. The third head word is the offset of `pubkey`, and it
  must be 128. The older three-value answer has the offset at 96, and without this check its `pubkey` length word is
  read as `possessionProven = true`. The forge test `test_legacyThreeValueAnswerIsRejected` failed before the check.
- The key bytes are not read: `registered` and `possessionProven` are what the docs define as trust. A second decode
  for the key would also be flagged by Sisir's own S003, which expects every decode of the answer to read both fields.
- No owner, no pause, no upgrade, no `payable`. Block number and timestamp are stored as `uint256` so the contract has
  no narrowing casts.
- Compiler 0.8.28 (cancun), forge-std v1.16.2 as a submodule, both pinned in `contracts/foundry.toml` and
  `.gitmodules`.

## Consequences

- Tests use a stand-in precompile etched with `vm.etch`: registered and proven, registered without proof, no key,
  empty answer, no code, a reverting precompile, the three-value answer, and fuzzing of hashes and key states.
- `sisir contracts/src` reports 0 findings.
- A defect cannot be patched in place. The fix is a new deployment, a new address in `config/app.json`, a CHANGELOG
  entry and a new decision record.

## Rollback

Remove `contracts/` and the forge-std submodule (`git rm contracts/lib/forge-std` and its `.gitmodules` entry). The
gate runs forge only when `contracts/foundry.toml` exists, so the CLI gate is unchanged.
