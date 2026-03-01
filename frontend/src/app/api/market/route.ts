import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const API_BASE = process.env.SWARMS_API_URL || "https://swarms-api-production-d35e.up.railway.app";
const RPC_URL = process.env.SWARMS_RPC_URL || "https://rpc.testnet.arc.network";
const WALLET_KEY = process.env.ADMIN_WALLET_KEY || "";

const USDC_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

// Shared payment cache — one proof works for all endpoints
let sharedPayment: { txHash: string; from: string; amount: string; ts: number } | null = null;
const CACHE_TTL = 25_000;

// Payment lock — only one tx in-flight at a time, others wait for it
let pendingPayment: Promise<{ txHash: string; from: string; amount: string }> | null = null;

// Endpoint mapping: query param → backend path
const ENDPOINTS: Record<string, string> = {
  trends: "/v1/market/trends",
  "supply-demand": "/v1/market/supply-demand",
  clusters: "/v1/analytics/clusters",
};

async function sendPayment(receiverAddress: string, usdcAddress: string, amountRaw: bigint, amount: string): Promise<{ txHash: string; from: string; amount: string }> {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(WALLET_KEY, provider);
  const usdc = new ethers.Contract(usdcAddress, USDC_ABI, wallet);

  const tx = await usdc.transfer(receiverAddress, amountRaw);
  const receipt = await tx.wait();

  return { txHash: receipt.hash, from: wallet.address, amount };
}

function getSharedPayment(): { txHash: string; from: string; amount: string } | null {
  if (sharedPayment && Date.now() - sharedPayment.ts < CACHE_TTL) {
    return { txHash: sharedPayment.txHash, from: sharedPayment.from, amount: sharedPayment.amount };
  }
  sharedPayment = null;
  return null;
}

async function acquirePayment(receiver: string, currencyAddress: string, amount: string): Promise<{ txHash: string; from: string; amount: string }> {
  // Check cache
  const cached = getSharedPayment();
  if (cached) return cached;

  // If another request is already paying, wait for it
  if (pendingPayment) return pendingPayment;

  // We're the first — send payment and let others wait
  pendingPayment = sendPayment(receiver, currencyAddress, ethers.parseUnits(amount, 6), amount)
    .then((result) => {
      sharedPayment = { ...result, ts: Date.now() };
      return result;
    })
    .finally(() => {
      pendingPayment = null;
    });

  return pendingPayment;
}

export async function GET(request: NextRequest) {
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint || !ENDPOINTS[endpoint]) {
    return NextResponse.json({ error: "Invalid endpoint. Use: trends, supply-demand, clusters" }, { status: 400 });
  }

  const backendPath = ENDPOINTS[endpoint];
  const params = new URLSearchParams();
  request.nextUrl.searchParams.forEach((v, k) => {
    if (k !== "endpoint") params.set(k, v);
  });
  const backendUrl = `${API_BASE}${backendPath}${params.toString() ? `?${params}` : ""}`;

  // 1. Try with cached payment if available
  const cached = getSharedPayment();
  if (cached) {
    const proof = JSON.stringify({
      txHash: cached.txHash,
      from: cached.from,
      amount: cached.amount,
      timestamp: Math.floor(Date.now() / 1000),
    });
    const res = await fetch(backendUrl, { headers: { "X-Circle-Payment": proof } });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ...data, _paid: true, _txHash: cached.txHash });
    }
    // Cache invalid, clear it
    sharedPayment = null;
  }

  // 2. Try without payment
  const firstTry = await fetch(backendUrl);

  if (firstTry.ok) {
    const data = await firstTry.json();
    return NextResponse.json(data);
  }

  if (firstTry.status !== 402) {
    const text = await firstTry.text();
    return NextResponse.json({ error: `Backend error ${firstTry.status}`, details: text }, { status: firstTry.status });
  }

  // 3. Got 402 — need payment
  if (!WALLET_KEY) {
    return NextResponse.json({ error: "Payment required but ADMIN_WALLET_KEY not configured" }, { status: 402 });
  }

  const paymentInfo = await firstTry.json();
  const { currencyAddress, receiver, amount } = paymentInfo.payment || {};

  if (!receiver || !currencyAddress || !amount) {
    return NextResponse.json({ error: "Invalid 402 response from backend", details: paymentInfo }, { status: 502 });
  }

  try {
    // Acquire payment — serialized, shared across parallel requests
    const payment = await acquirePayment(receiver, currencyAddress, amount);

    // 4. Retry with payment proof
    const proof = JSON.stringify({
      txHash: payment.txHash,
      from: payment.from,
      amount: payment.amount,
      timestamp: Math.floor(Date.now() / 1000),
    });

    const retryRes = await fetch(backendUrl, {
      headers: { "X-Circle-Payment": proof },
    });

    if (!retryRes.ok) {
      const errText = await retryRes.text();
      return NextResponse.json({ error: `Paid but request failed: ${retryRes.status}`, details: errText }, { status: retryRes.status });
    }

    const data = await retryRes.json();
    return NextResponse.json({ ...data, _paid: true, _txHash: payment.txHash });
  } catch (err: any) {
    return NextResponse.json({ error: "Payment failed", details: err.message }, { status: 500 });
  }
}
