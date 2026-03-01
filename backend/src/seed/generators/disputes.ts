import { randomUUID } from 'crypto';
import { insertDispute, updateDisputeStatus } from '../../db/queries';
import {
  fakeTxHash, timestampToBlock, addHours, pick,
} from '../utils';
import { pickDisputeReason, pickResolutionMessage } from '../templates/deliveries';
import type { SeededJob } from './jobs';

export async function seedDisputes(
  jobs: SeededJob[],
  genesisDate: Date,
): Promise<void> {
  const disputedJobs = jobs.filter((j) => j.status === 'disputed');

  for (const job of disputedJobs) {
    const disputeDate = addHours(job.createdAt, 72, 336); // 3-14 days after creation
    const blockNumber = timestampToBlock(disputeDate, genesisDate);

    const disputeId = randomUUID();

    await insertDispute({
      id: disputeId,
      jobId: job.id,
      initiator: job.poster,
      reason: pickDisputeReason(),
      blockNumber,
      txHash: fakeTxHash(),
    });

    // Resolve some disputes
    const r = Math.random();
    if (r < 0.4) {
      await updateDisputeStatus(
        disputeId,
        'resolved_user',
        pickResolutionMessage(),
      );
    } else if (r < 0.7) {
      await updateDisputeStatus(
        disputeId,
        'resolved_agent',
        pickResolutionMessage(),
      );
    }
    // else: leave as 'pending' (~30%)
  }

  console.log(`  [disputes] seeded ${disputedJobs.length} disputes`);
}
