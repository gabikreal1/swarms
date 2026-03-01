"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { Search, Filter, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { fetchAgents } from "@/lib/api";
import type { AgentDirectoryEntry } from "@/lib/api";
import { formatAddress, formatPercent } from "@/lib/format";
import { AgentStatusBadge } from "@/components/admin/StatusBadge";
import { TableSkeleton } from "@/components/admin/Skeleton";

export default function AdminAgents() {
  const [agents, setAgents] = useState<AgentDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [expandedAddr, setExpandedAddr] = useState<string | null>(null);

  // Filters
  const [capabilities, setCapabilities] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const loadAgents = useCallback(async (append = false, nextCursor?: string) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    try {
      const filters: Record<string, string> = { limit: "20" };
      if (capabilities) filters.capabilities = capabilities;
      if (statusFilter) filters.status = statusFilter;
      if (nextCursor) filters.cursor = nextCursor;

      const res = await fetchAgents(filters);
      setAgents(append ? (prev) => [...prev, ...res.data] : res.data);
      setCursor(res.nextCursor);
      setTotal(res.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [capabilities, statusFilter]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Agents</h1>
        <p className="text-sm text-muted mt-1">Registered marketplace agents — {total} total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <Filter className="h-4 w-4 text-muted" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-sm outline-none text-foreground"
          >
            <option value="" className="bg-card">All Statuses</option>
            <option value="active" className="bg-card">Active</option>
            <option value="inactive" className="bg-card">Inactive</option>
            <option value="banned" className="bg-card">Banned</option>
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 flex-1 max-w-xs">
          <Search className="h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Filter by capabilities..."
            value={capabilities}
            onChange={(e) => setCapabilities(e.target.value)}
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
        <TableSkeleton rows={6} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted uppercase tracking-wide">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 w-36">Address</th>
                <th className="px-4 py-3">Capabilities</th>
                <th className="px-4 py-3 w-28">Reputation</th>
                <th className="px-4 py-3 w-20 text-center">Jobs</th>
                <th className="px-4 py-3 w-24">Success</th>
                <th className="px-4 py-3 w-24">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted">
                    No agents found matching your filters
                  </td>
                </tr>
              ) : (
                agents.map((agent) => (
                  <Fragment key={agent.address}>
                    <tr
                      onClick={() => setExpandedAddr(expandedAddr === agent.address ? null : agent.address)}
                      className="hover:bg-card-hover transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name || "Unnamed"}</span>
                          {expandedAddr === agent.address ? (
                            <ChevronUp className="h-3 w-3 text-muted" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-muted" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">{formatAddress(agent.address)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities.slice(0, 3).map((c) => (
                            <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{c}</span>
                          ))}
                          {agent.capabilities.length > 3 && (
                            <span className="text-[10px] text-muted">+{agent.capabilities.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent"
                              style={{ width: `${Math.min((agent.reputation || agent.successRate * 100) / 10, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono w-8 text-right">{agent.reputation || (agent.completedJobs > 0 ? Math.round(agent.successRate * 100) : 0)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{agent.completedJobs}</td>
                      <td className="px-4 py-3 text-xs">
                        {agent.successRate > 0 ? formatPercent(agent.successRate) : "—"}
                      </td>
                      <td className="px-4 py-3"><AgentStatusBadge status={agent.status} /></td>
                    </tr>
                    {expandedAddr === agent.address && (
                      <tr>
                        <td colSpan={7} className="bg-background px-6 py-4 border-t border-border">
                          <div className="space-y-3">
                            <p className="text-xs font-medium text-muted uppercase tracking-wide">Performance by Tag</p>
                            {agent.performanceByTag && agent.performanceByTag.length > 0 ? (
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {agent.performanceByTag.map((p) => (
                                  <div key={p.tag} className="rounded-lg border border-border bg-card px-3 py-2">
                                    <span className="text-xs text-accent">{p.tag}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-sm font-medium">{p.jobs} jobs</span>
                                      <span className="text-xs text-muted">{formatPercent(p.successRate)} success</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted">No performance data yet</p>
                            )}
                            <div className="text-xs">
                              <span className="text-muted">Full address: </span>
                              <span className="font-mono">{agent.address}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {agent.capabilities.map((c) => (
                                <span key={c} className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">{c}</span>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {cursor && (
        <div className="flex justify-center">
          <button
            onClick={() => loadAgents(true, cursor)}
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
