import { API_BASE_URL } from "./constants";
import { getCachedPayment, setCachedPayment, clearCachedPayment, type PaymentProof } from "./wallet";

// ─── Types ──────────────────────────────────────────────────

export interface MarketOverview {
  totalJobs: number;
  totalCompletedJobs: number;
  totalVolume: number;
  activeAgents: number;
  overallSuccessRate: number;
  avgCompletionTime: number;
  periodComparison: {
    jobsThisWeek: number;
    jobsLastWeek: number;
    volumeThisWeek: number;
    volumeLastWeek: number;
  };
}

export interface JobBid {
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

export interface JobFeedItem {
  id: number;
  poster: string;
  description: string;
  metadataURI: string;
  tags: string[];
  deadline: number;
  status: string;
  createdAt: number;
  bids: JobBid[];
  bidCount: number;
  hasDispute: boolean;
}

export interface AgentDirectoryEntry {
  address: string;
  name: string;
  capabilities: string[];
  reputation: number;
  status: string;
  completedJobs: number;
  successRate: number;
  performanceByTag: { tag: string; jobs: number; successRate: number }[];
}

export interface ClusterStats {
  tag: string;
  category: string;
  jobCount: number;
  avgBudget: number;
  successRate: number;
  avgCompletionTime: number;
  totalVolume: number;
}

export interface TrendingTag {
  tag: string;
  category: string;
  currentPeriodJobs: number;
  previousPeriodJobs: number;
  momentumScore: number;
  signal: "STRONG_UP" | "UP" | "STABLE" | "DOWN" | "STRONG_DOWN";
  avgBudget: number;
}

export interface SupplyDemand {
  tag: string;
  supply: number;
  demand: number;
  ratio: number;
  trend: "oversupplied" | "balanced" | "undersupplied";
}

export interface StreamEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─── Paginated response ─────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

// ─── Fetcher ────────────────────────────────────────────────

async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── Endpoint functions ─────────────────────────────────────

export function fetchOverview() {
  return fetchApi<{ data: MarketOverview }>("/v1/stats/overview");
}

export async function fetchJobs(filters: Record<string, string> = {}) {
  const res = await fetchApi<PaginatedResponse<Record<string, unknown>>>("/v1/feed/jobs", { limit: "20", ...filters });
  // Normalize: API may return bids[] or just bidCount
  const data = res.data.map((raw): JobFeedItem => {
    const bids: JobBid[] = Array.isArray(raw.bids) ? raw.bids as JobBid[] : [];
    const bidCount = typeof raw.bidCount === "number" ? raw.bidCount : bids.length;
    return {
      id: raw.id as number ?? raw.chainId as number ?? 0,
      poster: (raw.poster as string) ?? "",
      description: (raw.description as string) ?? "",
      metadataURI: (raw.metadataURI ?? raw.metadataUri ?? "") as string,
      tags: (raw.tags as string[]) ?? [],
      deadline: (raw.deadline as number) ?? 0,
      status: (raw.status as string) ?? "open",
      createdAt: (raw.createdAt as number) ?? 0,
      bids,
      bidCount,
      hasDispute: (raw.hasDispute as boolean) ?? false,
    };
  });
  return { data, nextCursor: res.nextCursor, total: res.total };
}

export function fetchAgents(filters: Record<string, string> = {}) {
  return fetchApi<PaginatedResponse<AgentDirectoryEntry>>("/v1/feed/agents", { limit: "20", ...filters });
}

// ─── Wallet payment resolver ─────────────────────────────────
// Set by WalletProvider when wallet is connected. Shows payment modal, returns proof.

export type PaymentResolver = (info: {
  amount: string;
  receiver: string;
  currencyAddress: string;
  endpoint: string;
}) => Promise<PaymentProof | null>;

let walletPaymentResolver: PaymentResolver | null = null;

export function setWalletPaymentResolver(resolver: PaymentResolver | null) {
  walletPaymentResolver = resolver;
}

// Paid endpoint mapping (same as /api/market/route.ts)
const PAID_ENDPOINTS: Record<string, string> = {
  trends: "/v1/market/trends",
  "supply-demand": "/v1/market/supply-demand",
  clusters: "/v1/analytics/clusters",
};

// Proxy fallback (original server-side approach)
async function fetchPaidApiViaProxy<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const url = new URL("/api/market", window.location.origin);
  url.searchParams.set("endpoint", endpoint);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── Shared payment lock (wallet mode) ──────────────────────
// One payment for all parallel requests — others wait for the first
let pendingWalletPayment: Promise<PaymentProof | null> | null = null;

async function acquireWalletPayment(paymentInfo: {
  amount: string;
  receiver: string;
  currencyAddress: string;
  endpoint: string;
}): Promise<PaymentProof | null> {
  // Check shared cache (key="_shared")
  const cached = getCachedPayment("_shared");
  if (cached) return cached;

  // If another call is already showing the modal, wait for it
  if (pendingWalletPayment) return pendingWalletPayment;

  // We're the first — trigger the modal
  pendingWalletPayment = walletPaymentResolver!(paymentInfo)
    .then((proof) => {
      if (proof) setCachedPayment("_shared", proof);
      return proof;
    })
    .finally(() => {
      pendingWalletPayment = null;
    });

  return pendingWalletPayment;
}

// Dual-mode: wallet-direct if available, proxy fallback otherwise
async function fetchPaidApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  if (!walletPaymentResolver) {
    return fetchPaidApiViaProxy<T>(endpoint, params);
  }

  const backendPath = PAID_ENDPOINTS[endpoint];
  if (!backendPath) throw new Error(`Unknown paid endpoint: ${endpoint}`);

  const url = new URL(`${API_BASE_URL}${backendPath}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    });
  }

  // Try shared cached payment
  const cached = getCachedPayment("_shared");
  if (cached) {
    const res = await fetch(url.toString(), {
      headers: { "X-Circle-Payment": JSON.stringify(cached) },
    });
    if (res.ok) return res.json();
    clearCachedPayment("_shared");
  }

  // Try without payment
  const firstRes = await fetch(url.toString());
  if (firstRes.ok) return firstRes.json();
  if (firstRes.status !== 402) {
    throw new Error(`API ${firstRes.status}: ${firstRes.statusText}`);
  }

  // 402 — extract payment info, acquire shared payment (one modal for all)
  const body = await firstRes.json();
  const { currencyAddress, receiver, amount } = body.payment || {};
  if (!receiver || !currencyAddress || !amount) {
    throw new Error("Invalid 402 payment response from backend");
  }

  const proof = await acquireWalletPayment({ amount, receiver, currencyAddress, endpoint });
  if (!proof) throw new Error("Payment cancelled");

  // Retry with proof
  const retryRes = await fetch(url.toString(), {
    headers: { "X-Circle-Payment": JSON.stringify(proof) },
  });
  if (!retryRes.ok) throw new Error(`Paid but request failed: ${retryRes.status}`);
  return retryRes.json();
}

export function fetchClusters(params?: Record<string, string>) {
  return fetchPaidApi<{ data: ClusterStats[]; total: number }>("clusters", params);
}

export function fetchTrends(period = "week") {
  return fetchPaidApi<{ data: TrendingTag[]; total: number }>("trends", { period });
}

export function fetchSupplyDemand(tags?: string) {
  return fetchPaidApi<{ data: SupplyDemand[]; total: number }>("supply-demand", tags ? { tags } : {});
}

export function fetchTags() {
  return fetchApi<{ data: { id: string; label: string }[]; total: number }>("/v1/taxonomy/tags");
}
