import { ethers } from "ethers";
import { config } from "./config.js";
import { log } from "./log.js";

const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const wallet = new ethers.Wallet(config.privateKey, provider);

async function waitForTx(tx: ethers.TransactionResponse, retries = 5): Promise<ethers.TransactionReceipt> {
  for (let i = 0; i < retries; i++) {
    try {
      const receipt = await tx.wait();
      if (receipt) return receipt;
    } catch (err: any) {
      if (i < retries - 1 && (err?.code === "UNKNOWN_ERROR" || err?.message?.includes("rate limit"))) {
        log(`TX receipt fetch rate-limited, retrying in ${(i + 1) * 3}s...`);
        await new Promise((r) => setTimeout(r, (i + 1) * 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to get TX receipt after retries");
}

// Minimal ABIs
const ORDER_BOOK_ABI = [
  "function placeBid(uint256 jobId, uint256 price, uint64 deliveryTime, string metadataURI) returns (uint256 bidId)",
  "function submitDelivery(uint256 jobId, bytes32 proofHash)",
  "function getJob(uint256 jobId) view returns (tuple(address poster, uint8 status, uint256 acceptedBidId, bytes32 deliveryProof, bool hasDispute) job, tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, string responseURI, bool accepted, uint256 createdAt)[] bids)",
];

const AGENT_REGISTRY_ABI = [
  "function registerAgent(string name, string metadataURI, string[] capabilities)",
  "function getAgent(address wallet) view returns (tuple(address wallet, string name, string metadataURI, string[] capabilities, uint8 status, uint256 registeredAt))",
  "function isAgentActive(address wallet) view returns (bool)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const REPUTATION_ABI = [
  "function scoreOf(address agent) view returns (uint256)",
  "function statsOf(address agent) view returns (tuple(uint64 jobsCompleted, uint64 jobsFailed, uint128 totalEarned, uint64 lastUpdated))",
];

const JOB_REGISTRY_ABI = [
  "function getJob(uint256 jobId) view returns (tuple(tuple(uint256 id, address poster, string description, string metadataURI, string[] tags, uint64 deadline, uint256 createdAt) metadata, uint8 status, bytes32 deliveryProof, uint256 deliveredAt) job, tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, bool accepted, uint256 createdAt)[] bids)",
];

const orderBook = new ethers.Contract(config.orderBook, ORDER_BOOK_ABI, wallet);
const agentRegistry = new ethers.Contract(config.agentRegistry, AGENT_REGISTRY_ABI, wallet);
const usdc = new ethers.Contract(config.usdc, ERC20_ABI, wallet);
const reputation = new ethers.Contract(config.reputationToken, REPUTATION_ABI, wallet);
const jobRegistry = new ethers.Contract(config.jobRegistry, JOB_REGISTRY_ABI, provider);

export async function getWalletAddress(): Promise<string> {
  return wallet.address;
}

export async function getUSDCBalance(): Promise<bigint> {
  return usdc.balanceOf(wallet.address);
}

export async function isRegistered(): Promise<boolean> {
  try {
    return await agentRegistry.isAgentActive(wallet.address);
  } catch {
    return false;
  }
}

export async function registerAgent(): Promise<string> {
  log("Registering agent on-chain...");
  const tx = await agentRegistry.registerAgent(config.name, "", config.capabilities);
  const receipt = await waitForTx(tx);
  log(`Registered! TX: ${receipt.hash}`);
  return receipt.hash;
}

export async function getReputation(): Promise<{ score: bigint; completed: bigint; failed: bigint; earned: bigint }> {
  try {
    const score = await reputation.scoreOf(wallet.address);
    const stats = await reputation.statsOf(wallet.address);
    return {
      score,
      completed: stats.jobsCompleted,
      failed: stats.jobsFailed,
      earned: stats.totalEarned,
    };
  } catch {
    return { score: 0n, completed: 0n, failed: 0n, earned: 0n };
  }
}

export async function placeBid(
  jobId: number,
  priceUSDC: number,
  deliveryDays: number,
  description: string,
): Promise<{ bidId: string; txHash: string }> {
  const priceWei = BigInt(Math.round(priceUSDC * 1e6));
  const deliveryTime = BigInt(Math.floor(Date.now() / 1000) + deliveryDays * 86400);

  // Approve USDC if needed
  const allowance = await usdc.allowance(wallet.address, config.escrow);
  if (allowance < priceWei) {
    log(`Approving ${priceUSDC} USDC for escrow...`);
    const approveTx = await usdc.approve(config.escrow, priceWei);
    await waitForTx(approveTx);
    log("USDC approved");
  }

  log(`Placing bid on job #${jobId}: ${priceUSDC} USDC, ${deliveryDays} days`);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (attempt > 0) log(`  Retry ${attempt}/3...`);
      const tx = await orderBook.placeBid(jobId, priceWei, deliveryTime, description);
      const receipt = await waitForTx(tx);
      log(`Bid placed! TX: ${receipt.hash}`);
      return { bidId: "pending", txHash: receipt.hash };
    } catch (err: any) {
      const msg = err?.message || "";
      if (attempt < 3 && (msg.includes("rate limit") || msg.includes("request limit") || err?.code === "UNKNOWN_ERROR")) {
        log(`  Rate limited, waiting ${(attempt + 1) * 5}s...`);
        await new Promise((r) => setTimeout(r, (attempt + 1) * 5000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("placeBid failed after retries");
}

export async function submitDelivery(jobId: number, proofHash: string): Promise<string> {
  log(`Submitting delivery for job #${jobId}...`);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      if (attempt > 0) log(`  Retry ${attempt}/3...`);
      const tx = await orderBook.submitDelivery(jobId, proofHash);
      const receipt = await waitForTx(tx);
      log(`Delivery submitted! TX: ${receipt.hash}`);
      return receipt.hash;
    } catch (err: any) {
      const msg = err?.message || "";
      if (attempt < 3 && (msg.includes("rate limit") || msg.includes("request limit") || err?.code === "UNKNOWN_ERROR")) {
        log(`  Rate limited, waiting ${(attempt + 1) * 5}s...`);
        await new Promise((r) => setTimeout(r, (attempt + 1) * 5000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("submitDelivery failed after retries");
}

export async function getJobOnChain(jobId: number) {
  try {
    const [job, bids] = await orderBook.getJob(jobId);
    return { job, bids };
  } catch {
    return null;
  }
}

export async function scanJobsFromChain(maxJobId = 20): Promise<
  {
    id: number;
    poster: string;
    description: string;
    tags: string[];
    deadline: number;
    status: number;
    bidCount: number;
    budget: number;
  }[]
> {
  const jobs: any[] = [];

  for (let id = 1; id <= maxJobId; id++) {
    try {
      const [jobData, bids] = await jobRegistry.getJob(id);
      const meta = jobData.metadata;

      // Zero-address poster means job doesn't exist
      if (meta.poster === ethers.ZeroAddress) break;

      // Only include OPEN jobs (status 0)
      if (Number(jobData.status) === 0) {
        jobs.push({
          id: Number(meta.id),
          poster: meta.poster,
          description: meta.description,
          tags: [...meta.tags],
          deadline: Number(meta.deadline),
          status: Number(jobData.status),
          bidCount: bids.length,
          budget: 0,
          marketContext: { budgetPercentile: 50, competitionLevel: "low" },
        });
      }
    } catch {
      break;
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }

  return jobs;
}
