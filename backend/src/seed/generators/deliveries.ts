import { insertDelivery, insertEscrow } from '../../db/queries';
import { getPool } from '../../db/pool';
import {
  fakeTxHash, fakeProofHash, timestampToBlock, addHours,
} from '../utils';
import type { SeededJob } from './jobs';
import type { SeededBid } from './bids';

const NEEDS_DELIVERY: Set<string> = new Set([
  'in_progress', 'delivered', 'validating', 'completed', 'disputed',
]);
const NEEDS_ESCROW: Set<string> = new Set([
  'in_progress', 'delivered', 'validating', 'completed', 'disputed',
]);
const HAS_DELIVERED: Set<string> = new Set([
  'delivered', 'validating', 'completed', 'disputed',
]);

export async function seedDeliveriesAndEscrows(
  jobs: SeededJob[],
  bidsByJob: Map<bigint, SeededBid[]>,
  genesisDate: Date,
): Promise<void> {
  let deliveryCount = 0;
  let escrowCount = 0;
  const pool = getPool();

  for (const job of jobs) {
    const bids = bidsByJob.get(job.id) ?? [];
    const acceptedBid = bids.find((b) => b.accepted);
    if (!acceptedBid) continue;

    // Create escrow for all non-open jobs
    if (NEEDS_ESCROW.has(job.status)) {
      const escrowDate = addHours(job.createdAt, 2, 72);
      const blockNumber = timestampToBlock(escrowDate, genesisDate);

      await insertEscrow(
        job.id,
        job.poster,
        acceptedBid.bidder,
        acceptedBid.price,
        blockNumber,
        fakeTxHash(),
      );

      // For completed jobs, release the escrow
      if (job.status === 'completed') {
        const payout = (acceptedBid.price * 95n) / 100n; // 95% to agent
        const fee = acceptedBid.price - payout; // 5% fee
        await pool.query(
          `UPDATE escrows SET released = TRUE, payout = $2, fee = $3 WHERE job_id = $1`,
          [job.id.toString(), payout.toString(), fee.toString()],
        );
      }

      // For disputed jobs resolved in poster's favor, refund
      if (job.status === 'disputed' && Math.random() < 0.3) {
        await pool.query(
          `UPDATE escrows SET refunded = TRUE WHERE job_id = $1`,
          [job.id.toString()],
        );
      }

      escrowCount++;
    }

    // Create delivery for delivered/validating/completed/disputed jobs
    if (HAS_DELIVERED.has(job.status)) {
      const deliveryDate = addHours(job.createdAt, 48, 240);
      const blockNumber = timestampToBlock(deliveryDate, genesisDate);

      await insertDelivery(
        job.id,
        acceptedBid.id,
        fakeProofHash(),
        blockNumber,
        fakeTxHash(),
      );

      // Backdate the delivered_at timestamp
      await pool.query(
        `UPDATE deliveries SET delivered_at = $2 WHERE job_id = $1`,
        [job.id.toString(), deliveryDate.toISOString()],
      );

      deliveryCount++;
    }
  }

  console.log(`  [deliveries] seeded ${deliveryCount} deliveries, ${escrowCount} escrows`);
}
