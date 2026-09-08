"use client";

import { useWallet } from "@/contexts/WalletContext";
import { Modal } from "@/components/ui/Modal";
import { WalletOptionButton } from "@/components/wallet/WalletOptionButton";
import { WALLET_OPTIONS } from "@/lib/mockData";

export function WalletModal() {
  const { isModalOpen, closeModal, status, walletId, connect } = useWallet();

  return (
    <Modal isOpen={isModalOpen} onClose={closeModal} title="Connect a wallet">
      <p className="mb-4 text-sm text-white/50">
        Choose a wallet to connect. This is a demo experience — no real wallet
        connection or on-chain transaction is made.
      </p>
      <div className="flex flex-col gap-2">
        {WALLET_OPTIONS.map((option) => (
          <WalletOptionButton
            key={option.id}
            option={option}
            status={status}
            isActive={walletId === option.id}
            onClick={connect}
          />
        ))}
      </div>
    </Modal>
  );
}
