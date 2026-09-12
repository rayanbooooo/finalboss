"use client";

import { useExchange } from "@/contexts/ExchangeContext";
import { ConnectExchangeModal } from "@/components/terminal/ConnectExchangeModal";
import { UnlockModal } from "@/components/terminal/UnlockModal";

/**
 * Mounts the key-entry modals once for the whole terminal.
 *
 * They used to live inside the Settings panel, which meant Settings was the
 * only place that could open them - so the account-mode switch, the balances
 * panel and the positions table could do nothing but mention Settings in prose
 * and leave the user to find it.
 */
export function ExchangeModals() {
  const { connectOpen, unlockOpen, closeConnect, closeUnlock } = useExchange();

  return (
    <>
      <ConnectExchangeModal isOpen={connectOpen} onClose={closeConnect} />
      <UnlockModal isOpen={unlockOpen} onClose={closeUnlock} />
    </>
  );
}
