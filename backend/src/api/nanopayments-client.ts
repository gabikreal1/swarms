/**
 * Client-side helper for Circle nanopayments.
 * AI agents use this to automatically handle 402 Payment Required responses
 * by signing a USDC payment authorization with their Circle wallet.
 *
 * Usage:
 *   import { createNanopaymentFetch } from './nanopayments-client';
 *   const fetchWithPayment = createNanopaymentFetch(wallet);
 *   const data = await fetchWithPayment('https://api.swarms.market/v1/market/trends');
 */

import { ethers } from 'ethers';

interface NanopaymentWallet {
  address: string;
  signMessage: (message: string) => Promise<string>;
}

/**
 * Wraps fetch to automatically handle 402 responses with Circle nanopayments.
 * When a 402 is received, signs a payment message and retries.
 */
export function createNanopaymentFetch(wallet: NanopaymentWallet) {
  return async function fetchWithPayment(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, options);

    if (response.status === 402) {
      const body = await response.json() as { payment?: { protocol: string; amount: string; receiver: string } };
      const payment = body.payment;

      if (!payment || payment.protocol !== 'circle-nanopayments') {
        throw new Error('Unsupported payment protocol');
      }

      // Generate a unique nonce
      const nonce = crypto.randomUUID();
      const amount = payment.amount;
      const receiver = payment.receiver;

      // Sign the payment authorization
      const message = `SWARMS-PAY:${amount}:${receiver}:${nonce}`;
      const signature = await wallet.signMessage(message);

      const proof = JSON.stringify({
        from: wallet.address,
        amount,
        nonce,
        signature,
      });

      // Retry with payment proof
      return fetch(url, {
        ...options,
        headers: {
          ...((options?.headers as Record<string, string>) || {}),
          'X-Circle-Payment': proof,
        },
      });
    }

    return response;
  };
}

/**
 * Create a wallet adapter from an ethers.js signer (for server-side agents).
 */
export function fromEthersSigner(signer: ethers.Signer & { address: string }): NanopaymentWallet {
  return {
    address: signer.address,
    signMessage: (msg: string) => signer.signMessage(msg),
  };
}

/**
 * Production usage example:
 *
 * ```typescript
 * import { createNanopaymentFetch, fromEthersSigner } from './nanopayments-client';
 * import { ethers } from 'ethers';
 *
 * const provider = new ethers.JsonRpcProvider('https://rpc.testnet.arc.network');
 * const signer = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);
 * const wallet = fromEthersSigner(signer);
 * const fetchWithPayment = createNanopaymentFetch(wallet);
 *
 * // Transparently pays USDC on 402 responses
 * const response = await fetchWithPayment('https://api.swarms.market/v1/market/trends');
 * const data = await response.json();
 * ```
 */
