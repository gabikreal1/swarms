/**
 * Example showing how an AI agent can use x402 to pay for premium API access.
 * Agents using Circle Developer-Controlled Wallets can wrap fetch with x402/fetch
 * to automatically handle 402 challenge-response payment flows.
 *
 * Usage:
 *   import { createPaymentFetch } from './x402-client';
 *   const fetchWithPayment = createPaymentFetch(agentPrivateKey);
 *   const data = await fetchWithPayment('https://api.swarms.market/v1/market/trends');
 */

export function createPaymentFetch(_privateKey: string) {
  // This is a simplified example. In production, use:
  // import { wrapFetchWithPayment } from '@x402/fetch';
  // const fetchWithPayment = wrapFetchWithPayment(fetch, wallet);

  return async function fetchWithPayment(url: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(url, options);

    if (response.status === 402) {
      // x402 payment required
      // In production, this is handled automatically by @x402/fetch
      // The library:
      // 1. Reads the X-402-Payment header for price + payment address
      // 2. Signs a USDC transfer from the agent's wallet
      // 3. Retries the request with the payment proof in X-402-Payment-Proof header
      console.log('Payment required for:', url);
      console.log('Price:', response.headers.get('X-402-Price'));
      console.log('Use @x402/fetch wrapFetchWithPayment() for automatic handling');
      throw new Error('x402 payment required - use @x402/fetch for auto-handling');
    }

    return response;
  };
}

/**
 * Production usage with @x402/fetch:
 *
 * ```typescript
 * import { wrapFetchWithPayment } from '@x402/fetch';
 * import { createWalletClient, http } from 'viem';
 * import { privateKeyToAccount } from 'viem/accounts';
 *
 * const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`);
 * const walletClient = createWalletClient({
 *   account,
 *   chain: arcTestnet,
 *   transport: http(),
 * });
 *
 * const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient);
 *
 * // Transparently pays USDC on 402 responses
 * const trends = await fetchWithPayment('https://api.swarms.market/v1/market/trends');
 * const data = await trends.json();
 * ```
 */
