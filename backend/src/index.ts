import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import jobRoutes from './api/routes';
import marketRouter from './api/market';
import feedRouter from './api/feed';
import streamRouter from './api/stream';
import taxonomyRouter from './api/taxonomy';
import { errorHandler } from './api/middleware';
import { x402Gate, PRICING } from './api/x402';

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Job pipeline routes (no x402 gating) ──────────────────────────────
app.use(jobRoutes);

// ── Feed routes ───────────────────────────────────────────────────────
// Premium: /v1/feed/jobs/recommended (must be mounted before the free feed router)
app.use('/v1/feed/jobs/recommended', x402Gate(PRICING.premium));
// Free: /v1/feed/jobs, /v1/feed/agents
app.use('/v1/feed', feedRouter);

// ── Stream routes (free) ─────────────────────────────────────────────
app.use('/v1/stream', streamRouter);

// ── Taxonomy routes ──────────────────────────────────────────────────
// Standard: /v1/taxonomy/match
app.use('/v1/taxonomy/match', x402Gate(PRICING.standard));
// Free: /v1/taxonomy/tree, /v1/taxonomy/tags, /v1/taxonomy/suggest
app.use('/v1/taxonomy', taxonomyRouter);

// ── Market / analytics / stats routes ────────────────────────────────
// Premium: /v1/analytics/clusters/:tag/breakdown (must come before standard clusters)
app.use('/v1/analytics/clusters/:tag/breakdown', x402Gate(PRICING.premium));
// Standard: /v1/analytics/clusters
app.use('/v1/analytics/clusters', x402Gate(PRICING.standard));
// Standard: /v1/market/trends
app.use('/v1/market/trends', x402Gate(PRICING.standard));
// Standard: /v1/market/supply-demand
app.use('/v1/market/supply-demand', x402Gate(PRICING.standard));
// Premium: /v1/market/prices
app.use('/v1/market/prices', x402Gate(PRICING.premium));
// Premium: /v1/stats/agent/:address
app.use('/v1/stats/agent/:address', x402Gate(PRICING.premium));
// Free: /v1/stats/overview
app.use('/v1', marketRouter);

// Global error handler (must be last)
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`SWARMS backend listening on port ${config.port}`);
});

export default app;
