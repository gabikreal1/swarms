"use client";

import { useEffect, useState, useCallback } from "react";
import { Gavel, Loader2, Wallet, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { fetchJobs } from "@/lib/api";
import type { JobFeedItem, JobBid } from "@/lib/api";
import { formatUSDC, formatAddress } from "@/lib/format";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TableSkeleton } from "@/components/admin/Skeleton";
import { useWallet } from "@/lib/wallet-context";

interface MyBid {
  job: JobFeedItem;
  bid: JobBid;
}

export default function AgentMyBids() {
  const { address } = useWallet();
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBids = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch a large batch and filter for our bids
      const res = await fetchJobs({ limit: "100" });
      const walletLower = address.toLowerCase();

      const found: MyBid[] = [];
      for (const job of res.data) {
        for (const bid of job.bids ?? []) {
          if (bid.bidder.toLowerCase() === walletLower) {
            found.push({ job, bid });
          }
        }
      }

      // Sort by bid creation (most recent first)
      found.sort((a, b) => b.bid.createdAt - a.bid.createdAt);
      setMyBids(found);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadBids();
  }, [loadBids]);

  if (!address) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Bids</h1>
          <p className="text-sm text-muted mt-1">Track your bids across the marketplace</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Wallet className="h-8 w-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">Connect your wallet to view your bids</p>
          <p className="text-xs text-muted mt-1">
            Use the wallet button in the sidebar to connect
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bids</h1>
          <p className="text-sm text-muted mt-1">
            {myBids.length} bid{myBids.length !== 1 ? "s" : ""} from{" "}
            {formatAddress(address)}
          </p>
        </div>
        <button
          onClick={loadBids}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground hover:border-accent/30 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Gavel className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-500">
          {error}
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={4} />
      ) : myBids.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Gavel className="h-8 w-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">No bids placed yet</p>
          <a
            href="/agent/jobs"
            className="inline-block mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
          >
            Browse Jobs
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {myBids.map(({ job, bid }) => {
            const deadlineDate = new Date(job.deadline * 1000);
            const isExpired = deadlineDate < new Date();

            return (
              <div
                key={`${job.id}-${bid.id}`}
                className="rounded-xl border border-border bg-card overflow-hidden"
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted font-mono">Job #{job.id}</span>
                        <StatusBadge status={job.status} />
                        {bid.accepted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green/10 text-green px-2 py-0.5 text-[10px] font-medium">
                            <CheckCircle2 className="h-3 w-3" />
                            Accepted
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{job.description}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {(job.tags ?? []).slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Bid details */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                    <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
                      <span className="text-muted block">Your Bid</span>
                      <span className="font-mono font-semibold text-accent">
                        {formatUSDC(parseFloat(bid.price))}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <span className="text-muted block">Delivery Time</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted" />
                        {bid.deliveryTime > 0
                          ? `${Math.round(bid.deliveryTime / 86400)} days`
                          : "Not specified"}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <span className="text-muted block">Deadline</span>
                      <span className={isExpired ? "text-red-500" : ""}>
                        {deadlineDate.toLocaleDateString()}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border bg-background px-3 py-2">
                      <span className="text-muted block">Competition</span>
                      <span>
                        {(job.bids?.length ?? 1) - 1} other bid
                        {(job.bids?.length ?? 1) - 1 !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
