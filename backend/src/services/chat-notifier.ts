import { EventHub, StreamEvent } from '../events/event-hub';
import { streamService } from './stream';
import { getPool } from '../db/pool';

/**
 * Listens to EventHub events and pushes proactive notifications
 * to active chat sessions via SSE.
 */
export function wireEventHubToChat(eventHub: EventHub): void {
  // When a bid is placed, notify the job poster's chat session
  eventHub.on('job.bid_placed', async (event: StreamEvent) => {
    const jobId = event.data.jobId;
    await notifyChatSession(jobId, {
      type: 'bid_notification',
      data: event.data,
    });
  });

  // When delivery is submitted, notify poster
  eventHub.on('job.delivery_submitted', async (event: StreamEvent) => {
    const jobId = event.data.jobId;
    await notifyChatSession(jobId, {
      type: 'delivery_notification',
      data: event.data,
    });
  });

  // When validation completes, notify poster
  eventHub.on('job.validation_completed', async (event: StreamEvent) => {
    const jobId = event.data.jobId;
    await notifyChatSession(jobId, {
      type: 'validation_notification',
      data: event.data,
    });
  });
}

async function notifyChatSession(
  jobId: unknown,
  notification: { type: string; data: Record<string, unknown> },
): Promise<void> {
  try {
    const pool = getPool();
    // Find chat sessions that have this jobId (UUID) or chainJobId (number) in their context
    const { rows } = await pool.query(
      `SELECT session_id FROM chat_sessions
       WHERE context->>'jobId' = $1
          OR context->>'chainJobId' = $1`,
      [String(jobId)],
    );

    for (const row of rows) {
      streamService.broadcast({
        type: 'job.bid_placed',
        data: {
          sessionId: row.session_id,
          event: notification,
        },
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[chat-notifier] Failed to notify chat session:', err);
  }
}
