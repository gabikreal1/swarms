import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { config } from '../config';
import { getPool } from '../db/pool';

// ABI fragments for events we listen to
const ORDERBOOK_EVENTS_ABI = [
  'event JobPosted(uint256 indexed jobId, address indexed poster)',
  'event BidPlaced(uint256 indexed jobId, uint256 indexed bidId, address bidder, uint256 price)',
  'event BidAccepted(uint256 indexed jobId, uint256 indexed bidId, address poster, address agent)',
  'event DeliverySubmitted(uint256 indexed jobId, uint256 indexed bidId, bytes32 proofHash)',
  'event JobApproved(uint256 indexed jobId, uint256 indexed bidId)',
  'event DisputeRaised(uint256 indexed disputeId, uint256 indexed jobId, address indexed initiator, string reason)',
  'event DisputeResolved(uint256 indexed disputeId, uint256 indexed jobId, uint8 resolution, string message)',
  'event ValidationRequested(uint256 indexed jobId, address validator)',
  'event ValidationCompleted(uint256 indexed jobId, bool passed, uint8 score)',
];

const VALIDATION_ORACLE_EVENTS_ABI = [
  'event ValidationSubmitted(uint256 indexed jobId, bool passed, uint8 score, bytes32 reportHash)',
];

export interface StreamEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Lightweight broadcasting interface so EventHub can push SSE events
 * without importing a concrete StreamService implementation (which may
 * be created by a parallel teammate).
 */
export interface StreamBroadcaster {
  broadcast(event: StreamEvent): void;
}

/**
 * No-op broadcaster used when no StreamService is wired in.
 */
class NullBroadcaster implements StreamBroadcaster {
  broadcast(_event: StreamEvent): void {
    // Events are still logged and materialized to DB; just not streamed.
  }
}

export class EventHub extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private contracts: Map<string, ethers.Contract> = new Map();
  private broadcaster: StreamBroadcaster;

  constructor(broadcaster?: StreamBroadcaster) {
    super();
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.broadcaster = broadcaster ?? new NullBroadcaster();
  }

  setBroadcaster(broadcaster: StreamBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  async start(): Promise<void> {
    if (config.orderBookAddress) {
      const orderBook = new ethers.Contract(
        config.orderBookAddress,
        ORDERBOOK_EVENTS_ABI,
        this.provider,
      );
      this.contracts.set('orderBook', orderBook);

      orderBook.on(
        'JobPosted',
        (jobId: bigint, poster: string) => {
          this.handleJobPosted(jobId, poster);
        },
      );

      orderBook.on(
        'BidPlaced',
        (
          jobId: bigint,
          bidId: bigint,
          bidder: string,
          price: bigint,
        ) => {
          this.handleBidPlaced(jobId, bidId, bidder, price);
        },
      );

      orderBook.on(
        'BidAccepted',
        (
          jobId: bigint,
          bidId: bigint,
          poster: string,
          agent: string,
        ) => {
          this.handleBidAccepted(jobId, bidId, poster, agent);
        },
      );

      orderBook.on(
        'DeliverySubmitted',
        (jobId: bigint, bidId: bigint, proofHash: string) => {
          this.handleDeliverySubmitted(jobId, bidId, proofHash);
        },
      );

      orderBook.on(
        'JobApproved',
        (jobId: bigint, bidId: bigint) => {
          this.handleJobApproved(jobId, bidId);
        },
      );

      orderBook.on(
        'DisputeRaised',
        (
          disputeId: bigint,
          jobId: bigint,
          initiator: string,
          reason: string,
        ) => {
          this.handleDisputeRaised(
            disputeId,
            jobId,
            initiator,
            reason,
          );
        },
      );

      orderBook.on(
        'DisputeResolved',
        (
          disputeId: bigint,
          jobId: bigint,
          resolution: number,
          message: string,
        ) => {
          this.handleDisputeResolved(
            disputeId,
            jobId,
            resolution,
            message,
          );
        },
      );

      orderBook.on(
        'ValidationRequested',
        (jobId: bigint, validator: string) => {
          this.handleValidationRequested(jobId, validator);
        },
      );

      orderBook.on(
        'ValidationCompleted',
        (jobId: bigint, passed: boolean, score: number) => {
          this.handleValidationCompleted(jobId, passed, score);
        },
      );
    }

    if (config.validationOracleAddress) {
      const oracle = new ethers.Contract(
        config.validationOracleAddress,
        VALIDATION_ORACLE_EVENTS_ABI,
        this.provider,
      );
      this.contracts.set('validationOracle', oracle);

      oracle.on(
        'ValidationSubmitted',
        (
          jobId: bigint,
          passed: boolean,
          score: number,
          reportHash: string,
        ) => {
          this.handleValidationSubmitted(
            jobId,
            passed,
            score,
            reportHash,
          );
        },
      );
    }

    console.log('[event-hub] Started listening to on-chain events');
  }

  // ── Event handlers ──────────────────────────────────────────

  private async handleJobPosted(
    jobId: bigint,
    poster: string,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'job.posted',
      data: { jobId: Number(jobId), poster },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.posted', event);

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      ['job.posted', Number(jobId), JSON.stringify(event.data)],
    );
  }

  private async handleBidPlaced(
    jobId: bigint,
    bidId: bigint,
    bidder: string,
    price: bigint,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'job.bid_placed',
      data: {
        jobId: Number(jobId),
        bidId: Number(bidId),
        bidder,
        price: price.toString(),
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.bid_placed', event);

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      ['job.bid_placed', Number(jobId), JSON.stringify(event.data)],
    );
  }

  private async handleBidAccepted(
    jobId: bigint,
    bidId: bigint,
    poster: string,
    agent: string,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'job.bid_accepted',
      data: {
        jobId: Number(jobId),
        bidId: Number(bidId),
        poster,
        agent,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.bid_accepted', event);

    // Update job status in PostgreSQL
    await this.materialize(
      `UPDATE jobs SET status = 'in_progress', updated_at = NOW() WHERE chain_id = $1`,
      [Number(jobId)],
    );

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      ['job.bid_accepted', Number(jobId), JSON.stringify(event.data)],
    );
  }

  private async handleDeliverySubmitted(
    jobId: bigint,
    bidId: bigint,
    proofHash: string,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'job.delivery_submitted',
      data: {
        jobId: Number(jobId),
        bidId: Number(bidId),
        proofHash,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.delivery_submitted', event);

    await this.materialize(
      `UPDATE jobs SET status = 'delivered', updated_at = NOW() WHERE chain_id = $1`,
      [Number(jobId)],
    );

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      [
        'job.delivery_submitted',
        Number(jobId),
        JSON.stringify(event.data),
      ],
    );
  }

  private async handleJobApproved(
    jobId: bigint,
    bidId: bigint,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'job.completed',
      data: { jobId: Number(jobId), bidId: Number(bidId) },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.completed', event);

    await this.materialize(
      `UPDATE jobs SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE chain_id = $1`,
      [Number(jobId)],
    );

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      ['job.completed', Number(jobId), JSON.stringify(event.data)],
    );

    // Emit for downstream consumers (e.g., Qdrant indexing)
    this.emit('job.index_requested', {
      jobId: Number(jobId),
      bidId: Number(bidId),
    });
  }

  private async handleDisputeRaised(
    disputeId: bigint,
    jobId: bigint,
    initiator: string,
    reason: string,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'job.dispute_raised',
      data: {
        disputeId: Number(disputeId),
        jobId: Number(jobId),
        initiator,
        reason,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.dispute_raised', event);

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      [
        'job.dispute_raised',
        Number(jobId),
        JSON.stringify(event.data),
      ],
    );
  }

  private async handleDisputeResolved(
    disputeId: bigint,
    jobId: bigint,
    resolution: number,
    message: string,
  ): Promise<void> {
    const resolutionLabels: Record<number, string> = {
      3: 'resolved_user',
      4: 'resolved_agent',
      5: 'dismissed',
    };
    const resolutionLabel =
      resolutionLabels[resolution] ?? `unknown_${resolution}`;

    const event: StreamEvent = {
      type: 'job.dispute_resolved',
      data: {
        disputeId: Number(disputeId),
        jobId: Number(jobId),
        resolution: resolutionLabel,
        message,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.dispute_resolved', event);

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      [
        'job.dispute_resolved',
        Number(jobId),
        JSON.stringify(event.data),
      ],
    );
  }

  private async handleValidationRequested(
    jobId: bigint,
    validator: string,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'job.validation_requested',
      data: { jobId: Number(jobId), validator },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.validation_requested', event);

    await this.materialize(
      `UPDATE jobs SET status = 'validating', updated_at = NOW() WHERE chain_id = $1`,
      [Number(jobId)],
    );

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      [
        'job.validation_requested',
        Number(jobId),
        JSON.stringify(event.data),
      ],
    );
  }

  private async handleValidationCompleted(
    jobId: bigint,
    passed: boolean,
    score: number,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'job.validation_completed',
      data: { jobId: Number(jobId), passed, score },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('job.validation_completed', event);

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      [
        'job.validation_completed',
        Number(jobId),
        JSON.stringify(event.data),
      ],
    );
  }

  private async handleValidationSubmitted(
    jobId: bigint,
    passed: boolean,
    score: number,
    reportHash: string,
  ): Promise<void> {
    const event: StreamEvent = {
      type: 'validation.submitted',
      data: {
        jobId: Number(jobId),
        passed,
        score,
        reportHash,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcaster.broadcast(event);
    this.emit('validation.submitted', event);

    await this.materialize(
      'INSERT INTO events (type, job_id, data, created_at) VALUES ($1, (SELECT id FROM jobs WHERE chain_id = $2), $3, NOW()) ON CONFLICT DO NOTHING',
      [
        'validation.submitted',
        Number(jobId),
        JSON.stringify(event.data),
      ],
    );
  }

  // ── Helpers ─────────────────────────────────────────────────

  private async materialize(
    query: string,
    params: unknown[],
  ): Promise<void> {
    try {
      const pool = getPool();
      await pool.query(query, params);
    } catch (error) {
      console.error('[event-hub] DB materialization failed:', error);
    }
  }

  async stop(): Promise<void> {
    for (const [name, contract] of this.contracts) {
      contract.removeAllListeners();
      console.log(`[event-hub] Stopped listening on ${name}`);
    }
    this.contracts.clear();
    this.removeAllListeners();
    console.log('[event-hub] Stopped');
  }
}
