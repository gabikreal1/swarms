import { getPool } from '../db/pool';

// ────────────────────────────────────────────────────────────
// Interfaces
// ────────────────────────────────────────────────────────────

export interface ClusterStats {
  tag: string;
  category: string;
  jobCount: number;
  avgBudget: number;
  successRate: number;
  avgCompletionTime: number; // hours
  totalVolume: number;
}

export interface ClusterBreakdown {
  tag: string;
  segments: {
    label: string;
    count: number;
    avgBudget: number;
    successRate: number;
  }[];
}

export interface TrendingTag {
  tag: string;
  category: string;
  currentPeriodJobs: number;
  previousPeriodJobs: number;
  momentumScore: number; // -1 to 1
  signal: 'STRONG_UP' | 'UP' | 'STABLE' | 'DOWN' | 'STRONG_DOWN';
  avgBudget: number;
}

export interface PriceSeries {
  tag: string;
  interval: 'day' | 'week' | 'month';
  dataPoints: {
    period: string;
    avg: number;
    median: number;
    p25: number;
    p75: number;
    count: number;
  }[];
}

export interface SupplyDemand {
  tag: string;
  supply: number;
  demand: number;
  ratio: number;
  trend: 'oversupplied' | 'balanced' | 'undersupplied';
}

export interface MarketOverview {
  totalJobs: number;
  totalCompletedJobs: number;
  totalVolume: number;
  activeAgents: number;
  overallSuccessRate: number;
  avgCompletionTime: number;
  periodComparison: {
    jobsThisWeek: number;
    jobsLastWeek: number;
    volumeThisWeek: number;
    volumeLastWeek: number;
  };
}

export interface AgentStats {
  address: string;
  name: string;
  totalJobs: number;
  completedJobs: number;
  successRate: number;
  totalEarned: number;
  avgDeliveryTime: number;
  reputation: number;
  performanceByTag: {
    tag: string;
    jobs: number;
    successRate: number;
    avgBudget: number;
  }[];
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function momentumToSignal(
  m: number,
): 'STRONG_UP' | 'UP' | 'STABLE' | 'DOWN' | 'STRONG_DOWN' {
  if (m > 0.5) return 'STRONG_UP';
  if (m > 0.1) return 'UP';
  if (m >= -0.1) return 'STABLE';
  if (m >= -0.5) return 'DOWN';
  return 'STRONG_DOWN';
}

function classifySupplyDemand(
  ratio: number,
): 'oversupplied' | 'balanced' | 'undersupplied' {
  if (ratio > 2) return 'oversupplied';
  if (ratio >= 0.5) return 'balanced';
  return 'undersupplied';
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

export class MarketService {
  /**
   * Cluster-level stats per tag, computed from the jobs table.
   */
  async getClusterStats(filters?: {
    category?: string;
    minJobs?: number;
  }): Promise<ClusterStats[]> {
    const pool = getPool();
    const category = filters?.category;
    const minJobs = filters?.minJobs ?? 1;

    const params: (string | number)[] = [minJobs];
    const conditions: string[] = [];
    if (category) {
      params.push(category);
      conditions.push(`j.category = $${params.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await pool.query(
      `SELECT
         t.tag,
         COALESCE(mode() WITHIN GROUP (ORDER BY j.category), '') AS category,
         COUNT(*)::int AS job_count,
         COALESCE(AVG(j.budget::numeric), 0) AS avg_budget,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE COUNT(*) FILTER (WHERE j.status = 'completed')::numeric / COUNT(*)
         END AS success_rate,
         COALESCE(
           AVG(EXTRACT(EPOCH FROM (j.completed_at - j.created_at)) / 3600)
             FILTER (WHERE j.completed_at IS NOT NULL),
           0
         ) AS avg_completion_time,
         COALESCE(SUM(j.budget::numeric) FILTER (WHERE j.status = 'completed'), 0) AS total_volume
       FROM jobs j, unnest(j.tags) AS t(tag)
       ${whereClause}
       GROUP BY t.tag
       HAVING COUNT(*) >= $1
       ORDER BY COUNT(*) DESC`,
      params,
    );

    return res.rows.map((r) => ({
      tag: r.tag,
      category: r.category,
      jobCount: num(r.job_count),
      avgBudget: num(r.avg_budget),
      successRate: num(r.success_rate),
      avgCompletionTime: num(r.avg_completion_time),
      totalVolume: num(r.total_volume),
    }));
  }

  /**
   * Drill down into a specific tag cluster, segmented by a breakdown dimension.
   */
  async getClusterBreakdown(
    tag: string,
    breakdownBy: 'budget_range' | 'time_period' | 'status',
  ): Promise<ClusterBreakdown> {
    const pool = getPool();

    let labelExpr: string;
    let groupExpr: string;

    switch (breakdownBy) {
      case 'budget_range':
        labelExpr = `CASE
          WHEN j.budget::numeric < 50  THEN '$0-50'
          WHEN j.budget::numeric < 200 THEN '$50-200'
          WHEN j.budget::numeric < 1000 THEN '$200-1000'
          ELSE '$1000+'
        END`;
        groupExpr = labelExpr;
        break;
      case 'time_period':
        labelExpr = `to_char(date_trunc('week', j.created_at), 'YYYY-"W"IW')`;
        groupExpr = labelExpr;
        break;
      case 'status':
        labelExpr = `j.status::text`;
        groupExpr = `j.status`;
        break;
    }

    const res = await pool.query(
      `SELECT
         ${labelExpr} AS label,
         COUNT(*)::int AS count,
         COALESCE(AVG(j.budget::numeric), 0) AS avg_budget,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE COUNT(*) FILTER (WHERE j.status = 'completed')::numeric / COUNT(*)
         END AS success_rate
       FROM jobs j
       WHERE $1 = ANY(j.tags)
       GROUP BY ${groupExpr}
       ORDER BY count DESC`,
      [tag],
    );

    return {
      tag,
      segments: res.rows.map((r) => ({
        label: r.label,
        count: num(r.count),
        avgBudget: num(r.avg_budget),
        successRate: num(r.success_rate),
      })),
    };
  }

  /**
   * Trending tags with momentum scores comparing current vs previous period.
   */
  async getTrends(period: 'week' | 'month' = 'week'): Promise<TrendingTag[]> {
    const pool = getPool();
    const intervalStr = period === 'week' ? '7 days' : '30 days';

    const res = await pool.query(
      `WITH current_period AS (
         SELECT
           t.tag,
           COUNT(*)::int AS job_count,
           COALESCE(AVG(j.budget::numeric), 0) AS avg_budget,
           COALESCE(mode() WITHIN GROUP (ORDER BY j.category), '') AS category
         FROM jobs j, unnest(j.tags) AS t(tag)
         WHERE j.created_at >= NOW() - $1::interval
         GROUP BY t.tag
       ),
       previous_period AS (
         SELECT
           t.tag,
           COUNT(*)::int AS job_count
         FROM jobs j, unnest(j.tags) AS t(tag)
         WHERE j.created_at >= NOW() - ($1::interval * 2)
           AND j.created_at < NOW() - $1::interval
         GROUP BY t.tag
       )
       SELECT
         COALESCE(c.tag, p.tag) AS tag,
         COALESCE(c.category, '') AS category,
         COALESCE(c.job_count, 0) AS current_period_jobs,
         COALESCE(p.job_count, 0) AS previous_period_jobs,
         CASE
           WHEN COALESCE(GREATEST(p.job_count, 1), 1) = 0 THEN 0
           ELSE (COALESCE(c.job_count, 0) - COALESCE(p.job_count, 0))::numeric
                / GREATEST(COALESCE(p.job_count, 1), 1)
         END AS momentum,
         COALESCE(c.avg_budget, 0) AS avg_budget
       FROM current_period c
       FULL OUTER JOIN previous_period p ON c.tag = p.tag
       ORDER BY ABS(
         CASE
           WHEN COALESCE(GREATEST(p.job_count, 1), 1) = 0 THEN 0
           ELSE (COALESCE(c.job_count, 0) - COALESCE(p.job_count, 0))::numeric
                / GREATEST(COALESCE(p.job_count, 1), 1)
         END
       ) DESC`,
      [intervalStr],
    );

    return res.rows.map((r) => {
      const momentum = Math.max(-1, Math.min(1, num(r.momentum)));
      return {
        tag: r.tag,
        category: r.category,
        currentPeriodJobs: num(r.current_period_jobs),
        previousPeriodJobs: num(r.previous_period_jobs),
        momentumScore: momentum,
        signal: momentumToSignal(momentum),
        avgBudget: num(r.avg_budget),
      };
    });
  }

  /**
   * Price time series for a tag, bucketed by day/week/month.
   */
  async getPriceSeries(
    tag: string,
    interval: 'day' | 'week' | 'month' = 'week',
  ): Promise<PriceSeries> {
    const pool = getPool();

    const truncUnit =
      interval === 'day' ? 'day' : interval === 'week' ? 'week' : 'month';
    const formatStr =
      interval === 'day'
        ? 'YYYY-MM-DD'
        : interval === 'week'
          ? 'YYYY-"W"IW'
          : 'YYYY-MM';

    const res = await pool.query(
      `SELECT
         to_char(date_trunc($2, j.created_at), $3) AS period,
         COALESCE(AVG(j.budget::numeric), 0) AS avg,
         COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY j.budget::numeric), 0) AS median,
         COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY j.budget::numeric), 0) AS p25,
         COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY j.budget::numeric), 0) AS p75,
         COUNT(*)::int AS count
       FROM jobs j
       WHERE $1 = ANY(j.tags)
         AND j.budget IS NOT NULL
       GROUP BY date_trunc($2, j.created_at)
       ORDER BY date_trunc($2, j.created_at) ASC`,
      [tag, truncUnit, formatStr],
    );

    return {
      tag,
      interval,
      dataPoints: res.rows.map((r) => ({
        period: r.period,
        avg: num(r.avg),
        median: num(r.median),
        p25: num(r.p25),
        p75: num(r.p75),
        count: num(r.count),
      })),
    };
  }

  /**
   * Supply (active agents) vs demand (open jobs) per tag.
   */
  async getSupplyDemand(tags?: string[]): Promise<SupplyDemand[]> {
    const pool = getPool();

    const hasFilter = tags && tags.length > 0;

    const supplyQuery = hasFilter
      ? `SELECT c.cap AS tag, COUNT(DISTINCT a.wallet)::int AS supply
         FROM agents a, unnest(a.capabilities) AS c(cap)
         WHERE a.status = 'active' AND c.cap = ANY($1)
         GROUP BY c.cap`
      : `SELECT c.cap AS tag, COUNT(DISTINCT a.wallet)::int AS supply
         FROM agents a, unnest(a.capabilities) AS c(cap)
         WHERE a.status = 'active'
         GROUP BY c.cap`;

    const demandQuery = hasFilter
      ? `SELECT t.tag, COUNT(*)::int AS demand
         FROM jobs j, unnest(j.tags) AS t(tag)
         WHERE j.status = 'open' AND t.tag = ANY($1)
         GROUP BY t.tag`
      : `SELECT t.tag, COUNT(*)::int AS demand
         FROM jobs j, unnest(j.tags) AS t(tag)
         WHERE j.status = 'open'
         GROUP BY t.tag`;

    const params = hasFilter ? [tags] : [];

    const [supplyRes, demandRes] = await Promise.all([
      pool.query(supplyQuery, params),
      pool.query(demandQuery, params),
    ]);

    const supplyMap = new Map<string, number>();
    for (const r of supplyRes.rows) {
      supplyMap.set(r.tag, num(r.supply));
    }

    const demandMap = new Map<string, number>();
    for (const r of demandRes.rows) {
      demandMap.set(r.tag, num(r.demand));
    }

    const allTags = new Set(
      Array.from(supplyMap.keys()).concat(Array.from(demandMap.keys())),
    );
    const results: SupplyDemand[] = [];

    allTags.forEach((t) => {
      const supply = supplyMap.get(t) ?? 0;
      const demand = demandMap.get(t) ?? 0;
      const ratio = demand === 0 ? (supply > 0 ? Infinity : 0) : supply / demand;
      results.push({
        tag: t,
        supply,
        demand,
        ratio: Number.isFinite(ratio) ? ratio : 999,
        trend: classifySupplyDemand(ratio),
      });
    });

    results.sort((a, b) => a.ratio - b.ratio);
    return results;
  }

  /**
   * Global market overview dashboard.
   */
  async getOverview(): Promise<MarketOverview> {
    const pool = getPool();

    const res = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM jobs) AS total_jobs,
        (SELECT COUNT(*)::int FROM jobs WHERE status = 'completed') AS total_completed,
        (SELECT COALESCE(SUM(budget::numeric), 0) FROM jobs WHERE status = 'completed') AS total_volume,
        (SELECT COUNT(*)::int FROM agents WHERE status = 'active') AS active_agents,
        (SELECT
           CASE WHEN COUNT(*) = 0 THEN 0
                ELSE COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)
           END
         FROM jobs
         WHERE status IN ('completed', 'disputed')
        ) AS success_rate,
        (SELECT COALESCE(
           AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600), 0)
         FROM jobs WHERE completed_at IS NOT NULL
        ) AS avg_completion_time,
        (SELECT COUNT(*)::int FROM jobs
         WHERE created_at >= date_trunc('week', NOW())
        ) AS jobs_this_week,
        (SELECT COUNT(*)::int FROM jobs
         WHERE created_at >= date_trunc('week', NOW()) - INTERVAL '7 days'
           AND created_at < date_trunc('week', NOW())
        ) AS jobs_last_week,
        (SELECT COALESCE(SUM(budget::numeric), 0) FROM jobs
         WHERE status = 'completed'
           AND completed_at >= date_trunc('week', NOW())
        ) AS volume_this_week,
        (SELECT COALESCE(SUM(budget::numeric), 0) FROM jobs
         WHERE status = 'completed'
           AND completed_at >= date_trunc('week', NOW()) - INTERVAL '7 days'
           AND completed_at < date_trunc('week', NOW())
        ) AS volume_last_week
    `);

    const r = res.rows[0];
    return {
      totalJobs: num(r.total_jobs),
      totalCompletedJobs: num(r.total_completed),
      totalVolume: num(r.total_volume),
      activeAgents: num(r.active_agents),
      overallSuccessRate: num(r.success_rate),
      avgCompletionTime: num(r.avg_completion_time),
      periodComparison: {
        jobsThisWeek: num(r.jobs_this_week),
        jobsLastWeek: num(r.jobs_last_week),
        volumeThisWeek: num(r.volume_this_week),
        volumeLastWeek: num(r.volume_last_week),
      },
    };
  }

  /**
   * Per-agent stats with performance breakdown by tag.
   */
  async getAgentStats(address: string): Promise<AgentStats | null> {
    const pool = getPool();

    const agentRes = await pool.query(
      `SELECT wallet, name, reputation, jobs_completed, jobs_failed, total_earned, status
       FROM agents WHERE wallet = $1`,
      [address],
    );

    if (agentRes.rows.length === 0) return null;

    const agent = agentRes.rows[0];
    const totalJobs = num(agent.jobs_completed) + num(agent.jobs_failed);
    const successRate =
      totalJobs === 0 ? 0 : num(agent.jobs_completed) / totalJobs;

    // Average delivery time from accepted bids on completed jobs
    const deliveryRes = await pool.query(
      `SELECT COALESCE(
         AVG(EXTRACT(EPOCH FROM (j.completed_at - j.created_at)) / 3600), 0
       ) AS avg_delivery
       FROM bids b
       JOIN jobs j ON j.id = b.job_id
       WHERE b.bidder = $1
         AND b.accepted = TRUE
         AND j.status = 'completed'
         AND j.completed_at IS NOT NULL`,
      [address],
    );

    // Performance by tag
    const tagRes = await pool.query(
      `SELECT
         t.tag,
         COUNT(*)::int AS jobs,
         CASE WHEN COUNT(*) = 0 THEN 0
              ELSE COUNT(*) FILTER (WHERE j.status = 'completed')::numeric / COUNT(*)
         END AS success_rate,
         COALESCE(AVG(j.budget::numeric), 0) AS avg_budget
       FROM bids b
       JOIN jobs j ON j.id = b.job_id,
       unnest(j.tags) AS t(tag)
       WHERE b.bidder = $1 AND b.accepted = TRUE
       GROUP BY t.tag
       ORDER BY jobs DESC`,
      [address],
    );

    return {
      address: agent.wallet,
      name: agent.name,
      totalJobs,
      completedJobs: num(agent.jobs_completed),
      successRate,
      totalEarned: num(agent.total_earned),
      avgDeliveryTime: num(deliveryRes.rows[0]?.avg_delivery),
      reputation: num(agent.reputation),
      performanceByTag: tagRes.rows.map((r) => ({
        tag: r.tag,
        jobs: num(r.jobs),
        successRate: num(r.success_rate),
        avgBudget: num(r.avg_budget),
      })),
    };
  }
}
