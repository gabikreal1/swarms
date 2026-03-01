import { ethers, Contract, Provider, WebSocketProvider, JsonRpcProvider } from "ethers";
import { getPool } from "../db/pool";
import {
  insertJob,
  insertBid,
  markBidAcceptedByChainId,
  insertDelivery,
  updateJobStatusByChainId,
  insertDispute,
  updateDisputeStatusByChainId,
  insertAgent,
  updateAgentReputation,
  insertReputationEvent,
  insertEscrow,
  getLastBlock,
  setLastBlock,
  getJobUuidByChainId,
  getBidUuidByChainId,
} from "../db/queries";
import { streamService, StreamEvent } from "../services/stream";

// ────────────────────────────────────────────────────────────
// Minimal ABIs (event signatures only)
// ────────────────────────────────────────────────────────────

const ORDER_BOOK_ABI = [
  "event JobPosted(uint256 indexed jobId, address indexed poster)",
  "event BidPlaced(uint256 indexed jobId, uint256 indexed bidId, address bidder, uint256 price)",
  "event BidAccepted(uint256 indexed jobId, uint256 indexed bidId, address poster, address agent)",
  "event BidResponseSubmitted(uint256 indexed jobId, uint256 indexed bidId, string responseURI)",
  "event DeliverySubmitted(uint256 indexed jobId, uint256 indexed bidId, bytes32 proofHash)",
  "event JobApproved(uint256 indexed jobId, uint256 indexed bidId)",
  "event DisputeRaised(uint256 indexed disputeId, uint256 indexed jobId, address indexed initiator, string reason)",
  "event EvidenceSubmitted(uint256 indexed disputeId, address indexed submitter, string evidence)",
  "event DisputeResolved(uint256 indexed disputeId, uint256 indexed jobId, uint8 resolution, string message)",
];

const AGENT_REGISTRY_ABI = [
  "event AgentRegistered(address indexed wallet, string name, string metadataURI)",
  "event AgentUpdated(address indexed wallet, uint8 status)",
  "event ReputationSynced(address indexed wallet, uint256 reputation)",
];

const REPUTATION_TOKEN_ABI = [
  "event ReputationUpdated(address indexed agent, uint256 score, tuple(uint64 jobsCompleted, uint64 jobsFailed, uint128 totalEarned, uint64 lastUpdated) stats)",
];

const ESCROW_ABI = [
  "event EscrowCreated(uint256 indexed jobId, address indexed user, address indexed agent, uint256 amount)",
  "event PaymentReleased(uint256 indexed jobId, address indexed agent, uint256 payout, uint256 fee)",
  "event PaymentRefunded(uint256 indexed jobId, address indexed user, uint256 amount)",
];

// ────────────────────────────────────────────────────────────
// Dispute status mapping (mirrors OrderBook.DisputeStatus)
// ────────────────────────────────────────────────────────────

const DISPUTE_STATUS_MAP: Record<number, string> = {
  0: "none",
  1: "pending",
  2: "under_review",
  3: "resolved_user",
  4: "resolved_agent",
  5: "dismissed",
};

// ────────────────────────────────────────────────────────────
// JobRegistry ABI (to read full job metadata after JobPosted)
// ────────────────────────────────────────────────────────────

const JOB_REGISTRY_READ_ABI = [
  "function getJob(uint256 jobId) view returns (tuple(tuple(uint256 id, address poster, string description, string metadataURI, string[] tags, uint64 deadline, uint256 createdAt) metadata, uint8 status, bytes32 deliveryProof, uint256 deliveredAt) job, tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, bool accepted, uint256 createdAt)[] bids)",
];

const ORDER_BOOK_READ_ABI = [
  "function getJob(uint256 jobId) view returns (tuple(address poster, uint8 status, uint256 acceptedBidId, bytes32 deliveryProof, bool hasDispute) job, tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, string responseURI, bool accepted, uint256 createdAt)[] bids)",
];

// ────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────

export interface EventListenerConfig {
  rpcUrl: string;
  orderBookAddress: string;
  agentRegistryAddress: string;
  reputationTokenAddress: string;
  escrowAddress: string;
  jobRegistryAddress: string;
  pollIntervalMs?: number;
  startBlock?: number;
}

// ────────────────────────────────────────────────────────────
// EventListener
// ────────────────────────────────────────────────────────────

export class EventListener {
  private provider: Provider;
  private orderBook: Contract;
  private agentRegistry: Contract;
  private reputationToken: Contract;
  private escrowContract: Contract;
  private jobRegistryReader: Contract;
  private orderBookReader: Contract;
  private running = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollIntervalMs: number;

  constructor(private config: EventListenerConfig) {
    this.pollIntervalMs = config.pollIntervalMs ?? 5_000;

    const network = new ethers.Network('arc-testnet', config.rpcUrl.includes('testnet') ? 5042002 : 5042002);
    if (config.rpcUrl.startsWith("ws")) {
      this.provider = new WebSocketProvider(config.rpcUrl, network, { staticNetwork: network });
    } else {
      this.provider = new JsonRpcProvider(config.rpcUrl, network, { staticNetwork: network });
    }

    // Disable ENS resolution — this chain has no ENS registry
    this.provider.resolveName = async (name: string) => {
      try { return ethers.getAddress(name); } catch { return null; }
    };

    this.orderBook = new Contract(config.orderBookAddress, ORDER_BOOK_ABI, this.provider);
    this.agentRegistry = new Contract(config.agentRegistryAddress, AGENT_REGISTRY_ABI, this.provider);
    this.reputationToken = new Contract(config.reputationTokenAddress, REPUTATION_TOKEN_ABI, this.provider);
    this.escrowContract = new Contract(config.escrowAddress, ESCROW_ABI, this.provider);
    this.jobRegistryReader = new Contract(config.jobRegistryAddress, JOB_REGISTRY_READ_ABI, this.provider);
    this.orderBookReader = new Contract(config.orderBookAddress, ORDER_BOOK_READ_ABI, this.provider);
  }

  private broadcastEvent(type: StreamEvent["type"], data: Record<string, unknown>): void {
    streamService.broadcast({ type, data, timestamp: new Date().toISOString() });
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    console.log("[EventListener] starting...");

    // Do an initial catch-up, then poll on interval
    await this.poll();
    this.pollTimer = setInterval(() => {
      this.poll().catch((err) =>
        console.error("[EventListener] poll error:", err),
      );
    }, this.pollIntervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log("[EventListener] stopped");
  }

  // ──────────────────────────────────────────────────────────
  // Poll-based block processing
  // ──────────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      // Process sequentially to avoid RPC rate limits
      await this.processContractEvents("OrderBook", this.orderBook, currentBlock);
      await this.processContractEvents("AgentRegistry", this.agentRegistry, currentBlock);
      await this.processContractEvents("ReputationToken", this.reputationToken, currentBlock);
      await this.processContractEvents("Escrow", this.escrowContract, currentBlock);
    } catch (err) {
      console.error("[EventListener] poll failed:", (err as Error).message);
    }
  }

  private async processContractEvents(
    name: string,
    contract: Contract,
    currentBlock: number,
  ): Promise<void> {
    const lastBlock = await getLastBlock(name);
    let fromBlock = Number(lastBlock) === 0 && this.config.startBlock
      ? this.config.startBlock
      : Number(lastBlock) + 1;

    if (fromBlock > currentBlock) {
      console.warn(`[EventListener] ${name}: fromBlock ${fromBlock} is ahead of chain head ${currentBlock}, resetting to 0`);
      fromBlock = 0;
      await setLastBlock(name, 0n);
    }

    console.log(`[EventListener] ${name}: scanning blocks ${fromBlock} → ${currentBlock}`);

    // Process in chunks to avoid RPC limits (10k blocks, delay between queries)
    const chunkSize = 10_000;
    let start = fromBlock;
    let totalLogs = 0;
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    while (start <= currentBlock) {
      const end = Math.min(start + chunkSize - 1, currentBlock);

      // Query each event individually since some RPCs don't support "*" wildcard
      const eventNames = contract.interface.fragments
        .filter((f): f is ethers.EventFragment => f.type === "event")
        .map((f) => f.name);

      for (const eventName of eventNames) {
        try {
          const logs = await contract.queryFilter(eventName, start, end);
          totalLogs += logs.length;
          for (const log of logs) {
            try {
              await this.handleLog(name, contract, log);
            } catch (err) {
              console.error(`[EventListener] error handling ${name}:${eventName} at block ${log.blockNumber}:`, err);
            }
          }
        } catch (err) {
          console.error(`[EventListener] queryFilter ${name}:${eventName} failed:`, (err as Error).message);
        }
        // Rate limit: wait 150ms between queries to stay under 20/sec
        await delay(150);
      }

      await setLastBlock(name, BigInt(end));
      start = end + 1;
    }

    if (totalLogs > 0) {
      console.log(`[EventListener] ${name}: processed ${totalLogs} events`);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Event handlers
  // ──────────────────────────────────────────────────────────

  private async handleLog(
    contractName: string,
    contract: Contract,
    log: ethers.Log | ethers.EventLog,
  ): Promise<void> {
    const parsed = contract.interface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    });
    if (!parsed) return;

    const blockNumber = BigInt(log.blockNumber);
    const txHash = log.transactionHash;

    const key = `${contractName}:${parsed.name}`;

    switch (key) {
      case "OrderBook:JobPosted":
        await this.handleJobPosted(parsed.args, blockNumber, txHash);
        this.broadcastEvent("job.posted", { jobId: Number(parsed.args[0]), poster: parsed.args[1] });
        break;
      case "OrderBook:BidPlaced":
        await this.handleBidPlaced(parsed.args, blockNumber, txHash);
        this.broadcastEvent("job.bid_placed", { jobId: Number(parsed.args[0]), bidId: Number(parsed.args[1]), bidder: parsed.args[2], price: parsed.args[3].toString() });
        break;
      case "OrderBook:BidAccepted":
        await this.handleBidAccepted(parsed.args, blockNumber, txHash);
        this.broadcastEvent("job.bid_accepted", { jobId: Number(parsed.args[0]), bidId: Number(parsed.args[1]), poster: parsed.args[2], agent: parsed.args[3] });
        break;
      case "OrderBook:DeliverySubmitted":
        await this.handleDeliverySubmitted(parsed.args, blockNumber, txHash);
        this.broadcastEvent("job.delivered", { jobId: Number(parsed.args[0]), bidId: Number(parsed.args[1]), proofHash: parsed.args[2] });
        break;
      case "OrderBook:JobApproved":
        await this.handleJobApproved(parsed.args, blockNumber, txHash);
        this.broadcastEvent("job.completed", { jobId: Number(parsed.args[0]), bidId: Number(parsed.args[1]) });
        break;
      case "OrderBook:DisputeRaised":
        await this.handleDisputeRaised(parsed.args, blockNumber, txHash);
        this.broadcastEvent("job.disputed", { disputeId: Number(parsed.args[0]), jobId: Number(parsed.args[1]), initiator: parsed.args[2], reason: parsed.args[3] });
        break;
      case "OrderBook:DisputeResolved":
        await this.handleDisputeResolved(parsed.args, blockNumber, txHash);
        break;
      case "AgentRegistry:AgentRegistered":
        await this.handleAgentRegistered(parsed.args, blockNumber, txHash);
        break;
      case "AgentRegistry:ReputationSynced":
        // No-op: handled via ReputationToken events which have more data
        break;
      case "ReputationToken:ReputationUpdated":
        await this.handleReputationUpdated(parsed.args, blockNumber, txHash);
        break;
      case "Escrow:EscrowCreated":
        await this.handleEscrowCreated(parsed.args, blockNumber, txHash);
        break;
      case "Escrow:PaymentReleased":
        await this.handlePaymentReleased(parsed.args, blockNumber, txHash);
        break;
      case "Escrow:PaymentRefunded":
        await this.handlePaymentRefunded(parsed.args, blockNumber, txHash);
        break;
      default:
        // Unhandled event — skip silently
        break;
    }
  }

  // ── OrderBook handlers ────────────────────────────────────

  private async handleJobPosted(
    args: ethers.Result,
    blockNumber: bigint,
    txHash: string,
  ): Promise<void> {
    const chainJobId = args[0] as bigint;
    const poster = args[1] as string;

    // Read full metadata from JobRegistry
    try {
      const [jobData] = await this.jobRegistryReader.getJob(chainJobId);
      const meta = jobData.metadata;
      await insertJob({
        chainId: chainJobId,
        poster,
        description: meta.description,
        metadataUri: meta.metadataURI,
        tags: Array.from(meta.tags),
        deadline: BigInt(meta.deadline),
        blockNumber,
        txHash,
      });
    } catch {
      // Fallback: insert minimal record
      await insertJob({
        chainId: chainJobId,
        poster,
        description: "",
        metadataUri: "",
        tags: [],
        deadline: 0n,
        blockNumber,
        txHash,
      });
    }
  }

  private async handleBidPlaced(
    args: ethers.Result,
    blockNumber: bigint,
    txHash: string,
  ): Promise<void> {
    const chainJobId = args[0] as bigint;
    const chainBidId = args[1] as bigint;
    const bidder = args[2] as string;
    const price = args[3] as bigint;

    // Resolve job UUID from chain_id
    const jobUuid = await getJobUuidByChainId(chainJobId);
    if (!jobUuid) {
      console.error(`[EventListener] BidPlaced: no job found for chain_id ${chainJobId}`);
      return;
    }

    // Read full bid data from OrderBook
    try {
      const [, bids] = await this.orderBookReader.getJob(chainJobId);
      const bidData = bids.find((b: { id: bigint }) => b.id === chainBidId);
      if (bidData) {
        await insertBid({
          chainId: chainBidId,
          jobId: jobUuid,
          bidder,
          price,
          deliveryTime: BigInt(bidData.deliveryTime),
          reputation: BigInt(bidData.reputation),
          metadataUri: bidData.metadataURI,
          blockNumber,
          txHash,
        });
        return;
      }
    } catch {
      // Fallback below
    }

    await insertBid({
      chainId: chainBidId,
      jobId: jobUuid,
      bidder,
      price,
      deliveryTime: 0n,
      reputation: 0n,
      metadataUri: "",
      blockNumber,
      txHash,
    });
  }

  private async handleBidAccepted(
    args: ethers.Result,
    blockNumber: bigint,
    _txHash: string,
  ): Promise<void> {
    const chainJobId = args[0] as bigint;
    const chainBidId = args[1] as bigint;

    await markBidAcceptedByChainId(chainBidId, "");
    await updateJobStatusByChainId(chainJobId, "in_progress");
  }

  private async handleDeliverySubmitted(
    args: ethers.Result,
    blockNumber: bigint,
    txHash: string,
  ): Promise<void> {
    const chainJobId = args[0] as bigint;
    const chainBidId = args[1] as bigint;
    const proofHash = args[2] as string;

    const jobUuid = await getJobUuidByChainId(chainJobId);
    const bidUuid = await getBidUuidByChainId(chainBidId);
    if (!jobUuid || !bidUuid) {
      console.error(`[EventListener] DeliverySubmitted: missing UUID for job=${chainJobId} bid=${chainBidId}`);
      return;
    }

    await insertDelivery(jobUuid, bidUuid, proofHash, blockNumber, txHash);
    await updateJobStatusByChainId(chainJobId, "delivered");
  }

  private async handleJobApproved(
    args: ethers.Result,
    _blockNumber: bigint,
    _txHash: string,
  ): Promise<void> {
    const chainJobId = args[0] as bigint;
    await updateJobStatusByChainId(chainJobId, "completed");
  }

  private async handleDisputeRaised(
    args: ethers.Result,
    blockNumber: bigint,
    txHash: string,
  ): Promise<void> {
    const chainDisputeId = args[0] as bigint;
    const chainJobId = args[1] as bigint;
    const initiator = args[2] as string;
    const reason = args[3] as string;

    const jobUuid = await getJobUuidByChainId(chainJobId);
    if (!jobUuid) {
      console.error(`[EventListener] DisputeRaised: no job found for chain_id ${chainJobId}`);
      return;
    }

    await insertDispute({ chainId: chainDisputeId, jobId: jobUuid, initiator, reason, blockNumber, txHash });
  }

  private async handleDisputeResolved(
    args: ethers.Result,
    _blockNumber: bigint,
    _txHash: string,
  ): Promise<void> {
    const chainDisputeId = args[0] as bigint;
    const chainJobId = args[1] as bigint;
    const resolution = Number(args[2]);
    const message = args[3] as string;

    const statusStr = DISPUTE_STATUS_MAP[resolution] ?? "none";
    await updateDisputeStatusByChainId(chainDisputeId, statusStr, message);

    // Update job status based on resolution
    if (statusStr === "resolved_user") {
      await updateJobStatusByChainId(chainJobId, "disputed");
    } else if (statusStr === "resolved_agent") {
      await updateJobStatusByChainId(chainJobId, "completed");
    }
  }

  // ── AgentRegistry handlers ───────────────────────────────

  private async handleAgentRegistered(
    args: ethers.Result,
    blockNumber: bigint,
    txHash: string,
  ): Promise<void> {
    const wallet = args[0] as string;
    const name = args[1] as string;
    const metadataUri = args[2] as string;

    await insertAgent({
      wallet,
      name,
      metadataUri,
      capabilities: [],
      blockNumber,
      txHash,
    });
  }

  // ── ReputationToken handlers ─────────────────────────────

  private async handleReputationUpdated(
    args: ethers.Result,
    blockNumber: bigint,
    txHash: string,
  ): Promise<void> {
    const agent = args[0] as string;
    const score = args[1] as bigint;
    const stats = args[2];

    const jobsCompleted = BigInt(stats.jobsCompleted);
    const jobsFailed = BigInt(stats.jobsFailed);
    const totalEarned = BigInt(stats.totalEarned);
    const lastUpdated = BigInt(stats.lastUpdated);

    await insertReputationEvent({
      agent,
      score,
      jobsCompleted,
      jobsFailed,
      totalEarned,
      lastUpdated,
      blockNumber,
      txHash,
    });

    await updateAgentReputation(agent.toLowerCase(), score, jobsCompleted, jobsFailed, totalEarned);
  }

  // ── Escrow handlers ──────────────────────────────────────

  private async handleEscrowCreated(
    args: ethers.Result,
    blockNumber: bigint,
    txHash: string,
  ): Promise<void> {
    const chainJobId = args[0] as bigint;
    const user = args[1] as string;
    const agent = args[2] as string;
    const amount = args[3] as bigint;

    const jobUuid = await getJobUuidByChainId(chainJobId);
    if (!jobUuid) {
      console.error(`[EventListener] EscrowCreated: no job found for chain_id ${chainJobId}`);
      return;
    }

    await insertEscrow(jobUuid, user, agent, amount, blockNumber, txHash);
  }

  private async handlePaymentReleased(
    args: ethers.Result,
    _blockNumber: bigint,
    _txHash: string,
  ): Promise<void> {
    const chainJobId = args[0] as bigint;
    const payout = args[2] as bigint;
    const fee = args[3] as bigint;

    await getPool().query(
      `UPDATE escrows SET released = TRUE, payout = $2, fee = $3
       WHERE job_id = (SELECT id FROM jobs WHERE chain_id = $1)`,
      [chainJobId.toString(), payout.toString(), fee.toString()],
    );
  }

  private async handlePaymentRefunded(
    args: ethers.Result,
    _blockNumber: bigint,
    _txHash: string,
  ): Promise<void> {
    const chainJobId = args[0] as bigint;

    await getPool().query(
      `UPDATE escrows SET refunded = TRUE
       WHERE job_id = (SELECT id FROM jobs WHERE chain_id = $1)`,
      [chainJobId.toString()],
    );
  }
}
