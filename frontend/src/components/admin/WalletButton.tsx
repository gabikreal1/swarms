"use client";

import { Wallet, Unplug, Loader2, AlertTriangle } from "lucide-react";
import { useWallet } from "@/lib/wallet-context";
import { formatAddress } from "@/lib/format";

export function WalletButton() {
  const { address, isConnecting, error, connect, disconnect, isCorrectChain } = useWallet();

  if (isConnecting) {
    return (
      <button
        disabled
        className="flex items-center gap-2 w-full rounded-lg border border-border px-3 py-2 text-sm text-muted"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting...
      </button>
    );
  }

  if (address && !isCorrectChain) {
    return (
      <div className="space-y-1">
        <button
          onClick={connect}
          className="flex items-center gap-2 w-full rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-sm text-yellow-500 hover:bg-yellow-500/10 transition-colors"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="truncate">{formatAddress(address)}</span>
        </button>
        <p className="px-1 text-[10px] text-yellow-500">Switch to Arc Testnet</p>
      </div>
    );
  }

  if (address) {
    return (
      <div className="flex items-center gap-2 w-full rounded-lg border border-green/30 bg-green/5 px-3 py-2 text-sm">
        <span className="h-2 w-2 rounded-full bg-green shrink-0" />
        <span className="text-foreground truncate flex-1">{formatAddress(address)}</span>
        <button
          onClick={disconnect}
          className="text-muted hover:text-foreground transition-colors"
          title="Disconnect"
        >
          <Unplug className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        onClick={connect}
        className="flex items-center gap-2 w-full rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground hover:border-accent/30 transition-colors"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </button>
      {error && <p className="px-1 text-[10px] text-red-500">{error}</p>}
    </div>
  );
}
