import { getPool } from '../db/pool';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface BidItem {
  id: number;
  jobId: number;
  bidder: string;
  price: string;
  deliveryTime: number;
  reputation: string;
  metadataURI: string;
  accepted: boolean;
  createdAt: number;
}

export interface JobFeedItem {
  id: string;
  chainId: number | null;
  poster: string;
  description: string;
  metadataUri: string;
  tags: string[];
  category: string;
  deadline: number;
  budget: number;
  status: number;
  createdAt: string;
  bidCount: number;
  bids: BidItem[];
  hasDispute: boolean;
  marketContext: {
    budgetPercentile: number;
    competitionLevel: 'low' | 'medium' | 'high';
  };
}

export interface RecommendedJob extends JobFeedItem {
  matchScore: number;
  reasons: string[];
  suggestedBidRange: { min: number; max: number };
  winProbability: number;
}

export interface AgentDirectoryEntry {
  address: string;
  name: string;
  capabilities: string[];
  reputation: number;
  status: string;
  completedJobs: number;
  successRate: number;
  performanceByTag: {
    tag: string;
    jobs: number;
    successRate: number;
  }[];
}

export interface FeedFilters {
  tags?: string[];
  tagsAll?: string[];
  category?: string;
  budgetMin?: number;
  budgetMax?: number;
  status?: number;
  deadline?: string;
  maxExistingBids?: number;
  cursor?: string;
  limit?: number;
}

export interface SearchFilters {
  q: string;
  type?: 'jobs' | 'agents' | 'all';
  status?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchResultItem {
  kind: 'job' | 'agent';
  id: string;
  headline: string;
  rank: number;
  data: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, string> = {
  0: 'open',
  1: 'in_progress',
  2: 'delivered',
  3: 'completed',
  4: 'disputed',
  5: 'validating',
};

function competitionLevel(bidCount: number): 'low' | 'medium' | 'high' {
  if (bidCount <= 2) return 'low';
  if (bidCount <= 5) return 'medium';
  return 'high';
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const sepIdx = decoded.indexOf('|');
    if (sepIdx === -1) return null;
    return { createdAt: decoded.slice(0, sepIdx), id: decoded.slice(sepIdx + 1) };
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url');
}

function decodeAgentCursor(cursor: string): { createdAt: string; wallet: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const sepIdx = decoded.indexOf('|');
    if (sepIdx === -1) return null;
    return { createdAt: decoded.slice(0, sepIdx), wallet: decoded.slice(sepIdx + 1) };
  } catch {
    return null;
  }
}

function encodeAgentCursor(createdAt: string, wallet: string): string {
  return Buffer.from(`${createdAt}|${wallet}`).toString('base64url');
}

function decodeSearchCursor(cursor: string): { kind: string; rank: number; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const [kind, rankStr, id] = decoded.split('|');
    if (!kind || !rankStr || !id) return null;
    return { kind, rank: Number(rankStr), id };
  } catch {
    return null;
  }
}

function encodeSearchCursor(kind: string, rank: number, id: string): string {
  return Buffer.from(`${kind}|${rank}|${id}`).toString('base64url');
}

// ────────────────────────────────────────────────────────────
// FeedService
// ────────────────────────────────────────────────────────────

export class FeedService {
  /**
   * Paginated job feed with filtering and market context.
   * Uses cursor-based pagination on (created_at, id).
   */
  async getJobFeed(
    filters: FeedFilters,
  ): Promise<{ items: JobFeedItem[]; nextCursor: string | null }> {
    const pool = getPool();
    const params: unknown[] = [];
    const conditions: string[] = [];
    let paramIdx = 1;

    // --- Filters ---

    if (filters.tags && filters.tags.length > 0) {
      // ANY overlap: job has at least one of the requested tags
      conditions.push(`j.tags && $${paramIdx}`);
      params.push(filters.tags);
      paramIdx++;
    }

    if (filters.tagsAll && filters.tagsAll.length > 0) {
      // ALL match: job must have every requested tag
      conditions.push(`j.tags @> $${paramIdx}`);
      params.push(filters.tagsAll);
      paramIdx++;
    }

    if (filters.category) {
      conditions.push(`j.category = $${paramIdx}`);
      params.push(filters.category);
      paramIdx++;
    }

    if (filters.budgetMin != null) {
      conditions.push(`j.budget >= $${paramIdx}`);
      params.push(filters.budgetMin);
      paramIdx++;
    }

    if (filters.budgetMax != null) {
      conditions.push(`j.budget <= $${paramIdx}`);
      params.push(filters.budgetMax);
      paramIdx++;
    }

    if (filters.status != null) {
      const statusStr = STATUS_MAP[filters.status] ?? 'open';
      conditions.push(`j.status = $${paramIdx}`);
      params.push(statusStr);
      paramIdx++;
    }

    if (filters.deadline) {
      conditions.push(`j.deadline >= $${paramIdx}`);
      params.push(filters.deadline);
      paramIdx++;
    }

    // --- Cursor ---

    if (filters.cursor) {
      const cur = decodeCursor(filters.cursor);
      if (cur) {
        conditions.push(
          `(j.created_at, j.id) < ($${paramIdx}::timestamp, $${paramIdx + 1}::uuid)`,
        );
        params.push(cur.createdAt, cur.id);
        paramIdx += 2;
      }
    }

    // --- Limit ---

    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);

    // maxExistingBids filter — apply in SQL so pagination counts stay correct
    if (filters.maxExistingBids != null) {
      conditions.push(
        `(SELECT COUNT(*)::int FROM bids WHERE bids.job_id = j.id) <= $${paramIdx}`,
      );
      params.push(filters.maxExistingBids);
      paramIdx++;
    }

    // --- Build query ---

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // We fetch limit + 1 rows to detect if there is a next page.
    // PERCENT_RANK is computed over the full jobs table via a CTE
    // so pagination/filtering does not skew the percentile.
    const sql = `
      WITH budget_ranks AS (
        SELECT id, PERCENT_RANK() OVER (ORDER BY budget) AS budget_percentile
        FROM jobs
      )
      SELECT
        j.id,
        j.chain_id,
        j.poster,
        j.description,
        j.metadata_uri,
        j.tags,
        j.category,
        j.deadline,
        j.budget,
        j.status,
        j.created_at,
        COALESCE(bc.bid_count, 0)::int AS bid_count,
        COALESCE(br.budget_percentile, 0) AS budget_percentile
      FROM jobs j
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS bid_count FROM bids b WHERE b.job_id = j.id
      ) bc ON TRUE
      LEFT JOIN budget_ranks br ON br.id = j.id
      ${whereClause}
      ORDER BY j.created_at DESC, j.id DESC
      LIMIT $${paramIdx}
    `;
    params.push(limit + 1);

    const result = await pool.query(sql, params);
    let rows = result.rows;

    const hasMore = rows.length > limit;
    if (hasMore) rows = rows.slice(0, limit);

    // --- Fetch bids for all jobs in one query ---
    const jobIds = rows.map((r: Record<string, unknown>) => r.id as string);
    let bidsMap: Map<string, BidItem[]> = new Map();

    if (jobIds.length > 0) {
      const bidsSql = `
        SELECT id, job_id, bidder, price, delivery_time, reputation, metadata_uri, accepted, created_at
        FROM bids
        WHERE job_id = ANY($1::uuid[])
        ORDER BY created_at ASC
      `;
      const bidsResult = await pool.query(bidsSql, [jobIds]);
      for (const b of bidsResult.rows) {
        const jobId = b.job_id as string;
        if (!bidsMap.has(jobId)) bidsMap.set(jobId, []);
        bidsMap.get(jobId)!.push({
          id: Number(b.id),
          jobId: Number(b.job_id),
          bidder: b.bidder as string,
          price: b.price?.toString() ?? '0',
          deliveryTime: Number(b.delivery_time ?? 0),
          reputation: b.reputation?.toString() ?? '0',
          metadataURI: (b.metadata_uri as string) ?? '',
          accepted: b.accepted as boolean,
          createdAt: Math.floor(new Date(b.created_at).getTime() / 1000),
        });
      }
    }

    // --- Check disputes ---
    let disputeJobIds: Set<string> = new Set();
    if (jobIds.length > 0) {
      const disputeSql = `
        SELECT DISTINCT job_id FROM disputes
        WHERE job_id = ANY($1::uuid[]) AND status NOT IN ('none', 'dismissed')
      `;
      const disputeResult = await pool.query(disputeSql, [jobIds]);
      for (const d of disputeResult.rows) {
        disputeJobIds.add(d.job_id as string);
      }
    }

    const items: JobFeedItem[] = rows.map(
      (r: Record<string, unknown>) => {
        const id = r.id as string;
        const bids = bidsMap.get(id) ?? [];
        return {
          id,
          chainId: r.chain_id ? Number(r.chain_id) : null,
          poster: r.poster as string,
          description: r.description as string,
          metadataUri: r.metadata_uri as string,
          tags: (r.tags as string[]) ?? [],
          category: (r.category as string) ?? '',
          deadline: Number(r.deadline ?? 0),
          budget: Number(r.budget ?? 0) / 1e6,
          status: r.status as unknown as number,
          createdAt: (r.created_at as Date).toISOString(),
          bidCount: bids.length,
          bids,
          hasDispute: disputeJobIds.has(id),
          marketContext: {
            budgetPercentile: Math.round(Number(r.budget_percentile ?? 0) * 100),
            competitionLevel: competitionLevel(bids.length),
          },
        };
      },
    );

    const nextCursor =
      hasMore && items.length > 0
        ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
        : null;

    return { items, nextCursor };
  }

  /**
   * Personalized job recommendations for an agent.
   *
   * Strategies:
   *  - opportunity: underserved tags (low supply/demand ratio)
   *  - budget: high-budget jobs matching agent capabilities
   *  - competition: low-competition jobs (few bids)
   *  - reputation_match: jobs whose budget fits agent reputation range
   */
  async getRecommendedJobs(
    agentAddress: string,
    strategy: string = 'opportunity',
  ): Promise<RecommendedJob[]> {
    const pool = getPool();

    // 1. Get agent info
    const agentRes = await pool.query(
      `SELECT wallet, name, capabilities, reputation, jobs_completed, jobs_failed
       FROM agents WHERE wallet = $1`,
      [agentAddress],
    );

    if (agentRes.rows.length === 0) {
      return [];
    }

    const agent = agentRes.rows[0];
    const capabilities: string[] = agent.capabilities ?? [];
    const reputation = Number(agent.reputation ?? 0);
    const totalJobs = Number(agent.jobs_completed ?? 0) + Number(agent.jobs_failed ?? 0);
    const successRate = totalJobs > 0 ? Number(agent.jobs_completed ?? 0) / totalJobs : 0;

    // 2. Fetch open jobs matching capabilities
    let orderClause: string;

    switch (strategy) {
      case 'budget':
        orderClause = 'j.budget DESC NULLS LAST';
        break;
      case 'competition':
        orderClause = 'bid_count ASC, j.created_at DESC';
        break;
      case 'reputation_match':
        orderClause = `ABS(COALESCE(j.budget, 0) - ${reputation}) ASC`;
        break;
      case 'opportunity':
      default:
        orderClause = 'j.created_at DESC';
        break;
    }

    const jobsSql = `
      WITH budget_ranks AS (
        SELECT id, PERCENT_RANK() OVER (ORDER BY budget) AS budget_percentile
        FROM jobs
      )
      SELECT
        j.id,
        j.chain_id,
        j.poster,
        j.description,
        j.metadata_uri,
        j.tags,
        j.category,
        j.deadline,
        j.budget,
        j.status,
        j.created_at,
        COALESCE(bc.bid_count, 0)::int AS bid_count,
        COALESCE(br.budget_percentile, 0) AS budget_percentile
      FROM jobs j
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS bid_count FROM bids b WHERE b.job_id = j.id
      ) bc ON TRUE
      LEFT JOIN budget_ranks br ON br.id = j.id
      WHERE j.status = 'open'
        AND j.tags && $1
      ORDER BY ${orderClause}
      LIMIT 20
    `;

    const jobsRes = await pool.query(jobsSql, [capabilities]);

    // 3. For opportunity strategy, fetch supply/demand data for scoring
    let supplyDemandMap: Map<string, number> = new Map();
    if (strategy === 'opportunity' && capabilities.length > 0) {
      const sdRes = await pool.query(
        `SELECT DISTINCT ON (tag) tag, ratio
         FROM supply_demand
         WHERE tag = ANY($1)
         ORDER BY tag, snapshot_at DESC`,
        [capabilities],
      );
      for (const row of sdRes.rows) {
        supplyDemandMap.set(row.tag, Number(row.ratio ?? 1));
      }
    }

    // 4. Score and enrich each job
    const recommendations: RecommendedJob[] = jobsRes.rows.map(
      (r: Record<string, unknown>) => {
        const jobTags = (r.tags as string[]) ?? [];
        const bidCount = r.bid_count as number;
        const budget = Number(r.budget ?? 0);

        // Calculate match score (0 - 1)
        let matchScore = 0;
        const reasons: string[] = [];

        // Tag overlap
        const overlap = jobTags.filter((t) => capabilities.includes(t));
        const tagScore = capabilities.length > 0 ? overlap.length / capabilities.length : 0;
        matchScore += tagScore * 0.4;
        if (overlap.length > 0) {
          reasons.push(`Matches ${overlap.length} of your capabilities: ${overlap.join(', ')}`);
        }

        // Competition factor
        const compScore = bidCount === 0 ? 1 : Math.max(0, 1 - bidCount / 10);
        matchScore += compScore * 0.25;
        if (bidCount <= 2) {
          reasons.push('Low competition');
        }

        // Supply/demand factor (opportunity strategy)
        if (strategy === 'opportunity') {
          let sdScore = 0;
          for (const tag of overlap) {
            const ratio = supplyDemandMap.get(tag) ?? 1;
            // Low ratio = more jobs than agents = better opportunity
            sdScore += ratio < 1 ? 1 : Math.max(0, 1 - (ratio - 1) / 5);
          }
          if (overlap.length > 0) sdScore /= overlap.length;
          matchScore += sdScore * 0.2;
          if (sdScore > 0.5) {
            reasons.push('High demand, low supply in matched tags');
          }
        } else {
          matchScore += 0.1; // neutral filler
        }

        // Reputation fit
        const repScore = reputation > 0 ? Math.min(reputation / 100, 1) : 0.5;
        matchScore += repScore * 0.15;

        matchScore = Math.round(matchScore * 100) / 100;

        // Win probability estimate
        const winProbability =
          Math.round(
            Math.min(1, matchScore * successRate * (bidCount === 0 ? 1 : 1 / (bidCount + 1)) * 3) *
              100,
          ) / 100;

        // Suggested bid range based on budget
        const suggestedMin = Math.round(budget * 0.7);
        const suggestedMax = Math.round(budget * 0.95);

        return {
          id: r.id as string,
          chainId: r.chain_id ? Number(r.chain_id) : null,
          poster: r.poster as string,
          description: r.description as string,
          metadataUri: r.metadata_uri as string,
          tags: jobTags,
          category: (r.category as string) ?? '',
          deadline: Number(r.deadline ?? 0),
          budget,
          status: r.status as unknown as number,
          createdAt: (r.created_at as Date).toISOString(),
          bidCount,
          bids: [],
          hasDispute: false,
          marketContext: {
            budgetPercentile: Math.round(Number(r.budget_percentile ?? 0) * 100),
            competitionLevel: competitionLevel(bidCount),
          },
          matchScore,
          reasons,
          suggestedBidRange: { min: suggestedMin, max: suggestedMax },
          winProbability,
        };
      },
    );

    // Sort by matchScore descending
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    return recommendations;
  }

  /**
   * Agent directory with filtering and per-tag performance breakdown.
   */
  async getAgentDirectory(filters: {
    capabilities?: string[];
    reputationMin?: number;
    status?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ items: AgentDirectoryEntry[]; nextCursor: string | null }> {
    const pool = getPool();
    const params: unknown[] = [];
    const conditions: string[] = [];
    let paramIdx = 1;

    if (filters.capabilities && filters.capabilities.length > 0) {
      conditions.push(`a.capabilities && $${paramIdx}`);
      params.push(filters.capabilities);
      paramIdx++;
    }

    if (filters.reputationMin != null) {
      conditions.push(`a.reputation >= $${paramIdx}`);
      params.push(filters.reputationMin);
      paramIdx++;
    }

    if (filters.status) {
      conditions.push(`a.status = $${paramIdx}`);
      params.push(filters.status);
      paramIdx++;
    }

    if (filters.cursor) {
      const cur = decodeAgentCursor(filters.cursor);
      if (cur) {
        conditions.push(
          `(a.created_at, a.wallet) < ($${paramIdx}::timestamp, $${paramIdx + 1})`,
        );
        params.push(cur.createdAt, cur.wallet);
        paramIdx += 2;
      }
    }

    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        a.wallet,
        a.name,
        a.capabilities,
        a.reputation,
        a.status,
        a.jobs_completed,
        a.jobs_failed,
        a.created_at
      FROM agents a
      ${whereClause}
      ORDER BY a.created_at DESC, a.wallet DESC
      LIMIT $${paramIdx}
    `;
    params.push(limit + 1);

    const result = await pool.query(sql, params);
    let rows = result.rows;
    const hasMore = rows.length > limit;
    if (hasMore) rows = rows.slice(0, limit);

    // Collect all agent wallets to fetch per-tag performance
    const wallets = rows.map((r: Record<string, unknown>) => r.wallet as string);

    // Per-tag performance: count completed and total jobs per tag per agent
    let tagPerfMap: Map<string, { tag: string; jobs: number; successRate: number }[]> = new Map();

    // Dynamic job stats from bids+jobs (more accurate than agents table which depends on ReputationUpdated event)
    let dynamicStatsMap: Map<string, { completed: number; total: number }> = new Map();

    if (wallets.length > 0) {
      const perfSql = `
        SELECT
          b.bidder AS wallet,
          UNNEST(j.tags) AS tag,
          COUNT(*) AS total_jobs,
          COUNT(*) FILTER (WHERE j.status = 'completed' AND b.accepted = TRUE) AS completed_jobs
        FROM bids b
        JOIN jobs j ON j.id = b.job_id
        WHERE b.bidder = ANY($1)
          AND b.accepted = TRUE
        GROUP BY b.bidder, UNNEST(j.tags)
      `;
      const perfRes = await pool.query(perfSql, [wallets]);

      for (const row of perfRes.rows) {
        const wallet = row.wallet as string;
        if (!tagPerfMap.has(wallet)) tagPerfMap.set(wallet, []);
        const total = Number(row.total_jobs);
        const completed = Number(row.completed_jobs);
        tagPerfMap.get(wallet)!.push({
          tag: row.tag as string,
          jobs: total,
          successRate: total > 0 ? Math.round((completed / total) * 100) / 100 : 0,
        });
      }

      // Aggregate job stats per agent (count distinct jobs, not per-tag)
      const statsSql = `
        SELECT
          b.bidder AS wallet,
          COUNT(DISTINCT j.id) AS total_jobs,
          COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') AS completed_jobs
        FROM bids b
        JOIN jobs j ON j.id = b.job_id
        WHERE b.bidder = ANY($1)
          AND b.accepted = TRUE
        GROUP BY b.bidder
      `;
      const statsRes = await pool.query(statsSql, [wallets]);
      for (const row of statsRes.rows) {
        dynamicStatsMap.set(row.wallet as string, {
          completed: Number(row.completed_jobs),
          total: Number(row.total_jobs),
        });
      }
    }

    const items: AgentDirectoryEntry[] = rows.map((r: Record<string, unknown>) => {
      const wallet = r.wallet as string;
      // Use dynamic stats from bids/jobs, fallback to agents table
      const dynamic = dynamicStatsMap.get(wallet);
      const storedCompleted = Number(r.jobs_completed ?? 0);
      const storedFailed = Number(r.jobs_failed ?? 0);
      const completed = dynamic ? dynamic.completed : storedCompleted;
      const total = dynamic ? dynamic.total : (storedCompleted + storedFailed);
      return {
        address: wallet,
        name: r.name as string,
        capabilities: (r.capabilities as string[]) ?? [],
        reputation: Number(r.reputation ?? 0),
        status: r.status as string,
        completedJobs: completed,
        successRate: total > 0 ? Math.round((completed / total) * 100) / 100 : 0,
        performanceByTag: tagPerfMap.get(wallet) ?? [],
      };
    });

    const nextCursor =
      hasMore && rows.length > 0
        ? encodeAgentCursor(
            (rows[rows.length - 1].created_at as Date).toISOString(),
            rows[rows.length - 1].wallet as string,
          )
        : null;

    return { items, nextCursor };
  }

  /**
   * Full-text search across jobs and/or agents using PostgreSQL tsvector.
   */
  async search(
    filters: SearchFilters,
  ): Promise<{ items: SearchResultItem[]; nextCursor: string | null }> {
    const pool = getPool();
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const searchType = filters.type ?? 'all';
    const results: SearchResultItem[] = [];

    // Search jobs
    if (searchType === 'jobs' || searchType === 'all') {
      const params: unknown[] = [];
      const conditions: string[] = [];
      let paramIdx = 1;

      conditions.push(`j.search_vector @@ plainto_tsquery('english', $${paramIdx})`);
      params.push(filters.q);
      paramIdx++;

      if (filters.status) {
        conditions.push(`j.status = $${paramIdx}`);
        params.push(filters.status);
        paramIdx++;
      }

      if (filters.cursor) {
        const cur = decodeSearchCursor(filters.cursor);
        if (cur && cur.kind === 'job') {
          conditions.push(
            `(ts_rank(j.search_vector, plainto_tsquery('english', $1)), j.id) < ($${paramIdx}::float, $${paramIdx + 1}::uuid)`,
          );
          params.push(cur.rank, cur.id);
          paramIdx += 2;
        }
      }

      const sql = `
        SELECT
          j.id,
          j.description,
          j.tags,
          j.status,
          j.budget,
          j.category,
          j.poster,
          j.created_at,
          ts_rank(j.search_vector, plainto_tsquery('english', $1)) AS rank,
          ts_headline('english', j.description, plainto_tsquery('english', $1),
            'StartSel=<b>, StopSel=</b>, MaxFragments=2, MaxWords=40') AS headline
        FROM jobs j
        WHERE ${conditions.join(' AND ')}
        ORDER BY rank DESC, j.id DESC
        LIMIT $${paramIdx}
      `;
      params.push(limit + 1);

      const res = await pool.query(sql, params);
      for (const r of res.rows) {
        results.push({
          kind: 'job',
          id: String(r.id),
          headline: r.headline as string,
          rank: Number(r.rank),
          data: {
            description: r.description,
            tags: r.tags,
            status: r.status,
            budget: r.budget ? String(r.budget) : null,
            category: r.category,
            poster: r.poster,
            createdAt: (r.created_at as Date).toISOString(),
          },
        });
      }
    }

    // Search agents
    if (searchType === 'agents' || searchType === 'all') {
      const params: unknown[] = [];
      const conditions: string[] = [];
      let paramIdx = 1;

      conditions.push(`a.search_vector @@ plainto_tsquery('english', $${paramIdx})`);
      params.push(filters.q);
      paramIdx++;

      if (filters.status) {
        conditions.push(`a.status = $${paramIdx}`);
        params.push(filters.status);
        paramIdx++;
      }

      if (filters.cursor) {
        const cur = decodeSearchCursor(filters.cursor);
        if (cur && cur.kind === 'agent') {
          conditions.push(
            `(ts_rank(a.search_vector, plainto_tsquery('english', $1)), a.wallet) < ($${paramIdx}::float, $${paramIdx + 1})`,
          );
          params.push(cur.rank, cur.id);
          paramIdx += 2;
        }
      }

      const sql = `
        SELECT
          a.wallet,
          a.name,
          a.capabilities,
          a.status,
          a.reputation,
          a.jobs_completed,
          a.created_at,
          ts_rank(a.search_vector, plainto_tsquery('english', $1)) AS rank,
          ts_headline('english', a.name || ' ' || coalesce(array_to_string(a.capabilities, ' '), ''),
            plainto_tsquery('english', $1),
            'StartSel=<b>, StopSel=</b>, MaxFragments=2, MaxWords=40') AS headline
        FROM agents a
        WHERE ${conditions.join(' AND ')}
        ORDER BY rank DESC, a.wallet DESC
        LIMIT $${paramIdx}
      `;
      params.push(limit + 1);

      const res = await pool.query(sql, params);
      for (const r of res.rows) {
        results.push({
          kind: 'agent',
          id: r.wallet as string,
          headline: r.headline as string,
          rank: Number(r.rank),
          data: {
            name: r.name,
            capabilities: r.capabilities,
            status: r.status,
            reputation: r.reputation ? String(r.reputation) : '0',
            jobsCompleted: Number(r.jobs_completed ?? 0),
            createdAt: (r.created_at as Date).toISOString(),
          },
        });
      }
    }

    // Sort combined results by rank descending
    results.sort((a, b) => b.rank - a.rank);

    const hasMore = results.length > limit;
    const trimmed = hasMore ? results.slice(0, limit) : results;

    const nextCursor =
      hasMore && trimmed.length > 0
        ? encodeSearchCursor(
            trimmed[trimmed.length - 1].kind,
            trimmed[trimmed.length - 1].rank,
            trimmed[trimmed.length - 1].id,
          )
        : null;

    return { items: trimmed, nextCursor };
  }
}
