import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import {
  streamService,
  StreamFilters,
  StreamEventType,
} from '../services/stream';

const router = Router();

// Valid event types for validation
const VALID_EVENT_TYPES: StreamEventType[] = [
  'job.posted',
  'job.bid_placed',
  'job.bid_accepted',
  'job.delivered',
  'job.completed',
  'job.disputed',
  'market.price_shift',
  'market.demand_spike',
];

// ────────────────────────────────────────────────────────────
// GET /v1/stream/jobs
//
// SSE endpoint. Query params:
//   tags     - comma-separated tag filter
//   category - category filter
//   events   - comma-separated event types to subscribe to
//
// Response: text/event-stream with `data: JSON\n\n` frames
// ────────────────────────────────────────────────────────────

router.get('/jobs', (req: Request, res: Response) => {
  const filters: StreamFilters = {};

  if (req.query.tags) {
    filters.tags = (req.query.tags as string).split(',').map((t) => t.trim()).filter(Boolean);
  }

  if (req.query.category) {
    filters.category = req.query.category as string;
  }

  if (req.query.events) {
    const requested = (req.query.events as string).split(',').map((e) => e.trim()) as StreamEventType[];
    const invalid = requested.filter((e) => !VALID_EVENT_TYPES.includes(e));
    if (invalid.length > 0) {
      res.status(400).json({
        error: `Invalid event types: ${invalid.join(', ')}. Valid types: ${VALID_EVENT_TYPES.join(', ')}`,
      });
      return;
    }
    filters.eventTypes = requested;
  }

  const connectionId = uuid();
  streamService.addConnection(connectionId, res, filters);
});

// ────────────────────────────────────────────────────────────
// POST /v1/alerts/subscribe
//
// Body:
//   url          - required, webhook endpoint URL
//   event_types  - required, array of StreamEventType
//   tags         - optional, array of tag filters
// ────────────────────────────────────────────────────────────

router.post('/alerts/subscribe', (req: Request, res: Response) => {
  const { url, event_types, tags } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: '"url" is required and must be a string' });
    return;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: '"url" must be a valid URL' });
    return;
  }

  if (!event_types || !Array.isArray(event_types) || event_types.length === 0) {
    res.status(400).json({
      error: '"event_types" is required and must be a non-empty array',
    });
    return;
  }

  const invalid = event_types.filter(
    (e: string) => !VALID_EVENT_TYPES.includes(e as StreamEventType),
  );
  if (invalid.length > 0) {
    res.status(400).json({
      error: `Invalid event types: ${invalid.join(', ')}. Valid types: ${VALID_EVENT_TYPES.join(', ')}`,
    });
    return;
  }

  if (tags && !Array.isArray(tags)) {
    res.status(400).json({ error: '"tags" must be an array of strings' });
    return;
  }

  const subscription = streamService.addWebhookSubscription({
    url,
    eventTypes: event_types as StreamEventType[],
    tags: tags as string[] | undefined,
    active: true,
  });

  res.status(201).json({ data: subscription });
});

// ────────────────────────────────────────────────────────────
// GET /v1/alerts/subscriptions
// ────────────────────────────────────────────────────────────

router.get('/alerts/subscriptions', (_req: Request, res: Response) => {
  const subscriptions = streamService.getSubscriptions();
  res.json({ data: subscriptions, total: subscriptions.length });
});

// ────────────────────────────────────────────────────────────
// DELETE /v1/alerts/subscriptions/:id
// ────────────────────────────────────────────────────────────

router.delete('/alerts/subscriptions/:id', (req: Request, res: Response) => {
  const id = req.params.id as string;
  const removed = streamService.removeSubscription(id);

  if (!removed) {
    res.status(404).json({ error: 'Subscription not found' });
    return;
  }

  res.json({ message: 'Subscription removed' });
});

export default router;
