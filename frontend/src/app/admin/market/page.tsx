"use client";

import { useEffect, useState } from "react";
import { TrendingUp, BarChart3, Scale, RefreshCw } from "lucide-react";
import { fetchTrends, fetchSupplyDemand, fetchClusters } from "@/lib/api";
import type { TrendingTag, SupplyDemand, ClusterStats } from "@/lib/api";
import { formatUSDC, formatNumber, formatPercent, formatDuration } from "@/lib/format";
import { SupplyDemandBar } from "@/components/admin/SupplyDemandBar";
import { KpiSkeleton } from "@/components/admin/Skeleton";

const SIGNAL_CONFIG: Record<string, { label: string; className: string }> = {
  STRONG_UP: { label: "STRONG UP", className: "bg-green/10 text-green" },
  UP: { label: "UP", className: "bg-green/10 text-green" },
  STABLE: { label: "STABLE", className: "bg-yellow-500/10 text-yellow-500" },
  DOWN: { label: "DOWN", className: "bg-red-500/10 text-red-500" },
  STRONG_DOWN: { label: "STRONG DOWN", className: "bg-red-500/10 text-red-500" },
};

export default function AdminMarket() {
  const [trends, setTrends] = useState<TrendingTag[]>([]);
  const [supplyDemand, setSupplyDemand] = useState<SupplyDemand[]>([]);
  const [clusters, setClusters] = useState<ClusterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [t, sd, c] = await Promise.allSettled([
        fetchTrends("week"),
        fetchSupplyDemand(),
        fetchClusters(),
      ]);
      if (t.status === "fulfilled") setTrends(t.value.data);
      if (sd.status === "fulfilled") setSupplyDemand(sd.value.data);
      if (c.status === "fulfilled") setClusters(c.value.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Market Health</h1>
          <p className="text-sm text-muted mt-1">Trends, supply/demand, and tag analytics</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground hover:border-accent/30 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-500">
          {error}
        </div>
      )}

      {/* Trending Tags */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Trending Tags</h2>
        </div>
        {loading && trends.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
          </div>
        ) : trends.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted">
            No trend data available yet
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {(() => {
              const sorted = [...trends].sort((a, b) => b.momentumScore - a.momentumScore);
              const maxBudget = Math.max(...trends.map((x) => x.avgBudget), 1);
              return sorted.map((t, i) => {
                const signal = SIGNAL_CONFIG[t.signal] ?? { label: t.signal, className: "bg-card text-muted" };
                const barWidth = (t.avgBudget / maxBudget) * 100;

                return (
                  <div
                    key={t.tag}
                    className={`flex items-center gap-4 px-4 py-3 hover:bg-card-hover transition-colors ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    {/* Rank */}
                    <span className={`text-lg font-bold w-8 text-center shrink-0 ${i < 3 ? "text-accent" : "text-muted"}`}>
                      {i + 1}
                    </span>

                    {/* Tag + signal */}
                    <div className="w-36 shrink-0">
                      <span className="text-sm font-medium text-foreground">{t.tag}</span>
                      <span className={`ml-2 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-medium align-middle ${signal.className}`}>
                        {signal.label}
                      </span>
                    </div>

                    {/* Momentum bar */}
                    <div className="flex-1 min-w-0">
                      <div className="h-2 rounded-full bg-border overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${t.momentumScore >= 0 ? "bg-green" : "bg-red-500"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 shrink-0 text-xs text-muted">
                      <span className="w-16 text-right font-mono">{t.momentumScore.toFixed(2)}</span>
                      <span className="w-12 text-right">{t.currentPeriodJobs} jobs</span>
                      <span className="w-24 text-right">{formatUSDC(t.avgBudget / 1e6)} avg</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}
      </section>

      {/* Supply vs Demand */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Supply vs Demand</h2>
        </div>
        {supplyDemand.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted">
            No supply/demand data available yet
          </div>
        ) : (() => {
          const groups: Record<string, typeof supplyDemand> = {
            undersupplied: supplyDemand.filter((s) => s.trend === "undersupplied"),
            balanced: supplyDemand.filter((s) => s.trend === "balanced"),
            oversupplied: supplyDemand.filter((s) => s.trend === "oversupplied"),
          };
          const cols: { key: string; label: string; color: string; bg: string }[] = [
            { key: "undersupplied", label: "Undersupplied", color: "text-red-500", bg: "bg-red-500" },
            { key: "balanced", label: "Balanced", color: "text-yellow-500", bg: "bg-yellow-500" },
            { key: "oversupplied", label: "Oversupplied", color: "text-green", bg: "bg-green" },
          ];

          return (
            <div className="grid grid-cols-3 gap-3">
              {cols.map((col) => (
                <div key={col.key} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`h-2 w-2 rounded-full ${col.bg}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                    <span className="text-[10px] text-muted ml-auto">{groups[col.key].length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {groups[col.key].length === 0 ? (
                      <span className="text-xs text-muted">None</span>
                    ) : groups[col.key].map((sd) => (
                      <div key={sd.tag} className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{sd.tag}</span>
                        <span className="text-muted font-mono">{sd.ratio.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* Tag Clusters */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Tag Clusters</h2>
        </div>
        {clusters.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted">
            No cluster data available yet
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted uppercase tracking-wide">
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3 w-20 text-center">Jobs</th>
                  <th className="px-4 py-3 w-28">Avg Budget</th>
                  <th className="px-4 py-3 w-28">Success Rate</th>
                  <th className="px-4 py-3 w-28">Avg Time</th>
                  <th className="px-4 py-3 w-28">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clusters.map((c) => (
                  <tr key={c.tag} className="hover:bg-card-hover transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm text-accent font-medium">{c.tag}</span>
                      {c.category && <span className="text-xs text-muted ml-2">{c.category}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">{c.jobCount}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatUSDC(c.avgBudget / 1e6)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green"
                            style={{ width: `${c.successRate * 100}%` }}
                          />
                        </div>
                        <span className="text-xs w-10 text-right">{formatPercent(c.successRate)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDuration(c.avgCompletionTime)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{formatUSDC(c.totalVolume / 1e6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
