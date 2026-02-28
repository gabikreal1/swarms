import { getPool } from "../db/pool";

export class Aggregator {
  private clusterTimer: ReturnType<typeof setInterval> | null = null;
  private trendTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  start(
    clusterIntervalMs = 60_000,
    trendIntervalMs = 300_000,
  ): void {
    if (this.running) return;
    this.running = true;
    console.log("[Aggregator] starting...");

    // Run immediately then schedule
    this.runAll().catch((err) =>
      console.error("[Aggregator] initial run error:", err),
    );

    this.clusterTimer = setInterval(() => {
      Promise.all([
        this.refreshTagClusters(),
        this.refreshSupplyDemand(),
      ]).catch((err) => console.error("[Aggregator] cluster tick error:", err));
    }, clusterIntervalMs);

    this.trendTimer = setInterval(() => {
      Promise.all([
        this.refreshTrendSnapshots(),
        this.refreshPriceSeries(),
      ]).catch((err) => console.error("[Aggregator] trend tick error:", err));
    }, trendIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.clusterTimer) {
      clearInterval(this.clusterTimer);
      this.clusterTimer = null;
    }
    if (this.trendTimer) {
      clearInterval(this.trendTimer);
      this.trendTimer = null;
    }
    console.log("[Aggregator] stopped");
  }

  private async runAll(): Promise<void> {
    await Promise.all([
      this.refreshTagClusters(),
      this.refreshTrendSnapshots(),
      this.refreshPriceSeries(),
      this.refreshSupplyDemand(),
    ]);
  }

  // ──────────────────────────────────────────────────────────
  // Tag clusters: groups jobs by tag, computes aggregate stats
  // ──────────────────────────────────────────────────────────

  async refreshTagClusters(): Promise<void> {
    const pool = getPool();
    await pool.query(`
      INSERT INTO tag_clusters (tag, job_count, avg_budget, success_rate, avg_completion_s, updated_at)
      SELECT
        unnest(tags) AS tag,
        COUNT(*)::BIGINT AS job_count,
        AVG(budget) AS avg_budget,
        CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)
        END AS success_rate,
        AVG(
          CASE
            WHEN completed_at IS NOT NULL AND created_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - created_at))::BIGINT
            ELSE NULL
          END
        )::BIGINT AS avg_completion_s,
        NOW() AS updated_at
      FROM jobs
      GROUP BY tag
      ON CONFLICT (tag) DO UPDATE SET
        job_count = EXCLUDED.job_count,
        avg_budget = EXCLUDED.avg_budget,
        success_rate = EXCLUDED.success_rate,
        avg_completion_s = EXCLUDED.avg_completion_s,
        updated_at = EXCLUDED.updated_at
    `);
    console.log("[Aggregator] refreshed tag_clusters");
  }

  // ──────────────────────────────────────────────────────────
  // Trend snapshots: momentum of each tag over 24h windows
  // ──────────────────────────────────────────────────────────

  async refreshTrendSnapshots(): Promise<void> {
    const pool = getPool();
    const windowHours = 24;

    await pool.query(
      `
      WITH current_window AS (
        SELECT
          unnest(j.tags) AS tag,
          COUNT(DISTINCT j.id) AS job_count,
          COUNT(DISTINCT b.id) AS bid_count
        FROM jobs j
        LEFT JOIN bids b ON b.job_id = j.id
          AND b.created_at >= NOW() - INTERVAL '${windowHours} hours'
        WHERE j.created_at >= NOW() - INTERVAL '${windowHours} hours'
        GROUP BY tag
      ),
      prior_window AS (
        SELECT
          unnest(j.tags) AS tag,
          COUNT(DISTINCT j.id) AS job_count
        FROM jobs j
        WHERE j.created_at >= NOW() - INTERVAL '${windowHours * 2} hours'
          AND j.created_at < NOW() - INTERVAL '${windowHours} hours'
        GROUP BY tag
      )
      INSERT INTO trend_snapshots (tag, window_start, window_end, job_count, bid_count, momentum, updated_at)
      SELECT
        cw.tag,
        NOW() - INTERVAL '${windowHours} hours',
        NOW(),
        cw.job_count,
        cw.bid_count,
        CASE
          WHEN COALESCE(pw.job_count, 0) = 0 THEN cw.job_count::NUMERIC
          ELSE (cw.job_count - pw.job_count)::NUMERIC / pw.job_count
        END AS momentum,
        NOW()
      FROM current_window cw
      LEFT JOIN prior_window pw ON cw.tag = pw.tag
    `,
    );
    console.log("[Aggregator] refreshed trend_snapshots");
  }

  // ──────────────────────────────────────────────────────────
  // Price series: avg/median/p25/p75 per tag in 1-hour buckets
  // ──────────────────────────────────────────────────────────

  async refreshPriceSeries(): Promise<void> {
    const pool = getPool();

    await pool.query(`
      INSERT INTO price_series (tag, bucket_start, bucket_end, avg_price, median_price, p25_price, p75_price, sample_count, updated_at)
      SELECT
        tag,
        date_trunc('hour', b.created_at) AS bucket_start,
        date_trunc('hour', b.created_at) + INTERVAL '1 hour' AS bucket_end,
        AVG(b.price)::NUMERIC(78,0) AS avg_price,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY b.price)::NUMERIC(78,0) AS median_price,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY b.price)::NUMERIC(78,0) AS p25_price,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY b.price)::NUMERIC(78,0) AS p75_price,
        COUNT(*)::BIGINT AS sample_count,
        NOW() AS updated_at
      FROM bids b
      JOIN jobs j ON j.id = b.job_id,
      LATERAL unnest(j.tags) AS tag
      WHERE b.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY tag, date_trunc('hour', b.created_at)
      ON CONFLICT DO NOTHING
    `);
    console.log("[Aggregator] refreshed price_series");
  }

  // ──────────────────────────────────────────────────────────
  // Supply/demand: active agents vs open jobs per tag
  // ──────────────────────────────────────────────────────────

  async refreshSupplyDemand(): Promise<void> {
    const pool = getPool();

    await pool.query(`
      WITH agent_tags AS (
        SELECT unnest(capabilities) AS tag, COUNT(*) AS active_agents
        FROM agents
        WHERE status = 'active'
        GROUP BY tag
      ),
      job_tags AS (
        SELECT unnest(tags) AS tag, COUNT(*) AS open_jobs
        FROM jobs
        WHERE status = 'open'
        GROUP BY tag
      )
      INSERT INTO supply_demand (tag, active_agents, open_jobs, ratio, snapshot_at)
      SELECT
        COALESCE(a.tag, jt.tag) AS tag,
        COALESCE(a.active_agents, 0) AS active_agents,
        COALESCE(jt.open_jobs, 0) AS open_jobs,
        CASE
          WHEN COALESCE(jt.open_jobs, 0) = 0 THEN NULL
          ELSE COALESCE(a.active_agents, 0)::NUMERIC / jt.open_jobs
        END AS ratio,
        NOW()
      FROM agent_tags a
      FULL OUTER JOIN job_tags jt ON a.tag = jt.tag
    `);
    console.log("[Aggregator] refreshed supply_demand");
  }
}
