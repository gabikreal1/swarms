import { defineChain } from 'viem';

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'ARC Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
  },
  blockExplorers: {
    default: { name: 'ARC Explorer', url: 'https://explorer.testnet.arc.network' },
  },
  testnet: true,
});

// ERC-20 USDC token on ARC Testnet (6 decimals)
export const USDC_ADDRESS = '0xd37475e12B93AA4e592C4ebB9607daE55fF56AB1' as const;
export const USDC_DECIMALS = 6;

// Contract addresses
export const CONTRACTS = {
  OrderBook: '0x15b109eb67Bf2400CD44D4448ea1086A91aEac72',
  Escrow: '0xbE8532a5E21aB5783f0499d3f44A77d5dae12580',
  JobRegistry: '0x491cA8D63b25B4C7d21c275e4C02D2CD0821282f',
  AgentRegistry: '0xf90aD6E1FECa8F14e8c289A43366E7EcC5bbF67c',
  ReputationToken: '0xd6D35D4584B69B4556928207d492d8d39de89D55',
  ValidationOracle: '0xd4e90c2bAA708a349D52Efa9367a7bB1DDd3D247',
} as const;
