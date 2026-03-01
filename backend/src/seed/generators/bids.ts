import { randomUUID } from 'crypto';
import { insertBid, markBidAccepted } from '../../db/queries';
import { USDC_MULTIPLIER, type SeedConfig } from '../config';
import {
  randomInt, randomFloat, pick,
  fakeTxHash, fakeIpfsUri, timestampToBlock, addHours,
} from '../utils';
import type { SeededAgent } from './agents';
import type { SeededJob } from './jobs';

export interface SeededBid {
  id: string;
  jobId: string;
  bidder: string;
  price: bigint;
  priceUsdc: number;
  accepted: boolean;
}

/**
 * Find agents whose capabilities overlap with the job's tags.
 */
function findMatchingAgents(job: SeededJob, agents: SeededAgent[]): SeededAgent[] {
  const jobTags = new Set(job.tags);
  const matches = agents.filter((a) =>
    a.capabilities.some((cap) => jobTags.has(cap)),
  );
  // Fallback: if no matches, pick random agents
  return matches.length > 0 ? matches : agents;
}

export async function seedBids(
  cfg: SeedConfig,
  jobs: SeededJob[],
  agents: SeededAgent[],
  genesisDate: Date,
): Promise<Map<string, SeededBid[]>> {
  const bidsByJob = new Map<string, SeededBid[]>();

  for (const job of jobs) {
    const numBids = randomInt(cfg.bidsPerJob.min, cfg.bidsPerJob.max);
    const matching = findMatchingAgents(job, agents);
    const bids: SeededBid[] = [];

    // Pick unique agents for this job
    const shuffled = [...matching].sort(() => Math.random() - 0.5);
    const selectedAgents = shuffled.slice(0, Math.min(numBids, shuffled.length));

    for (let i = 0; i < selectedAgents.length; i++) {
      const agent = selectedAgents[i];
      const priceFactor = randomFloat(0.7, 1.15);
      const priceUsdc = Math.round(job.budgetUsdc * priceFactor);
      const price = BigInt(priceUsdc) * USDC_MULTIPLIER;
      const deliveryTime = BigInt(randomInt(1, 14) * 86400); // 1-14 days in seconds
      const bidDate = addHours(job.createdAt, 1, 48);
      const blockNumber = timestampToBlock(bidDate, genesisDate);

      const bidId = randomUUID();

      await insertBid({
        id: bidId,
        jobId: job.id,
        bidder: agent.wallet,
        price,
        deliveryTime,
        reputation: BigInt(randomInt(0, 100)),
        metadataUri: fakeIpfsUri(),
        blockNumber,
        txHash: fakeTxHash(),
      });

      bids.push({
        id: bidId,
        jobId: job.id,
        bidder: agent.wallet,
        price,
        priceUsdc,
        accepted: false,
      });
    }

    // Accept one bid for jobs past 'open' status
    if (job.status !== 'open' && bids.length > 0) {
      const winnerIdx = randomInt(0, bids.length - 1);
      bids[winnerIdx].accepted = true;
      await markBidAccepted(bids[winnerIdx].id, fakeIpfsUri());
    }

    bidsByJob.set(job.id, bids);
  }

  const totalBids = Array.from(bidsByJob.values()).reduce((sum, b) => sum + b.length, 0);
  console.log(`  [bids] seeded ${totalBids} bids across ${jobs.length} jobs`);

  return bidsByJob;
}
