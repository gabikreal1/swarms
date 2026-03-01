import { ethers } from "ethers";
import { NETWORK } from "./constants";

// ─── EIP-1193 types ──────────────────────────────────────────

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      providers?: (Eip1193Provider & { isMetaMask?: boolean; isPhantom?: boolean })[];
      isMetaMask?: boolean;
      isPhantom?: boolean;
    };
  }
}

// ─── Provider detection ──────────────────────────────────────

/** Find MetaMask specifically, even when Phantom overrides window.ethereum */
export function getProvider(): Eip1193Provider | null {
  if (!window.ethereum) return null;

  // Multiple wallet extensions inject into providers array
  const providers = window.ethereum.providers;
  if (providers?.length) {
    // Prefer MetaMask (Phantom also sets isMetaMask=true, so exclude it)
    const mm = providers.find((p) => p.isMetaMask && !p.isPhantom);
    if (mm) return mm;
    // Fallback to first non-Phantom provider
    const nonPhantom = providers.find((p) => !p.isPhantom);
    if (nonPhantom) return nonPhantom;
  }

  // Single provider — prefer MetaMask
  if (window.ethereum.isMetaMask && !window.ethereum.isPhantom) {
    return window.ethereum;
  }

  // Fallback to whatever is available
  return window.ethereum;
}

// ─── Payment types ───────────────────────────────────────────

export interface PaymentProof {
  txHash: string;
  from: string;
  amount: string;
  timestamp: number;
}

// ─── Chain switching ─────────────────────────────────────────

const ARC_CHAIN_ID_HEX = "0x" + NETWORK.chainId.toString(16);

export async function ensureArcTestnet(provider: Eip1193Provider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_ID_HEX }],
    });
  } catch (err: any) {
    // 4902 = chain not added
    if (err?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC_CHAIN_ID_HEX,
            chainName: NETWORK.name,
            rpcUrls: [NETWORK.rpc],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

// ─── USDC transfer ───────────────────────────────────────────

const USDC_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];

export async function sendUsdcTransfer(params: {
  provider: Eip1193Provider;
  to: string;
  amount: string;
  usdcAddress: string;
}): Promise<{ txHash: string; from: string }> {
  const browserProvider = new ethers.BrowserProvider(params.provider as any);
  const signer = await browserProvider.getSigner();
  const usdc = new ethers.Contract(params.usdcAddress, USDC_ABI, signer);

  const tx = await usdc.transfer(params.to, ethers.parseUnits(params.amount, 6));
  const receipt = await tx.wait();

  return { txHash: receipt.hash, from: await signer.getAddress() };
}

// ─── Payment cache ───────────────────────────────────────────

const paymentCache = new Map<string, PaymentProof & { ts: number }>();
const CACHE_TTL = 30_000;

export function getCachedPayment(endpoint: string): PaymentProof | null {
  const cached = paymentCache.get(endpoint);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { txHash: cached.txHash, from: cached.from, amount: cached.amount, timestamp: cached.timestamp };
  }
  paymentCache.delete(endpoint);
  return null;
}

export function setCachedPayment(endpoint: string, proof: PaymentProof): void {
  paymentCache.set(endpoint, { ...proof, ts: Date.now() });
}

export function clearCachedPayment(endpoint: string): void {
  paymentCache.delete(endpoint);
}
