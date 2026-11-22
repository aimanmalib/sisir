# Rules

Sisir checks Solidity source for mistakes that are specific to QoreChain's post-quantum precompiles and
cross-VM bridge. Every rule is a syntax heuristic over one file. It does not follow data across functions
or contracts, and it does not run the code. Sisir complements the official QoreChain contract auditor and
does not replace it.

Rule text, level and documentation link live in `src/rules/catalog.json`. Precompile addresses and the
`pqcKeyStatus` return fields live in `src/rules/qorechain.json`. Each rule has positive and negative cases
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
