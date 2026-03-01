import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
  port: z.coerce.number().default(3000),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // LLM
  llmProvider: z.enum(['anthropic', 'openai', 'ollama']).default('anthropic'),
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().default('http://localhost:11434'),

  // Embedding
  embeddingProvider: z.enum(['minilm', 'openai']).default('minilm'),
  embeddingDimension: z.coerce.number().default(384),

  // Qdrant
  qdrantUrl: z.string().default('http://localhost:6333'),
  qdrantApiKey: z.string().optional(),

  // Blockchain
  rpcUrl: z.string().default('https://rpc.testnet.arc.network'),
  chainId: z.coerce.number().default(5042002),
  orderBookAddress: z.string().optional(),
  agentRegistryAddress: z.string().optional(),
  reputationTokenAddress: z.string().optional(),
  escrowAddress: z.string().optional(),
  jobRegistryAddress: z.string().optional(),
  validationOracleAddress: z.string().optional(),
  validatorPrivateKey: z.string().optional(),

  // IPFS
  pinataJwt: z.string().optional(),
  pinataApiKey: z.string().optional(),
  pinataSecretKey: z.string().optional(),
  pinataGatewayUrl: z.string().default('https://gateway.pinata.cloud'),

  // PostgreSQL
  databaseUrl: z.string().optional(),

  // Circle Nanopayments
  paymentReceiverAddress: z.string().optional(),
  usdcAddress: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

export const config = configSchema.parse({
  port: process.env.PORT,
  nodeEnv: process.env.NODE_ENV,
  llmProvider: process.env.LLM_PROVIDER,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  embeddingProvider: process.env.EMBEDDING_PROVIDER,
  embeddingDimension: process.env.EMBEDDING_DIMENSION,
  qdrantUrl: process.env.QDRANT_URL,
  qdrantApiKey: process.env.QDRANT_API_KEY,
  rpcUrl: process.env.RPC_URL,
  chainId: process.env.CHAIN_ID,
  orderBookAddress: process.env.ORDERBOOK_ADDRESS?.trim(),
  agentRegistryAddress: process.env.AGENT_REGISTRY_ADDRESS?.trim(),
  reputationTokenAddress: process.env.REPUTATION_TOKEN_ADDRESS?.trim(),
  escrowAddress: process.env.ESCROW_ADDRESS?.trim(),
  jobRegistryAddress: process.env.JOB_REGISTRY_ADDRESS?.trim(),
  validationOracleAddress: process.env.VALIDATION_ORACLE_ADDRESS?.trim(),
  validatorPrivateKey: process.env.VALIDATOR_PRIVATE_KEY?.trim(),
  pinataJwt: process.env.PINATA_JWT,
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataSecretKey: process.env.PINATA_SECRET_KEY,
  pinataGatewayUrl: process.env.PINATA_GATEWAY_URL,
  databaseUrl: process.env.DATABASE_URL,
  paymentReceiverAddress: process.env.PAYMENT_RECEIVER_ADDRESS?.trim(),
  usdcAddress: process.env.USDC_ADDRESS?.trim(),
});
