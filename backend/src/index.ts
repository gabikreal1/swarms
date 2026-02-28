import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { runMigrations } from './db/migrate';
import jobRoutes from './api/routes';
import marketRouter from './api/market';
import feedRouter from './api/feed';
import streamRouter from './api/stream';
import taxonomyRouter from './api/taxonomy';
import { errorHandler } from './api/middleware';
import { nanopaymentGate, PRICING } from './api/nanopayments';
import { EventListener } from './indexer/event-listener';
import { QdrantService } from './vector/qdrant';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug: indexer state
app.get('/debug/indexer', async (_req, res) => {
  try {
    const { getPool } = require('./db/pool');
    const pool = getPool();
    const state = await pool.query('SELECT * FROM indexer_state');
    const jobCount = await pool.query('SELECT count(*) FROM jobs');
    res.json({
      indexerState: state.rows,
      jobCount: jobCount.rows[0].count,
      envCheck: {
        hasOrderBook: !!config.orderBookAddress,
        hasAgentRegistry: !!config.agentRegistryAddress,
        hasReputationToken: !!config.reputationTokenAddress,
        hasEscrow: !!config.escrowAddress,
        hasJobRegistry: !!config.jobRegistryAddress,
        hasDatabase: !!process.env.DATABASE_URL,
        startBlock: process.env.INDEXER_START_BLOCK || '29457200',
      },
    });
  } catch (err) {
    res.json({ error: (err as Error).message });
  }
});

// ── Job pipeline routes (no payment gating) ─────────────────────────
app.use(jobRoutes);

// ── Feed routes ───────────────────────────────────────────────────────
// Premium: /v1/feed/jobs/recommended (must be mounted before the free feed router)
app.use('/v1/feed/jobs/recommended', nanopaymentGate(PRICING.premium));
// Free: /v1/feed/jobs, /v1/feed/agents
app.use('/v1/feed', feedRouter);

// ── Stream routes (free) ─────────────────────────────────────────────
app.use('/v1/stream', streamRouter);

// ── Taxonomy routes ──────────────────────────────────────────────────
// Standard: /v1/taxonomy/match
app.use('/v1/taxonomy/match', nanopaymentGate(PRICING.standard));
// Free: /v1/taxonomy/tree, /v1/taxonomy/tags, /v1/taxonomy/suggest
app.use('/v1/taxonomy', taxonomyRouter);

// ── Market / analytics / stats routes ────────────────────────────────
// Premium: /v1/analytics/clusters/:tag/breakdown (must come before standard clusters)
app.use('/v1/analytics/clusters/:tag/breakdown', nanopaymentGate(PRICING.premium));
// Standard: /v1/analytics/clusters
app.use('/v1/analytics/clusters', nanopaymentGate(PRICING.standard));
// Standard: /v1/market/trends
app.use('/v1/market/trends', nanopaymentGate(PRICING.standard));
// Standard: /v1/market/supply-demand
app.use('/v1/market/supply-demand', nanopaymentGate(PRICING.standard));
// Premium: /v1/market/prices
app.use('/v1/market/prices', nanopaymentGate(PRICING.premium));
// Premium: /v1/stats/agent/:address
app.use('/v1/stats/agent/:address', nanopaymentGate(PRICING.premium));
// Free: /v1/stats/overview
app.use('/v1', marketRouter);

// Global error handler (must be last)
app.use(errorHandler);

async function start() {
  if (process.env.DATABASE_URL) {
    await runMigrations();
  }

  // Initialize Qdrant collections
  try {
    const qdrant = new QdrantService();
    await qdrant.initCollections();
    console.log('[Qdrant] Collections initialized');
  } catch (err) {
    console.warn('[Qdrant] Failed to initialize collections:', (err as Error).message);
  }

  app.listen(config.port, () => {
    console.log(`SWARMS backend listening on port ${config.port}`);

    // Start on-chain event indexer if contract addresses are configured
    const { orderBookAddress, agentRegistryAddress, reputationTokenAddress, escrowAddress, jobRegistryAddress } = config;
    console.log('[EventListener] config check:', {
      orderBook: !!orderBookAddress,
      agentRegistry: !!agentRegistryAddress,
      reputationToken: !!reputationTokenAddress,
      escrow: !!escrowAddress,
      jobRegistry: !!jobRegistryAddress,
    });
    if (orderBookAddress && agentRegistryAddress && reputationTokenAddress && escrowAddress && jobRegistryAddress) {
      const listener = new EventListener({
        rpcUrl: config.rpcUrl,
        orderBookAddress,
        agentRegistryAddress,
        reputationTokenAddress,
        escrowAddress,
        jobRegistryAddress,
        pollIntervalMs: 10_000,
        startBlock: Number(process.env.INDEXER_START_BLOCK ?? 29457200),
      });
      listener.start().catch((err) =>
        console.error('[EventListener] failed to start:', err),
      );
    } else {
      console.log('[EventListener] skipped — contract addresses not fully configured');
    }
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
