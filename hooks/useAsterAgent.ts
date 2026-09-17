"use client";

import { useCallback, useState } from "react";
import { useAccount, useSignTypedData, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";

import { encryptSecret } from "@/lib/exchange/crypto";
import { sendAster } from "@/lib/exchange/relay";
import { ExchangeError } from "@/lib/exchange/types";
import { approvalQuery, buildApproval, createAgentWallet } from "@/lib/exchange/aster/agent";
import { ASTER_PATHS } from "@/lib/exchange/aster/requests";
import { nextNonce } from "@/lib/exchange/aster/signing";
import {
  belongsTo,
  clearAgent,
  isUsable,
  loadAgent,
  saveAgent,
  type StoredAgent,
} from "@/lib/exchange/aster/session";
import type { AsterNetwork } from "@/lib/exchange/aster/endpoints";

/**
 * Approving this terminal to trade an Aster account, once.
 *
 * The whole flow is four steps and one wallet prompt: make a delegated agent
 * wallet, have the user's own wallet sign an authorisation naming it, send that
 * to Aster, and keep the agent key encrypted under the user's passphrase. After
 * this the owner's wallet is never asked again - the agent signs every order.
 */

export type AgentStatus =
  | "idle"
  | "switching-chain"
  | "awaiting-signature"
  | "registering"
  | "saving";

interface UseAsterAgent {
  agent: StoredAgent | null;
  /** True when there is an approval that is current AND belongs to the wallet
   *  connected right now. */
  ready: boolean;
  status: AgentStatus;
  error: string | null;
  approve: (passphrase: string) => Promise<void>;
  revoke: () => void;
}

export function useAsterAgent(userId: string | null, network: AsterNetwork = "mainnet"): UseAsterAgent {
  const { address, chainId } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

  const [status, setStatus] = useState<AgentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Keyed state read during render rather than loaded in an effect, matching
  // `useInstrument`. An effect would render once with no approval before
  // filling it in, and that first frame is the one where the terminal decides
  // whether to ask the user to approve - so it would flash the approval prompt
  // at someone who has already approved. `undefined` is the unread marker,
  // because `null` is a legitimate userId for a signed-out browser.
  const [state, setState] = useState<{
    key: string | null | undefined;
    agent: StoredAgent | null;
  }>({ key: undefined, agent: null });

  if (state.key !== userId) {
    setState({ key: userId, agent: loadAgent(userId) });
  }

  const agent = state.key === userId ? state.agent : null;
  const setAgent = useCallback(
    (next: StoredAgent | null) => setState({ key: userId, agent: next }),
    [userId]
  );

  const approve = useCallback(
    async (passphrase: string) => {
      setError(null);

      if (!address) {
        setError("Connect the wallet that holds your Aster funds first.");
        return;
      }
      if (!passphrase) {
        setError("Choose a passphrase. It encrypts the trading key in this browser.");
        return;
      }

      try {
        // Aster signs main-wallet authorisations under chain 56, and MetaMask
        // refuses to sign typed data whose domain chainId is not the chain it
        // is currently on. Switching first turns an opaque wallet rejection
        // into an ordinary, expected prompt.
        if (chainId !== bsc.id) {
          setStatus("switching-chain");
          await switchChainAsync({ chainId: bsc.id });
        }

        // Generated here and never sent anywhere: Aster is told the ADDRESS,
        // and the key behind it stays in this browser.
        const wallet = createAgentWallet();
        const approval = buildApproval({
          user: address,
          agentAddress: wallet.address,
          nonce: nextNonce(),
        });

        setStatus("awaiting-signature");
        const signature = await signTypedDataAsync({
          domain: approval.typedData.domain,
          types: { Message: approval.typedData.types.Message },
          primaryType: "Message",
          message: approval.typedData.message as { msg: string },
        });

        setStatus("registering");
        await sendAster({
          method: "POST",
          path: ASTER_PATHS.registerAgent,
          query: approvalQuery(approval, signature),
          testnet: network === "testnet",
        });

        // Encrypt only after Aster has accepted. Storing first would leave a
        // key behind for an approval that does not exist, and the terminal
        // would then sign orders the venue rejects as unauthorised.
        setStatus("saving");
        const record: StoredAgent = {
          user: address,
          address: wallet.address,
          expiresAt: Number(Object.fromEntries(approval.entries).expired),
          network,
          key: await encryptSecret(wallet.privateKey, passphrase),
        };

        saveAgent(record, userId);
        setAgent(record);
      } catch (caught) {
        setError(describeFailure(caught));
      } finally {
        setStatus("idle");
      }
    },
    [address, chainId, network, setAgent, signTypedDataAsync, switchChainAsync, userId]
  );

  const revoke = useCallback(() => {
    clearAgent(userId);
    setAgent(null);
  }, [setAgent, userId]);

  return {
    agent,
    ready: isUsable(agent) && belongsTo(agent, address ?? null),
    status,
    error,
    approve,
    revoke,
  };
}

/**
 * Turns a failure into something a trader can act on.
 *
 * A rejected signature is the common case and is not an error worth alarming
 * anyone about - people change their mind at the wallet prompt. The venue's own
 * messages are passed through, since `sendAster` has already translated the
 * ones worth translating.
 */
function describeFailure(caught: unknown): string {
  if (caught instanceof ExchangeError) return caught.message;

  const message = caught instanceof Error ? caught.message : String(caught);

  if (/user rejected|denied|rejected the request/i.test(message)) {
    return "Signature cancelled. Nothing was approved.";
  }
  if (/chain|network/i.test(message)) {
    return "Switch your wallet to BNB Chain to sign the approval, then try again.";
  }
  return message || "Could not complete the approval.";
}
