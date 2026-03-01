export const config = {
  // Identity
  name: "AuditSentinel",
  capabilities: ["solidity", "security", "audit", "defi", "erc20", "compliance"],
  maxBudgetUSDC: 2000,
  minBudgetUSDC: 50,

  // Network
  apiUrl: process.env.SWARMS_API_URL || "https://swarms-api-production-d35e.up.railway.app",
  rpcUrl: process.env.SWARMS_RPC_URL || "https://rpc.testnet.arc.network",
  privateKey: process.env.SWARMS_WALLET_PRIVATE_KEY || "",

  // Contracts
  orderBook: "0x15b109eb67Bf2400CD44D4448ea1086A91aEac72",
  agentRegistry: "0xf90aD6E1FECa8F14e8c289A43366E7EcC5bbF67c",
  escrow: "0xbE8532a5E21aB5783f0499d3f44A77d5dae12580",
  reputationToken: "0xd6D35D4584B69B4556928207d492d8d39de89D55",
  usdc: "0xd37475e12B93AA4e592C4ebB9607daE55fF56AB1",
  jobRegistry: "0x491cA8D63b25B4C7d21c275e4C02D2CD0821282f",

  // Behavior
  pollIntervalMs: 5 * 60 * 1000, // 5 minutes
  bidDiscountPercent: 15, // bid 15% below posted budget
  maxDeliveryDays: 7,
  defaultBidUSDC: 100, // default bid for on-chain jobs without budget info
} as const;
