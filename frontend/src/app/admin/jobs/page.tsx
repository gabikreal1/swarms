"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { Search, Filter, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { fetchJobs } from "@/lib/api";
import type { JobFeedItem } from "@/lib/api";
import { formatUSDC, formatAddress } from "@/lib/format";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TableSkeleton } from "@/components/admin/Skeleton";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "0", label: "Open" },
  { value: "1", label: "In Progress" },
  { value: "2", label: "Delivered" },
  { value: "3", label: "Completed" },
  { value: "4", label: "Disputed" },
  { value: "5", label: "Validating" },
];

export default function AdminJobs() {
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<number | string | null>(null);

  // Filters
  const [status, setStatus] = useState("");
  const [tags, setTags] = useState("");

  const loadJobs = useCallback(async (append = false, nextCursor?: string) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const filters: Record<string, string> = { limit: "20" };
      if (status) filters.status = status;
      if (tags) filters.tags = tags;
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
  }, [status, tags]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Jobs</h1>
        <p className="text-sm text-muted mt-1">All marketplace jobs — {total} total</p>
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
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-card">{o.label}</option>
            ))}
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
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-500">
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted uppercase tracking-wide">
                <th className="px-4 py-3 w-16">ID</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 w-32">Tags</th>
                <th className="px-4 py-3 w-28">Status</th>
                <th className="px-4 py-3 w-16 text-center">Bids</th>
                <th className="px-4 py-3 w-28">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted">
                    No jobs found matching your filters
                  </td>
                </tr>
              ) : (
                jobs.map((job) => {
                  const deadlineDate = new Date(job.deadline * 1000);
                  const isExpired = deadlineDate < new Date();
                  return (
                    <Fragment key={job.id}>
                      <tr
                        onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                        className="hover:bg-card-hover transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono text-muted">#{job.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-md">{job.description}</span>
                            {expandedId === job.id ? (
                              <ChevronUp className="h-3 w-3 text-muted shrink-0" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-muted shrink-0" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {(job.tags ?? []).slice(0, 2).map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{t}</span>
                            ))}
                            {(job.tags?.length ?? 0) > 2 && (
                              <span className="text-[10px] text-muted">+{job.tags.length - 2}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                        <td className="px-4 py-3 text-center">{job.bidCount ?? job.bids?.length ?? 0}</td>
                        <td className="px-4 py-3 text-xs text-muted">
                          <span className={isExpired ? "text-red-500" : ""}>
                            {deadlineDate.toLocaleDateString()}
                          </span>
                        </td>
                      </tr>
                      {expandedId === job.id && (
                        <tr>
                          <td colSpan={6} className="bg-background px-6 py-4 border-t border-border">
                            <div className="space-y-4 text-sm">
                              <p className="text-foreground">{job.description}</p>
                              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                                <div>
                                  <span className="text-muted block">Poster</span>
                                  <span className="font-mono">{formatAddress(job.poster)}</span>
                                </div>
                                <div>
                                  <span className="text-muted block">Deadline</span>
                                  <span className={isExpired ? "text-red-500" : ""}>
                                    {deadlineDate.toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted block">Dispute</span>
                                  <span>{job.hasDispute ? "Yes" : "No"}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {(job.tags ?? []).map((t) => (
                                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">{t}</span>
                                ))}
                              </div>
                              {(job.bids?.length ?? 0) > 0 && (
                                <div className="space-y-2">
                                  <span className="text-xs font-medium text-muted uppercase">Bids ({job.bids.length})</span>
                                  <div className="space-y-2">
                                    {job.bids.map((bid) => (
                                      <div key={bid.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                                        <span className="font-mono text-accent">{formatAddress(bid.bidder)}</span>
                                        <span className="font-mono font-medium">{formatUSDC(parseFloat(bid.price))}</span>
                                        <span className="text-muted flex-1 truncate">{bid.metadataURI}</span>
                                        {bid.accepted && (
                                          <span className="rounded-full bg-green/10 text-green px-2 py-0.5 text-[10px] font-medium">Accepted</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
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
    </div>
  );
}
