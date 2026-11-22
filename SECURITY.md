# Security policy

Sisir is a linter, and `SisirLedger` runs on the QoreChain Diana testnet only. Test QOR has no value, but I still want
to hear about anything that breaks what Sisir or the contract promises.

## Reporting

Please do not open a public issue. E-mail hello@sasateguh.com with "Sisir security" in the subject; it reaches only
the maintainer. Say what you found, how to reproduce it, and what it lets an attacker do. I aim to answer within 7 days.

## In scope

- `contracts/src/SisirLedger.sol`: anchoring from an account that is not quantum-ready, changing or removing an
  anchor, or making the contract hold value.
- The CLI: a crafted `.sol` file or path that makes Sisir read or write outside the paths it was given, or run code.
- The playground: a crafted file that runs script in the page, or a way to make it send a transaction the user did not
  approve in QoreX.
- Anything in the repository or its history that looks like a secret.

## Out of scope

- A finding that Sisir misses or reports wrongly. That is a bug in a heuristic; please open an issue with the
  "Wrong or missed finding" form.
- The QoreChain chain, its precompiles, the Cross-VM bridge and the QoreX wallet. Report those to QoreChain.
