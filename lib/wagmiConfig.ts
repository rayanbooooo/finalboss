import { createConfig, http } from "wagmi";
import { arbitrum, base, mainnet, optimism } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum, base, optimism],
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
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
