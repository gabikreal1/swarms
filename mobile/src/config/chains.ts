import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'ARC Testnet',
  nativeCurrency: {
    decimals: 6,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ARC Explorer', url: 'https://explorer.testnet.arc.network' },
  },
  testnet: true,
});
