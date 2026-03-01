import { Router, Request, Response } from 'express';
import { FeedService, FeedFilters, SearchFilters } from '../services/feed';
import { ChainReader } from '../services/chain-reader';

const router = Router();
const feedService = new FeedService();
const chainReader = new ChainReader();

// ────────────────────────────────────────────────────────────
// GET /v1/feed/jobs
//
// Query params:
//   tags          - comma-separated, job must match ANY
//   tags_all      - comma-separated, job must match ALL
//   category      - exact category match
//   budget_min    - minimum budget (numeric)
//   budget_max    - maximum budget (numeric)
//   status        - numeric status code
//   deadline      - minimum deadline timestamp
//   max_existing_bids - exclude jobs with more bids than this
//   cursor        - pagination cursor
//   limit         - page size (default 20, max 100)
// ────────────────────────────────────────────────────────────

router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const filters: FeedFilters = {};

    if (req.query.tags) {
      filters.tags = (req.query.tags as string).split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (req.query.tags_all) {
      filters.tagsAll = (req.query.tags_all as string).split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (req.query.category) {
      filters.category = req.query.category as string;
    }
    if (req.query.budget_min) {
      filters.budgetMin = Number(req.query.budget_min);
      if (Number.isNaN(filters.budgetMin)) {
        res.status(400).json({ error: 'budget_min must be a number' });
        return;
      }
    }
    if (req.query.budget_max) {
      filters.budgetMax = Number(req.query.budget_max);
      if (Number.isNaN(filters.budgetMax)) {
        res.status(400).json({ error: 'budget_max must be a number' });
        return;
      }
    }
    if (req.query.status != null) {
      filters.status = Number(req.query.status);
      if (Number.isNaN(filters.status)) {
        res.status(400).json({ error: 'status must be a number' });
        return;
      }
    }
    if (req.query.deadline) {
      filters.deadline = req.query.deadline as string;
    }
    if (req.query.max_existing_bids != null) {
      filters.maxExistingBids = Number(req.query.max_existing_bids);
      if (Number.isNaN(filters.maxExistingBids)) {
        res.status(400).json({ error: 'max_existing_bids must be a number' });
        return;
      }
    }
    if (req.query.cursor) {
      filters.cursor = req.query.cursor as string;
    }
    if (req.query.limit) {
      filters.limit = Number(req.query.limit);
      if (Number.isNaN(filters.limit)) {
        res.status(400).json({ error: 'limit must be a number' });
        return;
      }
    }

    // Try DB first, fall back to on-chain
    let result;
    try {
      result = await feedService.getJobFeed(filters);
    } catch {
      result = { items: [], nextCursor: null };
    }

    if (result.items.length === 0) {
      // Read directly from chain
      try {
        const onChainJobs = await chainReader.getJobs();
        let filtered = onChainJobs;

        if (filters.tags?.length) {
          filtered = filtered.filter((j) =>
            filters.tags!.some((t) => j.tags.includes(t)),
          );
        }
        if (filters.status != null) {
          const statusStr = ['open', 'in_progress', 'delivered', 'completed', 'disputed'][filters.status] || '';
          filtered = filtered.filter((j) => j.status === statusStr);
        }
        if (req.query.poster) {
          const poster = (req.query.poster as string).toLowerCase();
          filtered = filtered.filter((j) => j.poster.toLowerCase() === poster);
        }

        res.json({
          data: filtered,
          nextCursor: null,
          total: filtered.length,
        });
        return;
      } catch (chainErr) {
        console.error('[feed] chain reader fallback error:', chainErr);
      }
    }

    res.json({
      data: result.items,
      nextCursor: result.nextCursor,
      total: result.items.length,
    });
  } catch (err) {
    console.error('[feed] GET /jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/feed/jobs/recommended
//
// Query params:
//   agent_address - required, the agent's wallet address
//   strategy      - optional: opportunity | budget | competition | reputation_match
// ────────────────────────────────────────────────────────────

router.get('/jobs/recommended', async (req: Request, res: Response) => {
  try {
    const agentAddress = req.query.agent_address as string | undefined;

    if (!agentAddress) {
      res.status(400).json({ error: 'agent_address query parameter is required' });
      return;
    }

    const strategy = (req.query.strategy as string) ?? 'opportunity';
    const validStrategies = ['opportunity', 'budget', 'competition', 'reputation_match'];
    if (!validStrategies.includes(strategy)) {
      res.status(400).json({
        error: `strategy must be one of: ${validStrategies.join(', ')}`,
      });
      return;
    }

    const recommendations = await feedService.getRecommendedJobs(agentAddress, strategy);
    res.json({ data: recommendations, total: recommendations.length });
  } catch (err) {
    console.error('[feed] GET /jobs/recommended error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/feed/jobs/:id — single job from chain
// ────────────────────────────────────────────────────────────

router.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'id must be a number' });
      return;
    }
    const job = await chainReader.getJob(id);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json({ data: job });
  } catch (err) {
    console.error('[feed] GET /jobs/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/feed/search
//
// Full-text search across jobs and agents.
// Query params:
//   q      - search text (required)
//   type   - jobs | agents | all (default: all)
//   status - filter by status string
//   limit  - page size (default 20, max 100)
//   cursor - pagination cursor
// ────────────────────────────────────────────────────────────

router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string | undefined;
    if (!q || !q.trim()) {
      res.status(400).json({ error: 'q query parameter is required' });
      return;
    }

    const filters: SearchFilters = { q: q.trim() };

    if (req.query.type) {
      const type = req.query.type as string;
      if (!['jobs', 'agents', 'all'].includes(type)) {
        res.status(400).json({ error: 'type must be one of: jobs, agents, all' });
        return;
      }
      filters.type = type as SearchFilters['type'];
    }
    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    if (req.query.limit) {
      filters.limit = Number(req.query.limit);
      if (Number.isNaN(filters.limit)) {
        res.status(400).json({ error: 'limit must be a number' });
        return;
      }
    }
    if (req.query.cursor) {
      filters.cursor = req.query.cursor as string;
    }

    const result = await feedService.search(filters);
    res.json({
      data: result.items,
      nextCursor: result.nextCursor,
      total: result.items.length,
    });
  } catch (err) {
    console.error('[feed] GET /search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/feed/agents
//
// Query params:
//   capabilities   - comma-separated capability tags
//   reputation_min - minimum reputation score
//   status         - agent status filter (active, inactive, etc.)
//   cursor         - pagination cursor
//   limit          - page size (default 20, max 100)
// ────────────────────────────────────────────────────────────

router.get('/agents', async (req: Request, res: Response) => {
  try {
    const filters: {
      capabilities?: string[];
      reputationMin?: number;
      status?: string;
      cursor?: string;
      limit?: number;
    } = {};

    if (req.query.capabilities) {
      filters.capabilities = (req.query.capabilities as string)
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }
    if (req.query.reputation_min) {
      filters.reputationMin = Number(req.query.reputation_min);
      if (Number.isNaN(filters.reputationMin)) {
        res.status(400).json({ error: 'reputation_min must be a number' });
        return;
      }
    }
    if (req.query.status) {
      filters.status = req.query.status as string;
    }
    if (req.query.cursor) {
      filters.cursor = req.query.cursor as string;
    }
    if (req.query.limit) {
      filters.limit = Number(req.query.limit);
      if (Number.isNaN(filters.limit)) {
        res.status(400).json({ error: 'limit must be a number' });
        return;
      }
    }

    const result = await feedService.getAgentDirectory(filters);
    res.json({
      data: result.items,
      nextCursor: result.nextCursor,
      total: result.items.length,
    });
  } catch (err) {
    console.error('[feed] GET /agents error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
