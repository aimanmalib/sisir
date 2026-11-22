# 0003. Start the playground from the create-qorechain-dapp viem-wagmi template

- Status: accepted
- Date: 2026-11-22

## Context

The Quantum Pass category asks entries to use `create-qorechain-dapp`, connect QoreX, deploy on testnet and complete
one hybrid-signed transaction. Judges check the scaffold by hand, so the first commit of `web/` has to be the plain
output of the scaffolder, and the exact command has to be on record.

`create-qorechain-dapp` 0.14.0 (the `latest` tag on npm on 2026-11-22) ships seven templates. Two are web apps:

- `fullstack-web`: Vite, React and `@qorechain/sdk`, reading balances and tokenomics. No wallet.
- `viem-wagmi`: Vite, React, wagmi and RainbowKit with the QoreX wallet (`@qorechain/qorex-rainbowkit`), the chain
  definitions from `@qorechain/evm`, and the EVM authorisation window helpers.

The playground needs a QoreX connection and an "Anchor this report" flow that sends an EVM transaction under an open
EVM authorisation window. Only `viem-wagmi` has both.

## Decision

Scaffold `web/` with the `viem-wagmi` template, from the repository root, on 2026-11-22:

```sh
npx create-qorechain-dapp@0.14.0 web --template viem-wagmi --network testnet --package-manager npm --yes --no-install
```

- Node 22.23.5, npm registry tarball `create-qorechain-dapp-0.14.0.tgz`, shasum
  `409243f9205f78c4297bca09a256aa9b1ad45e21`.
- Commit `25dbb74` holds the output unchanged. The scaffolder also writes `web/.env` as a copy of
  `web/.env.example` (one empty `VITE_WALLETCONNECT_PROJECT_ID`). It is not tracked, because `.env*` files never go into
  the repository.
- The only difference from the template folder in the npm package is `"name": "web"` in `web/package.json`, which
  the scaffolder sets from the target folder name.
- `web/` keeps its own `package.json` and lock file, separate from the CLI package at the root. Later commits pin exact
  versions and add the playground on top of the scaffold. They never rewrite the scaffold commit.

## How to check

Run the same command in an empty folder, extract the scaffold commit next to it, and compare:

```sh
git -C <repo> archive 25dbb74 web | tar -x -C <tmp>
diff -r -x node_modules -x .env <empty-folder>/web <tmp>/web
```

The two folders should match. The `.env` copy is excluded because it is not tracked.

## Consequences

- The playground starts with QoreX, wagmi, RainbowKit and the EVM window helpers already wired.
- The template README notes that QoreX does not yet expose EVM signing methods. The anchor flow is designed around that
  limit, and the end-to-end test uses `@qorechain/qorex-wallet-mock`. The README will
  say what was tested with the mock.
- The template reads the chain REST API through a dev proxy because that API sends no CORS headers. The playground
  reads anchors over the EVM JSON-RPC endpoint, which does send CORS headers, so the static site needs no proxy.

## How to undo

Delete `web/` in a new commit and scaffold again with another template or version, recording the new command in a
record that supersedes this one. Do not amend or rewrite commit `25dbb74` once it is pushed.
