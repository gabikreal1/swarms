"use client";

import { useState } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, ORDER_BOOK_ABI } from "@/lib/constants";
import { getProvider } from "@/lib/wallet";
import type { JobFeedItem } from "@/lib/api";
import { formatAddress } from "@/lib/format";

interface BidModalProps {
  job: JobFeedItem;
  onClose: () => void;
  onSuccess: () => void;
}

type BidStatus = "idle" | "signing" | "confirming" | "success" | "error";

export function BidModal({ job, onClose, onSuccess }: BidModalProps) {
  const [price, setPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<BidStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const canSubmit = price && deliveryDays && status === "idle";

  async function handleSubmit() {
    const eth = getProvider();
    if (!eth) {
      setError("No wallet detected. Install MetaMask.");
      return;
    }

    setStatus("signing");
    setError(null);

    try {
      const browserProvider = new ethers.BrowserProvider(eth as any);
      const signer = await browserProvider.getSigner();

      const orderBook = new ethers.Contract(
        CONTRACT_ADDRESSES.OrderBook,
        ORDER_BOOK_ABI,
        signer
      );

      const priceWei = ethers.parseUnits(price, 6);
      const deliverySeconds = BigInt(Math.floor(parseFloat(deliveryDays) * 86400));

      setStatus("confirming");

      const tx = await orderBook.placeBid(
        job.id,
        priceWei,
        deliverySeconds,
        message || ""
      );

      setTxHash(tx.hash);
      await tx.wait();

      setStatus("success");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (e: any) {
      setStatus("error");
      const msg = e?.reason || e?.message || "Transaction failed";
      setError(msg.length > 120 ? msg.slice(0, 120) + "..." : msg);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Place Bid</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Job Summary */}
        <div className="px-5 py-3 border-b border-border bg-background/50">
          <p className="text-xs text-muted">Job #{job.id}</p>
          <p className="text-sm mt-1 line-clamp-2">{job.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-muted">by {formatAddress(job.poster)}</span>
            <span className="text-border">|</span>
            <span className="text-[10px] text-muted">{job.bids?.length ?? 0} existing bids</span>
          </div>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">
              Bid Price (USDC)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 500"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={status !== "idle"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">
              Delivery Time (days)
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              placeholder="e.g. 7"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
              disabled={status !== "idle"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50 transition-colors disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted block mb-1.5">
              Message <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Why you're the best fit for this job..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={status !== "idle"}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent/50 transition-colors resize-none disabled:opacity-50"
            />
          </div>
        </div>

        {/* Status / Error */}
        {error && (
          <div className="mx-5 mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-500 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {txHash && status !== "error" && (
          <div className="mx-5 mb-3 rounded-lg border border-green/30 bg-green/5 px-3 py-2 text-xs text-green flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">TX: {txHash}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={status === "signing" || status === "confirming"}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(status === "signing" || status === "confirming") && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            {status === "idle" && "Submit Bid"}
            {status === "signing" && "Sign in Wallet..."}
            {status === "confirming" && "Confirming..."}
            {status === "success" && "Bid Placed!"}
            {status === "error" && "Try Again"}
          </button>
        </div>
      </div>
    </div>
  );
}
