import {
  insertReputationEvent,
  updateAgentReputation,
} from '../../db/queries';
import { fakeTxHash, timestampToBlock } from '../utils';
import type { SeededAgent } from './agents';
import type { SeededJob } from './jobs';
import type { SeededBid } from './bids';

export async function seedReputation(
  agents: SeededAgent[],
  jobs: SeededJob[],
  bidsByJob: Map<string, SeededBid[]>,
  genesisDate: Date,
): Promise<void> {
  const now = new Date();

  // Tally stats per agent
  const stats = new Map<string, {
    completed: number;
    failed: number;
    earned: bigint;
  }>();

  for (const agent of agents) {
    stats.set(agent.wallet, { completed: 0, failed: 0, earned: 0n });
  }

  for (const job of jobs) {
    const bids = bidsByJob.get(job.id) ?? [];
    const acceptedBid = bids.find((b) => b.accepted);
    if (!acceptedBid) continue;

    const agentStats = stats.get(acceptedBid.bidder);
    if (!agentStats) continue;

    if (job.status === 'completed') {
      agentStats.completed++;
      agentStats.earned += acceptedBid.price;
    } else if (job.status === 'disputed') {
      agentStats.failed++;
    }
  }

  const blockNumber = timestampToBlock(now, genesisDate);

  for (const agent of agents) {
    const s = stats.get(agent.wallet)!;
    // Simple reputation formula: completed * 10 - failed * 5, clamped to 0+
    const score = BigInt(Math.max(0, s.completed * 10 - s.failed * 5));

    await insertReputationEvent({
      agent: agent.wallet,
      score,
      jobsCompleted: BigInt(s.completed),
      jobsFailed: BigInt(s.failed),
      totalEarned: s.earned,
      lastUpdated: BigInt(Math.floor(now.getTime() / 1000)),
      blockNumber,
      txHash: fakeTxHash(),
    });

    await updateAgentReputation(
      agent.wallet,
      score,
      BigInt(s.completed),
      BigInt(s.failed),
      s.earned,
    );
  }

  console.log(`  [reputation] updated reputation for ${agents.length} agents`);
}
