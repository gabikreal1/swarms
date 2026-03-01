/// <reference path="../types/express.d.ts" />
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pinata } from '../services/pinata';
import { authMiddleware } from './auth';
import { log } from '../lib/logger';

const router = Router();

// ── Simple in-memory cache for GET /:cid (5 min TTL, 100 max) ──────
const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 100;

function getCached(cid: string): any | undefined {
  const entry = cache.get(cid);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(cid);
    return undefined;
  }
  return entry.data;
}

function setCache(cid: string, data: any): void {
  // Evict oldest entries if at capacity
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(cid, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ── Schemas ─────────────────────────────────────────────────────────
const pinBodySchema = z.object({
  content: z.record(z.unknown()),
  name: z.string().max(200).optional(),
});

// ── POST /v1/ipfs/pin — pin JSON content (auth required) ───────────
router.post('/pin', authMiddleware, async (req: Request, res: Response) => {
  try {
    const parsed = pinBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
      return;
    }

    const { content, name } = parsed.data;
    const pinName = name || `swarms-upload-${Date.now()}`;

    const result = await pinata.pinJSON(content, pinName);
    log.ipfs.info(`pin by ${req.walletAddress}: ${result.uri}`);
    res.json(result);
  } catch (err) {
    log.ipfs.error('pin failed:', (err as Error).message);
    res.status(502).json({ error: 'IPFS pinning failed' });
  }
});

// ── GET /v1/ipfs/:cid — proxy-fetch JSON from IPFS (free) ─────────
router.get('/:cid', async (req: Request<{ cid: string }>, res: Response) => {
  try {
    const cid = req.params.cid;
    if (!cid || !/^[a-zA-Z0-9]{10,}$/.test(cid)) {
      res.status(400).json({ error: 'Invalid CID' });
      return;
    }

    const cached = getCached(cid);
    if (cached !== undefined) {
      res.json(cached);
      return;
    }

    const data = await pinata.fetchJSON(`ipfs://${cid}`);
    setCache(cid, data);
    res.json(data);
  } catch (err) {
    log.ipfs.error(`fetch ${req.params.cid} failed:`, (err as Error).message);
    res.status(502).json({ error: 'Failed to fetch from IPFS' });
  }
});

export default router;
