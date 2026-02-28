import { EventEmitter } from 'events';
import { Response } from 'express';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type StreamEventType =
  | 'job.posted'
  | 'job.bid_placed'
  | 'job.bid_accepted'
  | 'job.delivered'
  | 'job.completed'
  | 'job.disputed'
  | 'market.price_shift'
  | 'market.demand_spike';

export interface StreamEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface StreamFilters {
  tags?: string[];
  category?: string;
  eventTypes?: StreamEventType[];
}

export interface WebhookSubscription {
  id: string;
  url: string;
  eventTypes: StreamEventType[];
  tags?: string[];
  createdAt: string;
  active: boolean;
}

// ────────────────────────────────────────────────────────────
// StreamService
// ────────────────────────────────────────────────────────────

export class StreamService extends EventEmitter {
  private connections: Map<string, { res: Response; filters: StreamFilters }> = new Map();
  private webhookSubscriptions: Map<string, WebhookSubscription> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
  }

  /**
   * Register an SSE connection. Sets appropriate headers and stores
   * the connection for later event delivery.
   */
  addConnection(connectionId: string, res: Response, filters: StreamFilters): void {
    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: 'connected', connectionId })}\n\n`);

    this.connections.set(connectionId, { res, filters });

    // Clean up on client disconnect
    res.on('close', () => {
      this.removeConnection(connectionId);
    });
  }

  /**
   * Remove a stored SSE connection.
   */
  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /**
   * Broadcast an event to all matching SSE connections and webhook
   * subscriptions.
   */
  broadcast(event: StreamEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;

    // SSE connections
    for (const [, { res, filters }] of this.connections) {
      if (this.matchesFilters(event, filters)) {
        res.write(payload);
      }
    }

    // Webhooks
    for (const [, sub] of this.webhookSubscriptions) {
      if (!sub.active) continue;
      if (this.matchesWebhook(event, sub)) {
        this.deliverWebhook(sub, event).catch((err) => {
          console.error(`[stream] webhook delivery failed for ${sub.id}:`, err);
        });
      }
    }

    // Emit locally so other in-process consumers can listen
    this.emit('event', event);
  }

  /**
   * Create a webhook subscription. Returns the full subscription object
   * with generated id and timestamp.
   */
  addWebhookSubscription(
    sub: Omit<WebhookSubscription, 'id' | 'createdAt'>,
  ): WebhookSubscription {
    const { v4 } = require('uuid') as typeof import('uuid');
    const subscription: WebhookSubscription = {
      ...sub,
      id: v4(),
      createdAt: new Date().toISOString(),
    };
    this.webhookSubscriptions.set(subscription.id, subscription);
    return subscription;
  }

  /**
   * List all webhook subscriptions.
   */
  getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.webhookSubscriptions.values());
  }

  /**
   * Remove a webhook subscription by id. Returns true if it existed.
   */
  removeSubscription(id: string): boolean {
    return this.webhookSubscriptions.delete(id);
  }

  /**
   * Returns the number of active SSE connections.
   */
  get connectionCount(): number {
    return this.connections.size;
  }

  // ────────────────────────────────────────────────────────────
  // Internal
  // ────────────────────────────────────────────────────────────

  /**
   * Send a heartbeat comment to all SSE connections every 60 s
   * to keep them alive through proxies.
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [, { res }] of this.connections) {
        res.write(': heartbeat\n\n');
      }
    }, 60_000);
  }

  /**
   * Check whether a StreamEvent matches the SSE connection filters.
   */
  private matchesFilters(event: StreamEvent, filters: StreamFilters): boolean {
    // Event type filter
    if (filters.eventTypes && filters.eventTypes.length > 0) {
      if (!filters.eventTypes.includes(event.type)) {
        return false;
      }
    }

    // Tag filter — event.data.tags must overlap with filters.tags
    if (filters.tags && filters.tags.length > 0) {
      const eventTags = (event.data.tags as string[] | undefined) ?? [];
      const hasOverlap = filters.tags.some((t) => eventTags.includes(t));
      if (!hasOverlap) return false;
    }

    // Category filter
    if (filters.category) {
      if (event.data.category !== filters.category) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check whether a StreamEvent matches a webhook subscription's filters.
   */
  private matchesWebhook(event: StreamEvent, sub: WebhookSubscription): boolean {
    if (sub.eventTypes.length > 0 && !sub.eventTypes.includes(event.type)) {
      return false;
    }

    if (sub.tags && sub.tags.length > 0) {
      const eventTags = (event.data.tags as string[] | undefined) ?? [];
      const hasOverlap = sub.tags.some((t) => eventTags.includes(t));
      if (!hasOverlap) return false;
    }

    return true;
  }

  /**
   * POST an event payload to a webhook URL.
   * Retries up to 3 times with exponential backoff on failure.
   */
  private async deliverWebhook(
    sub: WebhookSubscription,
    event: StreamEvent,
  ): Promise<void> {
    const body = JSON.stringify({
      subscriptionId: sub.id,
      event,
    });

    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(sub.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(10_000),
        });

        if (response.ok) return;

        // Non-retryable status codes
        if (response.status >= 400 && response.status < 500) {
          console.warn(
            `[stream] webhook ${sub.id} returned ${response.status}, not retrying`,
          );
          return;
        }
      } catch (err) {
        // Network error — will retry
        console.warn(
          `[stream] webhook ${sub.id} attempt ${attempt + 1} failed:`,
          err,
        );
      }

      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * Math.pow(2, attempt)),
        );
      }
    }

    console.error(
      `[stream] webhook ${sub.id} delivery failed after ${maxRetries} attempts`,
    );
  }

  /**
   * Clean up heartbeat timer and drop all connections.
   */
  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.connections.clear();
    this.webhookSubscriptions.clear();
  }
}

// ── Singleton ───────────────────────────────────────────────
export const streamService = new StreamService();
