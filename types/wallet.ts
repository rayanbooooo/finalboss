export type WalletId = "metamask" | "phantom" | "walletconnect";

export type WalletConnectionStatus = "idle" | "connecting" | "connected";

export interface WalletOption {
  id: WalletId;
  name: string;
  description: string;
}

export interface WalletState {
  status: WalletConnectionStatus;
  walletId: WalletId | null;
  address: string | null;
  isModalOpen: boolean;
}
