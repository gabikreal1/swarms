import { ethers, Contract, JsonRpcProvider } from 'ethers';
import { log } from '../lib/logger';
import { config } from '../config';
import { insertJob, insertBid } from '../db/queries';
import { pinata } from '../services/pinata';

/**
 * Directly reads current contract state (not events) and upserts into the DB.
 * Iterates job IDs 1..N until getJob reverts, syncing each job + its bids.
 */

const JOB_REGISTRY_READ_ABI = [
  'function getJob(uint256 jobId) view returns (tuple(tuple(uint256 id, address poster, string description, string metadataURI, string[] tags, uint64 deadline, uint256 createdAt) metadata, uint8 status, bytes32 deliveryProof, uint256 deliveredAt) job, tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, bool accepted, uint256 createdAt)[] bids)',
];

const ORDER_BOOK_READ_ABI = [
  'function getJob(uint256 jobId) view returns (tuple(address poster, uint8 status, uint256 acceptedBidId, bytes32 deliveryProof, bool hasDispute) job, tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, string responseURI, bool accepted, uint256 createdAt)[] bids)',
];

const STATUS_MAP: Record<number, string> = {
  0: 'open',
  1: 'in_progress',
  2: 'delivered',
  3: 'completed',
  4: 'disputed',
  5: 'validating',
};

export async function syncContractState(): Promise<void> {
  const { rpcUrl, orderBookAddress, jobRegistryAddress } = config;
  if (!orderBookAddress || !jobRegistryAddress) {
    log.indexer.info('contract-sync skipped — no contract addresses');
    return;
  }

  const network = new ethers.Network('arc-testnet', 5042002);
  const provider = new JsonRpcProvider(rpcUrl, network, { staticNetwork: network });
  provider.resolveName = async (name: string) => {
    try { return ethers.getAddress(name); } catch { return null; }
  };

  const jobRegistry = new Contract(jobRegistryAddress, JOB_REGISTRY_READ_ABI, provider);
  const orderBook = new Contract(orderBookAddress, ORDER_BOOK_READ_ABI, provider);

  const currentBlock = await provider.getBlockNumber();
  log.indexer.info(`contract-sync: reading state at block ${currentBlock}`);

  let synced = 0;
  let bidssynced = 0;

  for (let jobId = 1; ; jobId++) {
    try {
      // Read from both contracts
      const [jobRegistryData, orderBookData] = await Promise.all([
        jobRegistry.getJob(jobId).catch(() => null),
        orderBook.getJob(jobId).catch(() => null),
      ]);

      if (!jobRegistryData && !orderBookData) {
        // Both reverted — no more jobs
        break;
      }

      // Extract job metadata (prefer JobRegistry which has full metadata)
      let poster = '';
      let description = '';
      let metadataURI = '';
      let tags: string[] = [];
      let deadline = 0n;
      let status = 'open';
      let budget: string | undefined;
      let category: string | undefined;

      if (jobRegistryData) {
        const [jobData] = jobRegistryData;
        const meta = jobData.metadata;
        poster = meta.poster;
        description = meta.description;
        metadataURI = meta.metadataURI;
        tags = Array.from(meta.tags);
        deadline = BigInt(meta.deadline);
        status = STATUS_MAP[Number(jobData.status)] || 'open';
      }

      // Extract budget and category from IPFS metadata (best-effort)
      if (metadataURI) {
        try {
          const ipfsMeta = await pinata.fetchJSON(metadataURI);
          if (ipfsMeta?.budget?.amount != null) {
            budget = String(Math.round(ipfsMeta.budget.amount * 1e6));
          }
          if (ipfsMeta?.category) {
            category = ipfsMeta.category;
          }
        } catch (err) {
          log.indexer.debug(`IPFS metadata fetch for job ${jobId} skipped:`, (err as Error).message);
        }
      }

      // OrderBook has poster + more accurate status
      if (orderBookData) {
        const [obJob] = orderBookData;
        if (!poster) poster = obJob.poster;
        status = STATUS_MAP[Number(obJob.status)] || status;
      }

      if (!poster || poster === ethers.ZeroAddress) {
        // Empty/deleted job slot — skip
        break;
      }

      // Upsert job
      const jobUuid = await insertJob({
        chainId: BigInt(jobId),
        poster,
        description,
        metadataUri: metadataURI,
        tags,
        deadline,
        budget,
        category,
        blockNumber: BigInt(currentBlock),
        txHash: '0x' + '0'.repeat(64), // placeholder — we don't have the original tx
      });

      synced++;

      // Sync bids from OrderBook
      if (orderBookData) {
        const [, bids] = orderBookData;
        for (const bid of bids) {
          if (!bid.bidder || bid.bidder === ethers.ZeroAddress) continue;
          try {
            await insertBid({
              chainId: BigInt(bid.id),
              jobId: jobUuid,
              bidder: bid.bidder,
              price: BigInt(bid.price),
              deliveryTime: BigInt(bid.deliveryTime),
              reputation: BigInt(bid.reputation),
              metadataUri: bid.metadataURI || '',
              blockNumber: BigInt(currentBlock),
              txHash: '0x' + '0'.repeat(64),
            });
            bidssynced++;
          } catch (err) {
            log.indexer.warn(`contract-sync: bid ${bid.id} for job ${jobId} failed:`, (err as Error).message);
          }
        }
      }

      log.indexer.info(`contract-sync: job ${jobId} poster=${poster.slice(0, 10)}... status=${status} bids=${orderBookData ? orderBookData[1].length : 0}`);
    } catch (err) {
      // getJob reverted — we've passed the last job
      log.indexer.info(`contract-sync: job ${jobId} reverted — end of jobs`);
      break;
    }
  }

  log.indexer.info(`contract-sync: done — ${synced} jobs, ${bidssynced} bids synced`);
}
