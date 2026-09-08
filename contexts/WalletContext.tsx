"use client";

import { createContext, useCallback, useContext, useReducer, type ReactNode } from "react";
import type { WalletId, WalletState } from "@/types/wallet";
import { generateFakeAddress } from "@/lib/utils";

type Action =
  | { type: "OPEN_MODAL" }
  | { type: "CLOSE_MODAL" }
  | { type: "CONNECT_START"; walletId: WalletId }
  | { type: "CONNECT_SUCCESS"; address: string }
  | { type: "DISCONNECT" };

const initialState: WalletState = {
  status: "idle",
  walletId: null,
  address: null,
  isModalOpen: false,
};

function reducer(state: WalletState, action: Action): WalletState {
  switch (action.type) {
    case "OPEN_MODAL":
      return { ...state, isModalOpen: true };
    case "CLOSE_MODAL":
      return { ...state, isModalOpen: false };
    case "CONNECT_START":
      return { ...state, status: "connecting", walletId: action.walletId };
    case "CONNECT_SUCCESS":
      return { ...state, status: "connected", address: action.address, isModalOpen: false };
    case "DISCONNECT":
      return { ...initialState };
    default:
      return state;
  }
}

interface WalletContextValue extends WalletState {
  openModal: () => void;
  closeModal: () => void;
  connect: (walletId: WalletId) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const CONNECT_DELAY_MS = 1500;

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const openModal = useCallback(() => dispatch({ type: "OPEN_MODAL" }), []);
  const closeModal = useCallback(() => dispatch({ type: "CLOSE_MODAL" }), []);

  const connect = useCallback((walletId: WalletId) => {
    dispatch({ type: "CONNECT_START", walletId });
    setTimeout(() => {
      dispatch({ type: "CONNECT_SUCCESS", address: generateFakeAddress() });
    }, CONNECT_DELAY_MS);
  }, []);

  const disconnect = useCallback(() => dispatch({ type: "DISCONNECT" }), []);

  return (
    <WalletContext.Provider
      value={{ ...state, openModal, closeModal, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return ctx;
}
