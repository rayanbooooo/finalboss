import { createConfig, http } from "wagmi";
import { arbitrum, base, bsc, mainnet, optimism } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  // BNB Chain is here for one reason: Aster signs a main-wallet authorisation
  // under chain 56, and MetaMask refuses `eth_signTypedData_v4` when the typed
  // data's domain chainId does not match the chain the wallet is on. Without
  // bsc in this list the approval cannot be signed at all, and the failure
  // reads as a wallet error rather than a missing chain.
  chains: [mainnet, arbitrum, base, optimism, bsc],
  connectors: [
    injected({ target: "metaMask" }),
    injected({ target: "phantom" }),
    coinbaseWallet({ appName: "FinalBoss" }),
  ],
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [bsc.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
