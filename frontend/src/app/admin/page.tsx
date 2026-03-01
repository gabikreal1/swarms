"use client";

import { useEffect, useState } from "react";
import {
  Briefcase,
  CheckCircle2,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  RefreshCw,
} from "lucide-react";
import { fetchOverview, fetchJobs, fetchAgents } from "@/lib/api";
import type { MarketOverview, JobFeedItem, AgentDirectoryEntry } from "@/lib/api";
import { formatUSDC, formatNumber, formatPercent, formatDuration, formatAddress, percentChange } from "@/lib/format";
import { KpiCard } from "@/components/admin/KpiCard";
import { KpiSkeleton } from "@/components/admin/Skeleton";
import { StatusBadge } from "@/components/admin/StatusBadge";

export default function AdminOverview() {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [recentJobs, setRecentJobs] = useState<JobFeedItem[]>([]);
  const [recentAgents, setRecentAgents] = useState<AgentDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [ov, jobs, agents] = await Promise.allSettled([
        fetchOverview(),
        fetchJobs({ limit: "50" }),
        fetchAgents({ limit: "5" }),
      ]);

      const jobsData = jobs.status === "fulfilled" ? jobs.value.data : [];
      const agentsData = agents.status === "fulfilled" ? agents.value.data : [];

      // Use overview API data if it has real values, otherwise compute from jobs feed
      const ovData = ov.status === "fulfilled" ? ov.value.data : null;
      if (ovData && ovData.totalJobs > 0) {
        setOverview(ovData);
      } else if (jobsData.length > 0) {
        // Compute KPIs from jobs feed
        const completedJobs = jobsData.filter((j) => j.status === "completed");
        const totalBidVolume = jobsData.reduce((sum, j) => sum + (j.bids ?? []).reduce((s, b) => s + parseFloat(b.price), 0), 0);
        const uniqueBidders = new Set(jobsData.flatMap((j) => (j.bids ?? []).map((b) => b.bidder)));
        setOverview({
          totalJobs: jobs.status === "fulfilled" ? jobs.value.total : jobsData.length,
          totalCompletedJobs: completedJobs.length,
          totalVolume: totalBidVolume,
          activeAgents: uniqueBidders.size || agentsData.length,
          overallSuccessRate: jobsData.length > 0 ? completedJobs.length / jobsData.length : 0,
          avgCompletionTime: 0,
          periodComparison: { jobsThisWeek: jobsData.length, jobsLastWeek: 0, volumeThisWeek: totalBidVolume, volumeLastWeek: 0 },
        });
      }

      setRecentJobs(jobsData.slice(0, 5));
      setRecentAgents(agentsData);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, []);

  const pc = overview?.periodComparison;
  const jobsTrend = pc ? percentChange(pc.jobsThisWeek, pc.jobsLastWeek) : undefined;
  const volumeTrend = pc ? percentChange(pc.volumeThisWeek, pc.volumeLastWeek) : undefined;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted mt-1">System overview and monitoring</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && !overview ? (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : overview ? (
          <>
            <KpiCard
              label="Total Jobs"
              value={formatNumber(overview.totalJobs)}
              icon={Briefcase}
              trend={jobsTrend}
              subtitle={pc ? `${pc.jobsThisWeek} this week` : undefined}
            />
            <KpiCard
              label="Completed"
              value={formatNumber(overview.totalCompletedJobs)}
              icon={CheckCircle2}
              subtitle={`${formatPercent(overview.overallSuccessRate)} success rate`}
            />
            <KpiCard
              label="Total Volume"
              value={formatUSDC(overview.totalVolume)}
              icon={DollarSign}
              trend={volumeTrend}
              subtitle={pc ? `${formatUSDC(pc.volumeThisWeek)} this week` : undefined}
            />
            <KpiCard
              label="Active Agents"
              value={formatNumber(overview.activeAgents)}
              icon={Users}
            />
            <KpiCard
              label="Success Rate"
              value={formatPercent(overview.overallSuccessRate)}
              icon={TrendingUp}
            />
            <KpiCard
              label="Avg Completion"
              value={formatDuration(overview.avgCompletionTime)}
              icon={Clock}
            />
          </>
        ) : null}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Jobs */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Recent Jobs</h2>
            <a href="/admin/jobs" className="text-xs text-accent hover:underline">View all</a>
          </div>
          <div className="divide-y divide-border">
            {recentJobs.length === 0 && !loading ? (
              <p className="px-5 py-8 text-sm text-muted text-center">No jobs found</p>
            ) : (
              recentJobs.map((job) => (
                <div key={job.id} className="px-5 py-3 flex items-center gap-3 hover:bg-card-hover transition-colors">
                  <span className="text-xs text-muted font-mono w-8">#{job.id}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{job.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {(job.tags ?? []).slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{t}</span>
                      ))}
                      {(job.bids?.length ?? 0) > 0 && (
                        <span className="text-[10px] text-muted">{job.bids!.length} bid{job.bids!.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Agents */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Recent Agents</h2>
            <a href="/admin/agents" className="text-xs text-accent hover:underline">View all</a>
          </div>
          <div className="divide-y divide-border">
            {recentAgents.length === 0 && !loading ? (
              <p className="px-5 py-8 text-sm text-muted text-center">No agents found</p>
            ) : (
              recentAgents.map((agent) => (
                <div key={agent.address} className="px-5 py-3 flex items-center gap-3 hover:bg-card-hover transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{agent.name || formatAddress(agent.address)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {agent.capabilities.slice(0, 3).map((c) => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">{agent.reputation}</p>
                    <p className="text-[10px] text-muted">reputation</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted text-center">
        Last updated: {lastRefresh.toLocaleTimeString()} — auto-refreshes every 60s
      </p>
    </div>
  );
}
