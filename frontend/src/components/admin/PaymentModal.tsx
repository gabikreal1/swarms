"use client";

import { useEffect } from "react";
import { X, CreditCard, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { formatAddress } from "@/lib/format";

interface PaymentModalProps {
  amount: string;
  receiver: string;
  endpoint: string;
  onApprove: () => void;
  onCancel: () => void;
  status: "pending" | "signing" | "confirming" | "success" | "error";
  error?: string | null;
  txHash?: string | null;
}

export function PaymentModal({
  amount,
  receiver,
  endpoint,
  onApprove,
  onCancel,
  status,
  error,
  txHash,
}: PaymentModalProps) {
  // Auto-close on success
  useEffect(() => {
    if (status === "success") {
      const t = setTimeout(onCancel, 1500);
      return () => clearTimeout(t);
    }
  }, [status, onCancel]);

  const isLoading = status === "signing" || status === "confirming";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="rounded-xl border border-border bg-card p-6 w-full max-w-md space-y-5 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-accent" />
            <h3 className="font-semibold text-lg">Payment Required</h3>
          </div>
          {!isLoading && status !== "success" && (
            <button onClick={onCancel} className="text-muted hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <p className="text-sm text-muted">
          The <span className="text-accent font-mono">{endpoint}</span> endpoint requires a micropayment.
        </p>

        {/* Details */}
        <div className="rounded-lg bg-background p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Amount</span>
            <span className="font-mono text-accent">{amount} USDC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">To</span>
            <span className="font-mono text-muted">{formatAddress(receiver)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Network</span>
            <span className="text-foreground">Arc Testnet</span>
          </div>
        </div>

        {/* Status content */}
        {status === "success" && (
          <div className="flex items-center gap-2 text-green text-sm">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Payment confirmed!</p>
              {txHash && (
                <p className="font-mono text-xs text-muted mt-1 truncate">{txHash}</p>
              )}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-2 text-red-500 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>{error || "Transaction failed"}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {(status === "pending" || status === "error") && (
            <>
              <button
                onClick={onApprove}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
              >
                {status === "error" ? "Try Again" : "Approve Payment"}
              </button>
              <button
                onClick={onCancel}
                className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted hover:text-foreground hover:border-accent/30 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted w-full justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {status === "signing" ? "Confirm in your wallet..." : "Waiting for confirmation..."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
