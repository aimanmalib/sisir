# Testnet setup

Gets Sisir's accounts ready on the QoreChain testnet, deploys `SisirLedger` and anchors a report with it. This is not part of the
published CLI and has its own lockfile. See decisions [0012](../../docs/decisions/0012-testnet-account-setup.md) and
[0013](../../docs/decisions/0013-ledger-deploy-and-anchor.md).

```sh
cd scripts/testnet
npm ci
export SISIR_ACCOUNTS=/absolute/path/outside/the/repo/accounts.json   # mode 600
npm run native -- status   # balance, key and window of each account
npm run native -- fund     # one transfer from the funder to the project account
npm run native -- key      # register the project account's ML-DSA-87 key with proof of possession
(cd ../../contracts && forge build)
npm run native -- deploy   # deploy SisirLedger through a one-transaction EVM window
npm run native -- anchor fixtures/workshop   # the keyless account is refused, then the project account anchors
```

Values are in [`config/testnet.json`](../../config/testnet.json). What was sent is recorded in
`evidence/testnet.json` at the repository root; `deploy` also sets `contracts.sisirLedger` in `config/app.json`. `npm test` runs offline.
