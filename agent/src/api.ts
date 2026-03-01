import { config } from "./config.js";

export interface Job {
  id: number;
  poster: string;
  description: string;
  metadataUri: string;
  tags: string[];
  category: string;
  deadline: number;
  budget: number;
  status: number;
  createdAt: string;
  bidCount: number;
  marketContext: {
    budgetPercentile: number;
    competitionLevel: string;
  };
}

export interface FeedResponse {
  data: Job[];
  nextCursor: string | null;
  total: number;
}

export async function fetchOpenJobs(tags?: string[]): Promise<Job[]> {
  const params = new URLSearchParams({ status: "0", limit: "20" });
  if (tags?.length) params.set("tags", tags.join(","));

  const res = await fetch(`${config.apiUrl}/v1/feed/jobs?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data: FeedResponse = await res.json();

  // Normalize budget: API may return micro-USDC (6 decimals)
  return data.data.map((j) => ({
    ...j,
    budget: j.budget > 10_000 ? j.budget / 1e6 : j.budget,
    bidCount: j.bidCount ?? (j as any).bids?.length ?? 0,
    tags: j.tags ?? [],
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
