import { ethers } from "ethers";
import { SiweMessage, generateNonce } from "siwe";
import { config } from "./config.js";
import { log, logWarn } from "./log.js";

export interface Job {
  id: number;          // on-chain job ID (from chainId)
  uuid: string;        // backend UUID
  poster: string;
  description: string;
  metadataUri: string;
  tags: string[];
  category: string;
  deadline: number;
  budget: number;
  status: string;
  createdAt: string;
  bidCount: number;
  marketContext: {
    budgetPercentile: number;
    competitionLevel: string;
  };
}

interface RawFeedJob {
  id: string;
  chainId?: number;
  poster: string;
  description: string;
  metadataUri?: string;
  metadataURI?: string;
  tags: string[];
  category?: string;
  deadline: number;
  budget: number;
  status: string | number;
  createdAt: string;
  bidCount?: number;
  bids?: unknown[];
  marketContext?: {
    budgetPercentile: number;
    competitionLevel: string;
  };
}

export interface FeedResponse {
  data: RawFeedJob[];
  nextCursor: string | null;
  total: number;
}

export async function fetchOpenJobs(tags?: string[]): Promise<Job[]> {
  const params = new URLSearchParams({ status: "0", limit: "50" });
  if (tags?.length) params.set("tags", tags.join(","));

  const res = await fetch(`${config.apiUrl}/v1/feed/jobs?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data: FeedResponse = await res.json();

  return data.data
    .filter((j) => j.chainId != null && j.chainId > 0)
    .map((j): Job => ({
      id: j.chainId!,
      uuid: j.id,
      poster: j.poster,
      description: j.description,
      metadataUri: (j.metadataUri ?? j.metadataURI ?? ""),
      tags: j.tags ?? [],
      category: j.category ?? "",
      deadline: j.deadline,
      budget: j.budget > 10_000 ? j.budget / 1e6 : j.budget,
      status: String(j.status),
      createdAt: j.createdAt,
      bidCount: j.bidCount ?? j.bids?.length ?? 0,
      marketContext: j.marketContext ?? { budgetPercentile: 50, competitionLevel: "low" },
    }));
}

export async function fetchAgentStats(address: string) {
  const res = await fetch(`${config.apiUrl}/v1/stats/agent/${address}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchMarketOverview() {
  const res = await fetch(`${config.apiUrl}/v1/stats/overview`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.data;
}

// ─── SIWE Auth + IPFS Pinning ─────────────────────────────────

let sessionToken: string | null = null;

async function login(): Promise<string> {
  const wallet = new ethers.Wallet(config.privateKey);

  // 1. Get nonce from backend
  const nonceRes = await fetch(`${config.apiUrl}/v1/auth/nonce`, { method: "POST" });
  if (!nonceRes.ok) throw new Error(`Nonce request failed: ${nonceRes.status}`);
  const { nonce } = await nonceRes.json() as { nonce: string };

  // 2. Build and sign SIWE message
  const domain = new URL(config.apiUrl).host;
  const siweMessage = new SiweMessage({
    domain,
    address: wallet.address,
    statement: "Sign in to SWARMS marketplace",
    uri: config.apiUrl,
    version: "1",
    chainId: 5042002,
    nonce,
  });

  const messageStr = siweMessage.prepareMessage();
  const signature = await wallet.signMessage(messageStr);

  // 3. Login
  const loginRes = await fetch(`${config.apiUrl}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: messageStr, signature }),
  });

  if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
  const { token } = await loginRes.json() as { token: string };
  sessionToken = token;
  log(`SIWE auth successful`);
  return token;
}

export interface BidMetadata {
  jobId: number;
  agent: string;
  capabilities: string[];
  evaluationScore: number;
  bidPriceUSDC: string;
  deliveryDays: number;
  reasoning: string;
  createdAt: string;
}

export async function pinBidMetadata(metadata: BidMetadata): Promise<string> {
  try {
    if (!sessionToken) await login();

    const res = await fetch(`${config.apiUrl}/v1/ipfs/pin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({
        content: metadata,
        name: `swarms-bid-job-${metadata.jobId}-${config.name}`,
      }),
    });

    if (res.status === 401) {
      // Session expired — re-login and retry once
      sessionToken = null;
      await login();
      return pinBidMetadata(metadata);
    }

    if (!res.ok) throw new Error(`IPFS pin failed: ${res.status}`);
    const { uri } = await res.json() as { uri: string; cid: string };
    log(`Pinned bid metadata: ${uri}`);
    return uri;
  } catch (err) {
    logWarn(`IPFS pin failed, using fallback: ${err}`);
    // Fallback: return plain text description so bidding still works
    return `${config.name}: ${metadata.capabilities.slice(0, 3).join(", ")}. Score: ${metadata.evaluationScore}/100.`;
  }
}
