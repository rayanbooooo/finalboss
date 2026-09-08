"use client";

import { useConnect, useConnectors } from "wagmi";
import { Modal } from "@/components/ui/Modal";
import { WalletOptionButton } from "@/components/wallet/WalletOptionButton";
import { useWalletModal } from "@/contexts/WalletModalContext";

export function WalletModal() {
  const { isOpen, close } = useWalletModal();
  const connectors = useConnectors();
  const { mutate, isPending, error, variables } = useConnect();

  return (
    <Modal isOpen={isOpen} onClose={close} title="Connect a wallet">
      <p className="mb-4 text-sm text-white/50">
        Connect your real wallet to trade. This only reads your address and
        balance — no transaction or fund transfer is requested.
      </p>

      <div className="flex flex-col gap-2">
        {connectors.map((connector) => {
          const pendingConnector = variables?.connector;
          const pending =
            isPending &&
            !!pendingConnector &&
            "uid" in pendingConnector &&
            pendingConnector.uid === connector.uid;
          return (
            <WalletOptionButton
              key={connector.uid}
              connector={connector}
              pending={pending}
              onClick={() => mutate({ connector }, { onSuccess: () => close() })}
            />
          );
        })}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-rose-400">{error.message}</p>
      ) : (
        <p className="mt-4 text-xs text-white/35">
          Don&apos;t have a wallet yet? Get{" "}
          <a
            href="https://metamask.io/download"
            target="_blank"
            rel="noreferrer"
            className="text-violet-300 hover:underline"
          >
            MetaMask
          </a>{" "}
          or{" "}
          <a
            href="https://phantom.app/download"
            target="_blank"
            rel="noreferrer"
            className="text-violet-300 hover:underline"
          >
            Phantom
          </a>
          .
        </p>
      )}
    </Modal>
  );
}
