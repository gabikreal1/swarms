import { Router, Request, Response } from 'express';
import { MarketService } from '../services/market';

const router = Router();
const marketService = new MarketService();

// ────────────────────────────────────────────────────────────
// GET /v1/analytics/clusters?category=development&min_jobs=5
// ────────────────────────────────────────────────────────────
router.get('/analytics/clusters', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const minJobs = req.query.min_jobs
      ? parseInt(req.query.min_jobs as string, 10)
      : undefined;

    if (minJobs !== undefined && (isNaN(minJobs) || minJobs < 0)) {
      res.status(400).json({ error: '"min_jobs" must be a non-negative integer' });
      return;
    }

    const clusters = await marketService.getClusterStats({ category, minJobs });
    res.json({ data: clusters, total: clusters.length });
  } catch (err) {
    console.error('[market-api] GET /analytics/clusters failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/analytics/clusters/:tag/breakdown?by=budget_range
// ────────────────────────────────────────────────────────────
router.get(
  '/analytics/clusters/:tag/breakdown',
  async (req: Request<{ tag: string }>, res: Response) => {
    try {
      const tag = req.params.tag;
      const by = req.query.by as string | undefined;

      const validBreakdowns = ['budget_range', 'time_period', 'status'];
      if (!by || !validBreakdowns.includes(by)) {
        res.status(400).json({
          error: `"by" query parameter is required and must be one of: ${validBreakdowns.join(', ')}`,
        });
        return;
      }

      const breakdown = await marketService.getClusterBreakdown(
        tag,
        by as 'budget_range' | 'time_period' | 'status',
      );
      res.json({ data: breakdown });
    } catch (err) {
      console.error('[market-api] GET /analytics/clusters/:tag/breakdown failed', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ────────────────────────────────────────────────────────────
// GET /v1/market/trends?period=week
// ────────────────────────────────────────────────────────────
router.get('/market/trends', async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string | undefined;

    if (period && period !== 'week' && period !== 'month') {
      res.status(400).json({ error: '"period" must be "week" or "month"' });
      return;
    }

    const trends = await marketService.getTrends(
      (period as 'week' | 'month') || 'week',
    );
    res.json({ data: trends, total: trends.length });
  } catch (err) {
    console.error('[market-api] GET /market/trends failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/market/prices?tag=solidity&interval=week
// ────────────────────────────────────────────────────────────
router.get('/market/prices', async (req: Request, res: Response) => {
  try {
    const tag = req.query.tag as string | undefined;
    const interval = req.query.interval as string | undefined;

    if (!tag || tag.trim().length === 0) {
      res.status(400).json({ error: 'Query parameter "tag" is required' });
      return;
    }

    if (interval && !['day', 'week', 'month'].includes(interval)) {
      res
        .status(400)
        .json({ error: '"interval" must be "day", "week", or "month"' });
      return;
    }

    const series = await marketService.getPriceSeries(
      tag,
      (interval as 'day' | 'week' | 'month') || 'week',
    );
    res.json({ data: series });
  } catch (err) {
    console.error('[market-api] GET /market/prices failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/market/supply-demand?tags=solidity,react
// ────────────────────────────────────────────────────────────
router.get('/market/supply-demand', async (req: Request, res: Response) => {
  try {
    const tagsParam = req.query.tags as string | undefined;
    const tags = tagsParam
      ? tagsParam
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : undefined;

    const result = await marketService.getSupplyDemand(tags);
    res.json({ data: result, total: result.length });
  } catch (err) {
    console.error('[market-api] GET /market/supply-demand failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/stats/overview
// ────────────────────────────────────────────────────────────
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const overview = await marketService.getOverview();
    res.json({ data: overview });
  } catch (err) {
    console.error('[market-api] GET /stats/overview failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/stats/agent/:address
// ────────────────────────────────────────────────────────────
router.get('/stats/agent/:address', async (req: Request<{ address: string }>, res: Response) => {
  try {
    const address = req.params.address;

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      res.status(400).json({ error: 'Invalid Ethereum address format' });
      return;
    }

    const stats = await marketService.getAgentStats(address);
    if (!stats) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    res.json({ data: stats });
  } catch (err) {
    console.error('[market-api] GET /stats/agent/:address failed', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
