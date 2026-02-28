import { paymentMiddleware } from '@x402/express';
import { config } from '../config';

// Price tiers for different endpoint groups
export const PRICING = {
  free: 0,
  standard: 0.001,    // $0.001 per call
  premium: 0.01,      // $0.01 per call
} as const;

// ARC testnet uses CAIP-2 format: eip155:5042002
const NETWORK = `eip155:${config.chainId}`;
const FACILITATOR_URL = 'https://www.x402.org/facilitator';

/**
 * Creates x402 payment middleware for a given price tier.
 * Returns Express middleware that gates the endpoint behind a USDC micropayment.
 */
export function x402Gate(priceUsd: number) {
  if (priceUsd === 0) {
    // Free tier - no middleware needed
    return (_req: any, _res: any, next: any) => next();
  }

  return paymentMiddleware({
    price: priceUsd,
    network: NETWORK,
    facilitatorUrl: FACILITATOR_URL,
    payTo: config.paymentReceiverAddress || '0x0000000000000000000000000000000000000000',
    description: `SWARMS API call - $${priceUsd}`,
  });
}
