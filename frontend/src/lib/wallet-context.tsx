"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { ensureArcTestnet, getProvider, type Eip1193Provider } from "./wallet";
import { NETWORK } from "./constants";

interface WalletState {
  address: string | null;
  chainId: number | null;
  isConnecting: boolean;
  error: string | null;
  isCorrectChain: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null,
  chainId: null,
  isConnecting: false,
  error: null,
  isCorrectChain: false,
  connect: async () => {},
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProviderRef] = useState<Eip1193Provider | null>(null);

  const connect = useCallback(async () => {
    const eth = getProvider();
    if (!eth) {
      setError("No wallet detected. Install MetaMask.");
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      const accounts = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts[0]) throw new Error("No account returned");

      await ensureArcTestnet(eth);

      const chainHex = (await eth.request({
        method: "eth_chainId",
      })) as string;

      setProviderRef(eth);
      setAddress(accounts[0]);
      setChainId(parseInt(chainHex, 16));
      localStorage.setItem("swarms_wallet_connected", "1");
    } catch (e: any) {
      setError(e?.message || "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setError(null);
    setProviderRef(null);
    localStorage.removeItem("swarms_wallet_connected");
  }, []);

  // Auto-reconnect on mount if previously connected
  useEffect(() => {
    if (localStorage.getItem("swarms_wallet_connected") !== "1") return;
    const eth = getProvider();
    if (!eth) return;

    (async () => {
      try {
        const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
        if (!accounts[0]) {
          localStorage.removeItem("swarms_wallet_connected");
          return;
        }
        const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
        setProviderRef(eth);
        setAddress(accounts[0]);
        setChainId(parseInt(chainHex, 16));
      } catch {
        localStorage.removeItem("swarms_wallet_connected");
      }
    })();
  }, []);

  // Listen for wallet events on the resolved provider
  useEffect(() => {
    if (!provider) return;

    const handleAccounts = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setAddress(null);
        setChainId(null);
      } else {
        setAddress(accs[0]);
      }
    };

    const handleChain = (chainHex: unknown) => {
      setChainId(parseInt(chainHex as string, 16));
    };

    provider.on("accountsChanged", handleAccounts);
    provider.on("chainChanged", handleChain);

    return () => {
      provider.removeListener("accountsChanged", handleAccounts);
      provider.removeListener("chainChanged", handleChain);
    };
  }, [provider]);

  const isCorrectChain = chainId === NETWORK.chainId;

  return (
    <WalletContext.Provider
      value={{ address, chainId, isConnecting, error, isCorrectChain, connect, disconnect }}
    >
      {children}
    </WalletContext.Provider>
  );
}
