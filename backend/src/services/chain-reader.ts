import { ethers, Contract, JsonRpcProvider } from 'ethers';
import { config } from '../config';

const JOB_REGISTRY_ABI = [
  'function getJob(uint256 jobId) view returns (tuple(tuple(uint256 id, address poster, string description, string metadataURI, string[] tags, uint64 deadline, uint256 createdAt) metadata, uint8 status, bytes32 deliveryProof, uint256 deliveredAt) job, tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, bool accepted, uint256 createdAt)[] bids)',
];

const ORDER_BOOK_ABI = [
  'function getJob(uint256 jobId) view returns (tuple(address poster, uint8 status, uint256 acceptedBidId, bytes32 deliveryProof, bool hasDispute) job, tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, string responseURI, bool accepted, uint256 createdAt)[] bids)',
];

const STATUS_MAP: Record<number, string> = {
  0: 'open',
  1: 'in_progress',
  2: 'delivered',
  3: 'completed',
  4: 'disputed',
  5: 'cancelled',
};

export interface OnChainJob {
  id: number;
  poster: string;
  description: string;
  metadataURI: string;
  tags: string[];
  deadline: number;
  createdAt: number;
  status: string;
  bids: OnChainBid[];
  hasDispute: boolean;
}

export interface OnChainBid {
  id: number;
  jobId: number;
  bidder: string;
  price: string;
  deliveryTime: number;
  reputation: string;
  metadataURI: string;
  accepted: boolean;
  createdAt: number;
}

export class ChainReader {
  private provider: JsonRpcProvider;
  private jobRegistry: Contract;
  private orderBook: Contract;

  // Simple cache: { jobs, fetchedAt }
  private cache: { jobs: OnChainJob[]; fetchedAt: number } | null = null;
  private cacheTTL = 15_000; // 15 seconds

  constructor() {
    const network = new ethers.Network('arc-testnet', 5042002);
    this.provider = new JsonRpcProvider(config.rpcUrl, network, { staticNetwork: network });
    this.jobRegistry = new Contract(
      config.jobRegistryAddress || '',
      JOB_REGISTRY_ABI,
      this.provider,
    );
    this.orderBook = new Contract(
      config.orderBookAddress || '',
      ORDER_BOOK_ABI,
      this.provider,
    );
  }

  async getJobs(maxId: number = 50): Promise<OnChainJob[]> {
    // Return cached if fresh
    if (this.cache && Date.now() - this.cache.fetchedAt < this.cacheTTL) {
      return this.cache.jobs;
    }

    const jobs: OnChainJob[] = [];

    // Scan from 1 upward until we get an empty job
    for (let id = 1; id <= maxId; id++) {
      try {
        const [regJob, regBids] = await this.jobRegistry.getJob(id);
        const meta = regJob.metadata;

        // Empty poster = no more jobs
        if (meta.poster === '0x0000000000000000000000000000000000000000') break;

        // Get status from OrderBook (more accurate)
        let status = Number(regJob.status);
        let hasDispute = false;
        try {
          const [obJob] = await this.orderBook.getJob(id);
          status = Number(obJob.status);
          hasDispute = obJob.hasDispute;
        } catch {}

        const bids: OnChainBid[] = Array.from(regBids).map((b: any) => ({
          id: Number(b.id),
          jobId: id,
          bidder: b.bidder,
          price: ethers.formatUnits(b.price, 6),
          deliveryTime: Number(b.deliveryTime),
          reputation: b.reputation.toString(),
          metadataURI: b.metadataURI,
          accepted: b.accepted,
          createdAt: Number(b.createdAt),
        }));

        jobs.push({
          id,
          poster: meta.poster,
          description: meta.description,
          metadataURI: meta.metadataURI,
          tags: Array.from(meta.tags),
          deadline: Number(meta.deadline),
          createdAt: Number(meta.createdAt),
          status: STATUS_MAP[status] || 'open',
          bids,
          hasDispute,
        });
      } catch {
        // Job doesn't exist or error — stop scanning
        break;
      }
    }

    this.cache = { jobs, fetchedAt: Date.now() };
    return jobs;
  }

  async getJob(id: number): Promise<OnChainJob | null> {
    try {
      const [regJob, regBids] = await this.jobRegistry.getJob(id);
      const meta = regJob.metadata;

      if (meta.poster === '0x0000000000000000000000000000000000000000') return null;

      let status = Number(regJob.status);
      let hasDispute = false;
      try {
        const [obJob] = await this.orderBook.getJob(id);
        status = Number(obJob.status);
        hasDispute = obJob.hasDispute;
      } catch {}

      const bids: OnChainBid[] = Array.from(regBids).map((b: any) => ({
        id: Number(b.id),
        jobId: id,
        bidder: b.bidder,
        price: ethers.formatUnits(b.price, 6),
        deliveryTime: Number(b.deliveryTime),
        reputation: b.reputation.toString(),
        metadataURI: b.metadataURI,
        accepted: b.accepted,
        createdAt: Number(b.createdAt),
      }));

      return {
        id,
        poster: meta.poster,
        description: meta.description,
        metadataURI: meta.metadataURI,
        tags: Array.from(meta.tags),
        deadline: Number(meta.deadline),
        createdAt: Number(meta.createdAt),
        status: STATUS_MAP[status] || 'open',
        bids,
        hasDispute,
      };
    } catch {
      return null;
    }
  }
}
