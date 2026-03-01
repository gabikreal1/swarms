"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  CheckCircle2,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  RefreshCw,
  Search,
  Gavel,
} from "lucide-react";
import { fetchOverview, fetchJobs } from "@/lib/api";
import type { MarketOverview, JobFeedItem } from "@/lib/api";
import { formatUSDC, formatNumber, formatPercent, formatDuration, percentChange } from "@/lib/format";
import { KpiCard } from "@/components/admin/KpiCard";
import { KpiSkeleton } from "@/components/admin/Skeleton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useWallet } from "@/lib/wallet-context";

export default function AgentDashboard() {
  const { address } = useWallet();
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [openJobs, setOpenJobs] = useState<JobFeedItem[]>([]);
  const [myBidJobs, setMyBidJobs] = useState<JobFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [ov, jobs] = await Promise.allSettled([
        fetchOverview(),
        fetchJobs({ limit: "50" }),
      ]);

      const jobsData = jobs.status === "fulfilled" ? jobs.value.data : [];
      const ovData = ov.status === "fulfilled" ? ov.value.data : null;

      if (ovData && ovData.totalJobs > 0) {
        setOverview(ovData);
      } else if (jobsData.length > 0) {
        const completedJobs = jobsData.filter((j) => j.status === "completed");
        const totalBidVolume = jobsData.reduce(
          (sum, j) => sum + (j.bids ?? []).reduce((s, b) => s + parseFloat(b.price), 0),
          0
        );
        const uniqueBidders = new Set(jobsData.flatMap((j) => (j.bids ?? []).map((b) => b.bidder)));
        setOverview({
          totalJobs: jobs.status === "fulfilled" ? jobs.value.total : jobsData.length,
          totalCompletedJobs: completedJobs.length,
          totalVolume: totalBidVolume,
          activeAgents: uniqueBidders.size,
          overallSuccessRate: jobsData.length > 0 ? completedJobs.length / jobsData.length : 0,
          avgCompletionTime: 0,
          periodComparison: {
            jobsThisWeek: jobsData.length,
            jobsLastWeek: 0,
            volumeThisWeek: totalBidVolume,
            volumeLastWeek: 0,
          },
        });
      }

      setOpenJobs(jobsData.filter((j) => j.status === "open").slice(0, 5));

      if (address) {
        const addr = address.toLowerCase();
        setMyBidJobs(
          jobsData.filter((j) => (j.bids ?? []).some((b) => b.bidder.toLowerCase() === addr))
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, [address]);

  const pc = overview?.periodComparison;
  const jobsTrend = pc ? percentChange(pc.jobsThisWeek, pc.jobsLastWeek) : undefined;

  const openCount = overview
    ? overview.totalJobs - overview.totalCompletedJobs
    : openJobs.length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agent Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            {address ? "Your marketplace overview" : "Connect wallet to track your bids"}
          </p>
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

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && !overview ? (
          Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : overview ? (
          <>
            <KpiCard
              label="Open Jobs"
              value={formatNumber(openCount)}
              icon={Search}
              trend={jobsTrend}
              subtitle="Available to bid on"
            />
            <KpiCard
              label="Total Jobs"
              value={formatNumber(overview.totalJobs)}
              icon={Briefcase}
            />
            <KpiCard
              label="Completed"
              value={formatNumber(overview.totalCompletedJobs)}
              icon={CheckCircle2}
              subtitle={`${formatPercent(overview.overallSuccessRate)} success rate`}
            />
            <KpiCard
              label="Total Volume"
              value={formatUSDC(overview.totalVolume / 1e6)}
              icon={DollarSign}
            />
            <KpiCard
              label="Active Agents"
              value={formatNumber(overview.activeAgents)}
              icon={Users}
            />
            <KpiCard
              label="My Active Bids"
              value={address ? formatNumber(myBidJobs.length) : "--"}
              icon={Gavel}
              subtitle={address ? undefined : "Connect wallet"}
            />
          </>
        ) : null}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/agent/jobs"
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:border-accent/30 hover:bg-card-hover transition-colors group"
        >
          <div className="rounded-lg bg-accent/10 p-3 group-hover:bg-accent/20 transition-colors">
            <Search className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold">Browse Jobs</p>
            <p className="text-xs text-muted mt-0.5">Find open jobs and place bids</p>
          </div>
        </Link>
        <Link
          href="/agent/bids"
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:border-accent/30 hover:bg-card-hover transition-colors group"
        >
          <div className="rounded-lg bg-accent/10 p-3 group-hover:bg-accent/20 transition-colors">
            <Gavel className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-semibold">My Bids</p>
            <p className="text-xs text-muted mt-0.5">Track your active and past bids</p>
          </div>
        </Link>
      </div>

      {/* Recent open jobs */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Recent Open Jobs</h2>
          <Link href="/agent/jobs" className="text-xs text-accent hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-border">
          {openJobs.length === 0 && !loading ? (
            <p className="px-5 py-8 text-sm text-muted text-center">No open jobs right now</p>
          ) : (
            openJobs.map((job) => {
              const deadlineDate = new Date(job.deadline * 1000);
              const isExpired = deadlineDate < new Date();
              return (
                <div
                  key={job.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-card-hover transition-colors"
                >
                  <span className="text-xs text-muted font-mono w-8">#{job.id}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{job.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {(job.tags ?? []).slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent"
                        >
                          {t}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted">
                        {job.bids?.length ?? 0} bid{(job.bids?.length ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs ${isExpired ? "text-red-500" : "text-muted"}`}>
                      {deadlineDate.toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
