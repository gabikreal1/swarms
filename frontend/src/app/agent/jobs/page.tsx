"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  Gavel,
  Clock,
  Tag,
  Users,
} from "lucide-react";
import { fetchJobs } from "@/lib/api";
import type { JobFeedItem } from "@/lib/api";
import { formatUSDC, formatAddress } from "@/lib/format";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TableSkeleton } from "@/components/admin/Skeleton";
import { BidModal } from "@/components/agent/BidModal";
import { useWallet } from "@/lib/wallet-context";

export default function AgentBrowseJobs() {
  const { address } = useWallet();
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [bidJob, setBidJob] = useState<JobFeedItem | null>(null);

  // Filters
  const [status, setStatus] = useState("0"); // default to open
  const [tags, setTags] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");

  const loadJobs = useCallback(
    async (append = false, nextCursor?: string) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const filters: Record<string, string> = { limit: "20" };
        if (status) filters.status = status;
        if (tags) filters.tags = tags;
        if (budgetMin) filters.budget_min = budgetMin;
        if (budgetMax) filters.budget_max = budgetMax;
        if (nextCursor) filters.cursor = nextCursor;

        const res = await fetchJobs(filters);
        setJobs(append ? (prev) => [...prev, ...res.data] : res.data);
        setCursor(res.nextCursor);
        setTotal(res.total);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [status, tags, budgetMin, budgetMax]
  );

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const walletLower = address?.toLowerCase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Jobs</h1>
        <p className="text-sm text-muted mt-1">
          Find jobs and place bids — {total} total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Filter className="h-4 w-4 text-muted" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-transparent text-sm outline-none text-foreground"
          >
            <option value="" className="bg-card">All Statuses</option>
            <option value="0" className="bg-card">Open</option>
            <option value="1" className="bg-card">In Progress</option>
            <option value="2" className="bg-card">Delivered</option>
            <option value="3" className="bg-card">Completed</option>
            <option value="4" className="bg-card">Disputed</option>
            <option value="5" className="bg-card">Validating</option>
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 flex-1 max-w-xs">
          <Search className="h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Filter by tags..."
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 w-36">
          <input
            type="number"
            placeholder="Min USDC"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 w-36">
          <input
            type="number"
            placeholder="Max USDC"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-foreground placeholder:text-muted"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-500">
          {error}
        </div>
      )}

      {/* Job Cards */}
      {loading ? (
        <TableSkeleton rows={6} />
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-6 py-16 text-center">
          <Search className="h-8 w-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">No jobs found matching your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const deadlineDate = new Date(job.deadline * 1000);
            const isExpired = deadlineDate < new Date();
            const expanded = expandedId === job.id;
            const alreadyBid =
              walletLower &&
              (job.bids ?? []).some((b) => b.bidder.toLowerCase() === walletLower);

            return (
              <div
                key={job.id}
                className="rounded-xl border border-border bg-card overflow-hidden hover:border-border transition-colors"
              >
                {/* Card header */}
                <div
                  onClick={() => setExpandedId(expanded ? null : job.id)}
                  className="px-5 py-4 cursor-pointer hover:bg-card-hover transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-muted font-mono mt-0.5">#{job.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed">{job.description}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {(job.tags ?? []).slice(0, 4).map((t) => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                          >
                            {t}
                          </span>
                        ))}
                        {(job.tags?.length ?? 0) > 4 && (
                          <span className="text-[10px] text-muted">
                            +{job.tags.length - 4}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={job.status} />
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted" />
                      )}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {job.bids?.length ?? 0} bids
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span className={isExpired ? "text-red-500" : ""}>
                        {deadlineDate.toLocaleDateString()}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {formatAddress(job.poster)}
                    </span>
                  </div>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div className="border-t border-border bg-background px-5 py-4 space-y-4">
                    <p className="text-sm text-foreground">{job.description}</p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="rounded-lg border border-border bg-card px-3 py-2">
                        <span className="text-muted block">Poster</span>
                        <span className="font-mono">{formatAddress(job.poster)}</span>
                      </div>
                      <div className="rounded-lg border border-border bg-card px-3 py-2">
                        <span className="text-muted block">Deadline</span>
                        <span className={isExpired ? "text-red-500" : ""}>
                          {deadlineDate.toLocaleString()}
                        </span>
                      </div>
                      <div className="rounded-lg border border-border bg-card px-3 py-2">
                        <span className="text-muted block">Bids</span>
                        <span>{job.bids?.length ?? 0}</span>
                      </div>
                      <div className="rounded-lg border border-border bg-card px-3 py-2">
                        <span className="text-muted block">Dispute</span>
                        <span>{job.hasDispute ? "Yes" : "No"}</span>
                      </div>
                    </div>

                    {/* Existing bids */}
                    {(job.bids?.length ?? 0) > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-medium text-muted uppercase">
                          Existing Bids ({job.bids!.length})
                        </span>
                        <div className="space-y-1.5">
                          {job.bids!.map((bid) => (
                            <div
                              key={bid.id}
                              className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${
                                walletLower && bid.bidder.toLowerCase() === walletLower
                                  ? "border-accent/30 bg-accent/5"
                                  : "border-border bg-card"
                              }`}
                            >
                              <span className="font-mono text-accent">
                                {formatAddress(bid.bidder)}
                              </span>
                              <span className="font-mono font-medium">
                                {formatUSDC(parseFloat(bid.price))}
                              </span>
                              {bid.deliveryTime > 0 && (
                                <span className="text-muted">
                                  {Math.round(bid.deliveryTime / 86400)}d delivery
                                </span>
                              )}
                              <span className="flex-1" />
                              {walletLower &&
                                bid.bidder.toLowerCase() === walletLower && (
                                  <span className="rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-medium">
                                    Your Bid
                                  </span>
                                )}
                              {bid.accepted && (
                                <span className="rounded-full bg-green/10 text-green px-2 py-0.5 text-[10px] font-medium">
                                  Accepted
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bid button */}
                    {job.status === "open" && (
                      <div className="flex justify-end pt-2">
                        {!address ? (
                          <span className="text-xs text-muted">
                            Connect wallet to place a bid
                          </span>
                        ) : alreadyBid ? (
                          <span className="flex items-center gap-1.5 text-xs text-accent">
                            <Gavel className="h-3.5 w-3.5" />
                            You already bid on this job
                          </span>
                        ) : (
                          <button
                            onClick={() => setBidJob(job)}
                            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-accent-hover transition-colors"
                          >
                            <Gavel className="h-4 w-4" />
                            Place Bid
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {cursor && (
        <div className="flex justify-center">
          <button
            onClick={() => loadJobs(true, cursor)}
            disabled={loadingMore}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground hover:border-accent/30 transition-colors disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            Load More
          </button>
        </div>
      )}

      {/* Bid Modal */}
      {bidJob && (
        <BidModal
          job={bidJob}
          onClose={() => setBidJob(null)}
          onSuccess={() => loadJobs()}
        />
      )}
    </div>
  );
}
