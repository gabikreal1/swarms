import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { log } from './lib/logger';
import { runMigrations } from './db/migrate';
import jobRoutes from './api/routes';
import marketRouter from './api/market';
import feedRouter from './api/feed';
import streamRouter from './api/stream';
import taxonomyRouter from './api/taxonomy';
import chatRouter from './api/chat';
import ipfsRouter from './api/ipfs';
import authRouter from './api/auth';
import { errorHandler } from './api/middleware';
import { nanopaymentGate, PRICING } from './api/nanopayments';
import { globalLimiter, llmLimiter, freeLimiter, premiumLimiter } from './api/rate-limit';
import { EventListener } from './indexer/event-listener';
import { Aggregator } from './indexer/aggregator';
import { EventHub } from './events/event-hub';
import { streamService } from './services/stream';
import { QdrantService } from './vector/qdrant';
import { ValidatorAgent } from './validator/validator';
import { AgentWalletManager } from './agent/wallet';
import { syncContractState } from './indexer/contract-sync';

// Suppress noisy ethers.js "@TODO Error" for filter-not-found RPC errors.
// ethers uses console.log internally to print these errors, so we intercept
// both console.log and the underlying stdout/stderr write streams.
const _origConsoleLog = console.log;
const _origConsoleError = console.error;
const suppressFilter = (...args: unknown[]): boolean => {
  const str = args.map(a => typeof a === 'string' ? a : (a as any)?.message ?? '').join(' ');
  return str.includes('filter not found') || str.includes('could not coalesce');
};
console.log = (...args: unknown[]) => { if (!suppressFilter(...args)) _origConsoleLog(...args); };
console.error = (...args: unknown[]) => { if (!suppressFilter(...args)) _origConsoleError(...args); };

// Also intercept raw stream writes for ethers stack traces
for (const stream of [process.stdout, process.stderr] as NodeJS.WriteStream[]) {
  const original = stream.write.bind(stream);
  (stream as any).write = (chunk: any, ...args: any[]) => {
    const str = typeof chunk === 'string' ? chunk : chunk?.toString?.() ?? '';
    if (str.includes('filter not found') || str.includes('@TODO Error') || str.includes('could not coalesce')) return true;
    return (original as any)(chunk, ...args);
  };
}

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(globalLimiter);

// Health check
app.get('/health', async (_req, res) => {
  const checks = {
    db: false,
    rpc: !!config.rpcUrl,
    qdrant: !!config.qdrantUrl,
  };

  // Check DB connectivity
  if (process.env.DATABASE_URL) {
    try {
      const { getPool } = require('./db/pool');
      const pool = getPool();
      await pool.query('SELECT 1');
      checks.db = true;
    } catch {
      checks.db = false;
    }
  }

  // Check critical env vars
  const missingVars: string[] = [];
  if (!process.env.DATABASE_URL) missingVars.push('DATABASE_URL');
  if (!config.rpcUrl) missingVars.push('RPC_URL');

  const status = !checks.db
    ? 'error'
    : missingVars.length > 0
      ? 'degraded'
      : 'ok';

  const statusCode = !checks.db ? 503 : 200;

  res.status(statusCode).json({
    status,
    ...checks,
    timestamp: new Date().toISOString(),
  });
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
        startBlock: process.env.INDEXER_START_BLOCK || '0',
      },
    });
  } catch (err) {
    res.json({ error: (err as Error).message });
  }
});

// ── Rate limiting for LLM-heavy endpoints ────────────────────────────
app.use('/v1/jobs/analyze', llmLimiter);
app.use('/v1/chat/message', llmLimiter);

// ── Job pipeline routes (no payment gating) ─────────────────────────
app.use(jobRoutes);

// ── Feed routes ───────────────────────────────────────────────────────
// Premium: /v1/feed/jobs/recommended (must be mounted before the free feed router)
app.use('/v1/feed/jobs/recommended', premiumLimiter, nanopaymentGate(PRICING.premium));
// Free: /v1/feed/jobs, /v1/feed/agents
app.use('/v1/feed', freeLimiter, feedRouter);

// ── IPFS routes (pin requires auth, fetch is free) ──────────────────
app.use('/v1/ipfs', llmLimiter, ipfsRouter);

// ── Auth routes ──────────────────────────────────────────────────────
app.use('/v1/auth', authRouter);

// ── Butler chat routes (auth required) ──────────────────────────────
app.use('/v1/chat', chatRouter);

// ── Stream routes (free) ─────────────────────────────────────────────
app.use('/v1/stream', freeLimiter, streamRouter);

// ── Taxonomy routes ──────────────────────────────────────────────────
// Standard: /v1/taxonomy/match
app.use('/v1/taxonomy/match', nanopaymentGate(PRICING.standard));
// Free: /v1/taxonomy/tree, /v1/taxonomy/tags, /v1/taxonomy/suggest
app.use('/v1/taxonomy', freeLimiter, taxonomyRouter);

// ── Market / analytics / stats routes ────────────────────────────────
// Premium: /v1/analytics/clusters/:tag/breakdown (must come before standard clusters)
app.use('/v1/analytics/clusters/:tag/breakdown', premiumLimiter, nanopaymentGate(PRICING.premium));
// Standard: /v1/analytics/clusters
app.use('/v1/analytics/clusters', premiumLimiter, nanopaymentGate(PRICING.standard));
// Standard: /v1/market/trends
app.use('/v1/market/trends', premiumLimiter, nanopaymentGate(PRICING.standard));
// Standard: /v1/market/supply-demand
app.use('/v1/market/supply-demand', premiumLimiter, nanopaymentGate(PRICING.standard));
// Premium: /v1/market/prices
app.use('/v1/market/prices', premiumLimiter, nanopaymentGate(PRICING.premium));
// Premium: /v1/stats/agent/:address
app.use('/v1/stats/agent/:address', premiumLimiter, nanopaymentGate(PRICING.premium));
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
    log.qdrant.info('collections initialized');
  } catch (err) {
    log.qdrant.warn('failed to initialize collections:', (err as Error).message);
  }

  // Start Aggregator (periodic materialized-view refreshes)
  const aggregator = new Aggregator();
  aggregator.start(60_000, 300_000);

  // Start EventHub (WebSocket contract subscriptions → SSE broadcast)
  const { orderBookAddress, agentRegistryAddress, reputationTokenAddress, escrowAddress, jobRegistryAddress } = config;
  if (orderBookAddress || config.validationOracleAddress) {
    const eventHub = new EventHub(streamService);
    eventHub.start().catch((err) =>
      log.hub.error('failed to start:', (err as Error).message),
    );
  } else {
    log.hub.info('skipped — no contract addresses configured');
  }

  app.listen(config.port, async () => {
    log.server.info(`listening on port ${config.port}`);

    // Sync current contract state (reads latest on-chain data directly)
    if (orderBookAddress && jobRegistryAddress) {
      syncContractState().catch((err) =>
        log.indexer.error('contract-sync failed:', (err as Error).message),
      );
    }

    // Start on-chain event indexer (polling) if contract addresses are configured
    if (orderBookAddress && agentRegistryAddress && reputationTokenAddress && escrowAddress && jobRegistryAddress) {
      const listener = new EventListener({
        rpcUrl: config.rpcUrl,
        orderBookAddress,
        agentRegistryAddress,
        reputationTokenAddress,
        escrowAddress,
        jobRegistryAddress,
        pollIntervalMs: 10_000,
        startBlock: Number(process.env.INDEXER_START_BLOCK ?? 0),
      });
      listener.start().catch((err) =>
        log.indexer.error('failed to start:', (err as Error).message),
      );
    } else {
      log.indexer.info('skipped — contract addresses not fully configured');
    }

    // Start Validator Agent if configured
    if (config.validationOracleAddress && config.validatorPrivateKey && orderBookAddress) {
      const walletManager = new AgentWalletManager();
      walletManager.createWallet('validator', config.validatorPrivateKey);
      const validator = new ValidatorAgent(walletManager);
      await validator.init();
      await validator.startListening();
      log.validator.info(`listening — wallet ${walletManager.getWallet('validator')?.address}`);
    } else {
      log.validator.info('skipped — VALIDATION_ORACLE_ADDRESS or VALIDATOR_PRIVATE_KEY not configured');
    }
  });
}

start().catch((err) => {
  log.server.error('failed to start:', err);
  process.exit(1);
});

export default app;
