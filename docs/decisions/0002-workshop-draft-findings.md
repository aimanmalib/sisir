# 0002. Report two findings on the workshop draft, not three

- Status: accepted
- Date: 2026-11-22

## Context

The plan asked for at least three true findings when Sisir runs on the first draft of the workshop 2 audit vault
(`fixtures/workshop/QDayVault_v0_buggy.sol`), and zero error-level findings on the fixed version.

With the eight rules S001 to S008, Sisir reports two findings on the draft, and both are true:

- S003 on line 29: the guardian key from `pqcKeyStatus` is used without checking `registered` or
  `possessionProven`. The workshop audit notes list this as a fix the auditor did not flag.
- S007 on line 31: the signed message is `abi.encodePacked(to, amount)`, so a signature can be replayed. This is
  finding 4 in the workshop audit notes.

It reports nothing on the fixed version.

The rest of the draft's audit findings (reentrancy, an open `setGuardian`, an ignored transfer result, no balance
check, gas cost) are general Solidity issues. The scope of Sisir excludes rules that other tools already cover, and the
rule list is fixed at S001 to S008.

## Decision

- Keep the eight rules as they are. Do not add a rule, and do not split one finding into two, to reach a count.
- Record the measured result: two true findings on the draft, zero on the fixed version.
  `test/workshop.test.ts` pins the exact findings and lines, so the number in any public text comes from that test.
- Every public claim about the workshop vault says "two findings", each tied to its line in the audit notes.

## Consequences

- The goal of three findings on the draft is not met. The goal of zero error-level findings on the fixed version is met.
- The finding that the auditor did not flag (S003) stays the clearest example of Sisir as a complement to the auditor.

## How to undo

If a later change to an existing rule finds a third true issue on the draft, update `test/workshop.test.ts`,
`docs/rules.md` and `fixtures/workshop/README.md` together, and mark this record as superseded.
