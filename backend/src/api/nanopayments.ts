import { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { config } from '../config';

// Price tiers for different endpoint groups (in USDC)
export const PRICING = {
  free: 0,
  standard: 0.001,    // $0.001 per call
  premium: 0.01,      // $0.01 per call
} as const;

// Minimal ERC-20 ABI for USDC balance + transfer verification
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// USDC on ARC testnet (6 decimals)
const USDC_ADDRESS = config.usdcAddress || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const USDC_DECIMALS = 6;

let provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return provider;
}

/**
 * Parses and verifies a Circle nanopayment proof.
 *
 * The client sends a header:
 *   X-Circle-Payment: <JSON payload>
 *
 * Payload shape:
 *   {
 *     "txHash": "0x...",          // USDC transfer tx hash on ARC testnet
 *     "from": "0x...",            // sender address
 *     "amount": "0.001",          // USDC amount (human-readable)
 *     "timestamp": 1234567890     // unix seconds
 *   }
 *
 * OR for pre-authorized (signed message) flow:
 *   {
 *     "from": "0x...",
 *     "amount": "0.001",
 *     "nonce": "abc123",
 *     "signature": "0x..."        // EIP-712 signature authorizing the payment
 *   }
 */
interface PaymentProofTx {
  txHash: string;
  from: string;
  amount: string;
  timestamp: number;
}

interface PaymentProofSigned {
  from: string;
  amount: string;
  nonce: string;
  signature: string;
}

type PaymentProof = PaymentProofTx | PaymentProofSigned;

// Simple nonce cache to prevent replay attacks (in production, use Redis/DB)
const usedNonces = new Set<string>();
const usedTxHashes = new Set<string>();

// Payment verification TTL — accept proofs up to 5 minutes old
const PROOF_TTL_MS = 5 * 60 * 1000;

/**
 * Verify a transaction-based payment proof by checking the USDC Transfer event on-chain.
 */
async function verifyTxProof(proof: PaymentProofTx, requiredAmount: number): Promise<boolean> {
  if (usedTxHashes.has(proof.txHash)) {
    return false; // replay
  }

  const rpcProvider = getProvider();
  const receipt = await rpcProvider.getTransactionReceipt(proof.txHash);
  if (!receipt || receipt.status !== 1) {
    return false; // tx failed or not found
  }

  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, rpcProvider);
  const receiverAddress = config.paymentReceiverAddress;
  if (!receiverAddress) return false;

  // Parse Transfer events from the receipt
  for (const log of receipt.logs) {
    try {
      const parsed = usdc.interface.parseLog({ topics: log.topics as string[], data: log.data });
      if (
        parsed &&
        parsed.name === 'Transfer' &&
        parsed.args.to.toLowerCase() === receiverAddress.toLowerCase() &&
        parsed.args.from.toLowerCase() === proof.from.toLowerCase()
      ) {
        const transferred = Number(ethers.formatUnits(parsed.args.value, USDC_DECIMALS));
        if (transferred >= requiredAmount) {
          usedTxHashes.add(proof.txHash);
          return true;
        }
      }
    } catch {
      // not a matching log
    }
  }

  return false;
}

/**
 * Verify a signed-message payment proof using EIP-712 style verification.
 * The message format: "SWARMS-PAY:<amount>:<receiver>:<nonce>"
 */
async function verifySignedProof(proof: PaymentProofSigned, requiredAmount: number): Promise<boolean> {
  if (usedNonces.has(proof.nonce)) {
    return false; // replay
  }

  const receiverAddress = config.paymentReceiverAddress;
  if (!receiverAddress) return false;

  const amount = parseFloat(proof.amount);
  if (isNaN(amount) || amount < requiredAmount) return false;

  // Reconstruct the signed message
  const message = `SWARMS-PAY:${proof.amount}:${receiverAddress}:${proof.nonce}`;

  try {
    const recovered = ethers.verifyMessage(message, proof.signature);
    if (recovered.toLowerCase() !== proof.from.toLowerCase()) {
      return false;
    }
  } catch {
    return false;
  }

  // Verify the sender has sufficient USDC balance
  const rpcProvider = getProvider();
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, rpcProvider);
  const balance = await usdc.balanceOf(proof.from);
  const requiredWei = ethers.parseUnits(requiredAmount.toString(), USDC_DECIMALS);

  if (balance < requiredWei) {
    return false;
  }

  usedNonces.add(proof.nonce);
  return true;
}

/**
 * Creates Circle nanopayment middleware for a given price tier.
 * Returns Express middleware that gates the endpoint behind a USDC nanopayment.
 *
 * Flow:
 * 1. Client sends request with X-Circle-Payment header
 * 2. Middleware verifies the payment proof (tx-based or signature-based)
 * 3. If valid, request proceeds; if not, returns 402 with payment instructions
 *
 * In development mode without PAYMENT_RECEIVER_ADDRESS, passes through.
 */
export function nanopaymentGate(priceUsd: number) {
  if (priceUsd === 0) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    // Dev mode passthrough when no receiver configured
    if (!config.paymentReceiverAddress) {
      if (config.nodeEnv === 'development') {
        return next();
      }
      console.error('[nanopayments] PAYMENT_RECEIVER_ADDRESS not set');
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const paymentHeader = req.headers['x-circle-payment'] as string | undefined;

    if (!paymentHeader) {
      return res.status(402).json({
        error: 'Payment Required',
        payment: {
          protocol: 'circle-nanopayments',
          network: `eip155:${config.chainId}`,
          currency: 'USDC',
          currencyAddress: USDC_ADDRESS,
          amount: priceUsd.toString(),
          receiver: config.paymentReceiverAddress,
          description: `SWARMS API call - $${priceUsd}`,
          methods: ['tx-proof', 'signed-message'],
          instructions: {
            'tx-proof': 'Send USDC to the receiver address, then include the tx hash in X-Circle-Payment header as JSON: {"txHash":"0x...","from":"0x...","amount":"0.001","timestamp":...}',
            'signed-message': 'Sign the message "SWARMS-PAY:<amount>:<receiver>:<nonce>" and include in X-Circle-Payment header as JSON: {"from":"0x...","amount":"0.001","nonce":"...","signature":"0x..."}',
          },
        },
      });
    }

    try {
      const proof: PaymentProof = JSON.parse(paymentHeader);
      let verified = false;

      if ('txHash' in proof) {
        verified = await verifyTxProof(proof as PaymentProofTx, priceUsd);
      } else if ('signature' in proof) {
        verified = await verifySignedProof(proof as PaymentProofSigned, priceUsd);
      }

      if (!verified) {
        return res.status(402).json({
          error: 'Payment verification failed',
          details: 'The payment proof could not be verified. Ensure sufficient USDC balance and correct receiver address.',
        });
      }

      next();
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid payment header',
        details: 'X-Circle-Payment must be valid JSON',
      });
    }
  };
}
