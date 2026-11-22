import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { qorechain, qorechainTestnet } from "@qorechain/evm";
import { qorexWallet } from "@qorechain/qorex-rainbowkit";
import { createConfig, http } from "wagmi";
import { config as app } from "./config.js";

// QoreX first, then any other injected (EIP-1193) wallet. Neither uses
// WalletConnect, so the project id is only a placeholder unless you add a
// WalletConnect-based wallet.
const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [() => qorexWallet({ pollAccountsOnFocus: true }), injectedWallet],
    },
  ],
  {
    appName: "Sisir",
    projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ?? "unused",
  },
);

// The testnet is listed first, so a fresh connection lands there.
export const config = createConfig({
  chains: [qorechainTestnet, qorechain],
  connectors,
  transports: {
    // The RPC is the one in config/app.json, so a node change needs no code change.
    [qorechainTestnet.id]: http(qorechainTestnet.id === app.chain.id ? app.chain.evmRpc : undefined),
    [qorechain.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}

/** The chain from config/app.json, narrowed to the chains configured above. */
export const appChainId: typeof qorechainTestnet.id | typeof qorechain.id =
  app.chain.id === qorechain.id ? qorechain.id : qorechainTestnet.id;
