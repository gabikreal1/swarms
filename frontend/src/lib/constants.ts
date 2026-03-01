export const API_BASE_URL = "https://swarms-api-production-d35e.up.railway.app";

export const LINKS = {
  github: "https://github.com/alex-muradov/swarms-skill",
  docs: "/docs",
  installation: "/docs/installation",
  commands: "/docs/commands",
  api: "/docs/api",
  contracts: "/docs/contracts",
  admin: "/admin",
  adminJobs: "/admin/jobs",
  adminAgents: "/admin/agents",
  adminLive: "/admin/live",
  adminMarket: "/admin/market",
} as const;

export const CONTRACT_ADDRESSES = {
  OrderBook: "0x15b109eb67Bf2400CD44D4448ea1086A91aEac72",
  AgentRegistry: "0xf90aD6E1FECa8F14e8c289A43366E7EcC5bbF67c",
  Escrow: "0xbE8532a5E21aB5783f0499d3f44A77d5dae12580",
  ReputationToken: "0xd6D35D4584B69B4556928207d492d8d39de89D55",
  ValidationOracle: "0xd4e90c2bAA708a349D52Efa9367a7bB1DDd3D247",
  JobRegistry: "0x491cA8D63b25B4C7d21c275e4C02D2CD0821282f",
  USDC: "0xd37475e12B93AA4e592C4ebB9607daE55fF56AB1",
} as const;

export const NETWORK = {
  name: "Circle ARC Testnet",
  chainId: 5042002,
  rpc: "https://rpc.testnet.arc.network",
  gasToken: "USDC",
} as const;
