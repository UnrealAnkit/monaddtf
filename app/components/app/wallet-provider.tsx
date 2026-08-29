"use client";

// Site-wide wallet state. Lives in the ROOT layout so the connection (and the
// connect modal) are available from the landing pages and every /app route,
// and survive navigation. reconnectWallet() silently restores after a full
// page refresh without opening a wallet popup.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CHAIN_ID } from "@/lib/config";
import { connectWallet, ensureAlloyNetwork, getCurrentChainId, reconnectWallet } from "@/lib/folio";

/** localStorage flag: this browser connected before, so restore silently on load. */
const WALLET_KEY = "alloy-wallet-connected";

interface WalletCtx {
  address: string;
  isConnected: boolean;
  connecting: boolean;
  error: string;
  chainId: number | null;
  /** True once we know the wallet's chain and it matches Monad testnet. */
  isCorrectNetwork: boolean;
  /** Perform the actual wallet connect (opens the extension). */
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Prompt the wallet to switch to (or add) Monad testnet. */
  switchNetwork: () => Promise<void>;
  // --- connect-wallet modal ---
  isModalOpen: boolean;
  /** Open the modal. Pass a href to navigate to once the wallet connects. */
  openModal: (pendingHref?: string) => void;
  closeModal: () => void;
  pendingHref: string | null;
  clearPendingHref: () => void;
}

const Ctx = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError("");
    try {
      const addr = await connectWallet();
      setAddress(addr);
      localStorage.setItem(WALLET_KEY, "1");
      setChainId(await getCurrentChainId());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Could not connect. Is a wallet extension installed and unlocked?");
      throw e;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress("");
    setError("");
    localStorage.removeItem(WALLET_KEY);
  }, []);

  const switchNetwork = useCallback(async () => {
    setError("");
    try {
      await ensureAlloyNetwork();
      setChainId(await getCurrentChainId());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Could not switch network.");
      throw e;
    }
  }, []);

  const openModal = useCallback((href?: string) => {
    setError("");
    setPendingHref(href ?? null);
    setIsModalOpen(true);
  }, []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const clearPendingHref = useCallback(() => setPendingHref(null), []);

  // Silent restore after a refresh: only when this browser connected before,
  // and reconnectWallet never opens a wallet popup.
  useEffect(() => {
    if (!localStorage.getItem(WALLET_KEY)) return;
    reconnectWallet()
      .then(async (addr) => {
        if (addr) {
          setAddress(addr);
          setChainId(await getCurrentChainId());
        }
      })
      .catch(() => {});
  }, []);

  // Keep in sync with account/network changes made inside the wallet itself.
  useEffect(() => {
    const eth = (
      window as unknown as {
        ethereum?: { on?: (...a: unknown[]) => void; removeListener?: (...a: unknown[]) => void };
      }
    ).ethereum;
    if (!eth?.on) return;

    const onAccountsChanged = (accounts: unknown) => {
      const list = accounts as string[];
      setAddress(list[0] ?? "");
      if (!list[0]) localStorage.removeItem(WALLET_KEY);
    };
    const onChainChanged = (hex: unknown) => {
      setChainId(parseInt(hex as string, 16));
    };

    eth.on("accountsChanged", onAccountsChanged);
    eth.on("chainChanged", onChainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        address,
        isConnected: !!address,
        connecting,
        error,
        chainId,
        isCorrectNetwork: chainId === CHAIN_ID,
        connect,
        disconnect,
        switchNetwork,
        isModalOpen,
        openModal,
        closeModal,
        pendingHref,
        clearPendingHref,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWallet(): WalletCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet must be used within <WalletProvider>");
  return ctx;
}
