# Workshop 2 audit vault

These two files are the before and after of the workshop 2 audit demo. They are copied unchanged.

- Repository: https://github.com/qorechain/build-before-qday (Apache-2.0, credited in `NOTICE`)
- Commit: `2af5c77999d5027ef41bb160bd4759da4a38a43a`
- Paths: `workshop-2/01-qday-vault/audit/QDayVault_v0_buggy.sol` and `workshop-2/01-qday-vault/audit/QDayVault_v1_fixed.sol`
  (the fixed file is the same as `workshop-2/01-qday-vault/src/QDayVault.sol` at that commit)

| File | sha256 |
|---|---|
| `QDayVault_v0_buggy.sol` | `7b6427b2539c2fb3c069188edc66705cd456adcad1d72e4c819aa7202f0ca6eb` |
| `QDayVault_v1_fixed.sol` | `4bcb1c5d4f020328621f180951d27d2875653757f59d25463d664c82d17b92f9` |

`test/workshop.test.ts` checks these hashes and the findings below.

## What Sisir reports

| File | Rule | Line | Matches in the workshop audit notes (`audit/README.md`) |
|---|---|---|---|
| `QDayVault_v0_buggy.sol` | S003 | 29 | "One thing the auditor did not flag, and we fixed anyway": the guardian's key must exist and have a proof of possession |
| `QDayVault_v0_buggy.sol` | S007 | 31 | Finding 4: the signed message `abi.encodePacked(to, amount)` can be replayed |
| `QDayVault_v1_fixed.sol` | none | | every finding above is fixed |

The other draft findings in the audit notes (reentrancy, the open `setGuardian`, the ignored transfer result, the
balance check, the gas cost of the key status call) are general Solidity issues. Sisir has no rule for them on purpose:
other tools already cover them. `docs/decisions/0002-workshop-draft-findings.md` explains why the count is two.
