# Rules

Sisir checks Solidity source for mistakes that are specific to QoreChain's post-quantum precompiles and
cross-VM bridge. Every rule is a syntax heuristic over one file. It does not follow data across functions
or contracts, and it does not run the code. Sisir complements the official QoreChain contract auditor and
does not replace it.

Rule text, level and documentation link live in `src/rules/catalog.json`. Precompile addresses, the
`pqcKeyStatus` return fields and the bridge function name live in `src/rules/qorechain.json`. Each rule has positive and negative cases
in `fixtures/rules/<id>/`; a line marked `// expect <id>` is where the rule must report.

## S001 precompile-address-case (warning)

Source: https://build.qorechain.io/faq ("Write precompile addresses in lowercase").

Catches a 40-digit hex literal that equals a QoreChain precompile address and contains an upper-case hex
digit, for example `0x0000000000000000000000000000000000000A01`.

Does not catch:
- short forms such as `address(0xA01)`, because a short hex number is often not meant as an address;
- addresses built at run time or passed in as parameters;
- addresses inside strings or comments.

## S002 precompile-empty-return (error)

Source: https://docs.qorechain.io/developer-guide/evm-precompiles ("Guard against empty return data").

Catches a low-level `call`, `staticcall` or `delegatecall` to a precompile whose return data is captured
and then used, when the same function never reads `<data>.length`. A precompile that is not active returns
success with empty data.

The target counts as a precompile when it is a literal address, a conversion such as `address(...)` or
`IQorePQC(...)`, or a constant, state variable or local variable whose initial value is one of those.

Does not catch:
- a length check that is too small for the decode that follows (any read of `.length` counts as a check);
- targets that arrive as parameters or are assigned after their declaration;
- calls made in inline assembly;
- typed interface calls, which revert on empty data and are safe.

## S003 pqc-key-status-unchecked (error)

Source: https://docs.qorechain.io/developer-guide/evm-precompiles ("A contract that must trust the key has
to check the fourth").

Catches a `pqcKeyStatus` result where `registered` or `possessionProven` is skipped in the tuple or never
read again in the same function. For a low-level call it also catches an `abi.decode` of the return data
with fewer than four types, which drops `possessionProven`.

Does not catch:
- a field that is read but does not gate the action (for example only logged);
- a result passed to another function that is expected to check it;
- results stored in a struct or state variable and checked elsewhere.

When the raw answer is decoded more than once, the decodes are judged together: a field counts as read if any
decode reads it. A head-only decode of `registered` followed by a full decode that reads `possessionProven` is not
flagged (`fixtures/rules/S003/negative-decode-twice.sol`). Short decodes are reported only when no decode reaches
`possessionProven`.

A result that is ignored entirely is not reported, because nothing trusts it.

## S004 pqc-verify-result-ignored (error)

Source: https://docs.qorechain.io/build-before-qday/workshop-2 (the workshop vault reverts unless
`pqcVerify` returns true).

Catches a typed `pqcVerify` call whose result is discarded or stored in a local that is never read. For a
low-level call to the `pqcVerify` precompile it catches code that keeps only the success flag: a call that
succeeds says nothing about whether the signature is valid.

Does not catch:
- a result that is read but not used to stop the action;
- a result assigned to a state variable or returned through several layers;
- calls made in inline assembly.

## S005 bridge-call-kind (error)

Source: https://docs.qorechain.io/developer-guide/cross-vm-reference ("Plain `CALL` only, no value").

Catches a `staticcall` or `delegatecall` to the cross-VM bridge at `0x…0901`, and any call to the bridge that
sends value: a `value` call option on a low-level or typed call, or `transfer` and `send`. A call counts as a
bridge call when its target resolves to the bridge address (same rules as S002) or when its payload encodes
`executeCrossVMCall`. A literal `value: 0` is allowed.

Does not catch:
- a typed call through an interface that declares the bridge function `view`, which compiles to a static call;
- targets that arrive as parameters with a payload the rule cannot read;
- calls made in inline assembly.

## S006 bridge-payload-concat (warning)

Source: https://docs.qorechain.io/build-before-qday/workshop-3 (the note goes inside a JSON string, so it
must be checked first).

Catches a `string.concat`, `bytes.concat` or `abi.encodePacked` that contains a string literal and a `string`
or `bytes` parameter, inside a function that calls the bridge directly or through other functions of the
same contract, when that function never checks the parameter. A check is a read of the parameter in an
`if`, loop or ternary condition, or a call that passes it on and does not lead to the bridge, such as
`require(bytes(note).length <= 140)` or `_checkNote(bytes(note))`.

Does not catch:
- a check that is too weak, for example a length limit that still allows `"` or `\`;
- a parameter copied into a local before it is concatenated;
- payloads built in one function and sent to the bridge from another contract.

Any call that does not lead to the bridge counts as a check, so a helper that only logs the parameter hides
the finding.

## S007 pqc-message-unbound (error)

Source: https://docs.qorechain.io/build-before-qday/workshop-2 (the audit of the workshop vault: a signed
message of only the recipient and amount can be replayed).

Catches a `pqcVerify` call, typed or encoded with `abi.encodeCall` or `abi.encodeWithSignature`, whose
message does not include all three of `block.chainid`, `this` and a changing counter. The rule follows the
message through locals, through parameters of public and external functions, and into helper functions of
the same contract that return it, as the workshop vault does with `withdrawalMessage`. A counter is a state
variable, or a mapping entry, that the contract changes outside the constructor with `++`, `--`, `+=`, `-=`
or an assignment that reads its old value.

Does not catch, or stays silent on:
- a message that passes through a parameter of an internal or private function, or a call to another
  contract or library, because the rule cannot see what it holds;
- a counter that is part of the message but never checked against the stored value;
- replay protection that marks each used message in a mapping instead of using a counter. Such code is
  reported as missing a counter.

## S008 value-to-precompile (error)

Source: https://docs.qorechain.io/developer-guide/evm-precompiles ("Do not send value to these addresses").

Catches a call that sends value to a precompile address other than the bridge: a `value` call option, or
`transfer` and `send` on the address. Value sent to the bridge is reported by S005, so one mistake gives one
finding. A literal `value: 0` is allowed.

Does not catch:
- value sent through `selfdestruct` or inline assembly;
- precompile addresses that arrive as parameters.

## On the workshop 2 audit vault

`fixtures/workshop/` holds the first draft and the fixed version of the workshop 2 audit vault, copied unchanged
(source commit and hashes in `fixtures/workshop/README.md`). `test/workshop.test.ts` checks the result:

| File | Errors | Warnings | Findings |
|---|---|---|---|
| `QDayVault_v0_buggy.sol` (first draft) | 2 | 0 | S003 line 29, S007 line 31 |
| `QDayVault_v1_fixed.sol` (fixed) | 0 | 0 | none |

Both draft findings match the workshop's own audit notes: S007 is finding 4 (the signed message can be replayed),
and S003 is the key check the notes list as fixed although the auditor did not flag it. The other draft findings in
those notes are general Solidity issues, which Sisir leaves to other tools.
