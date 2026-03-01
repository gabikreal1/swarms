export interface SeedConfig {
  agents: number;
  posters: number;
  jobs: number;
  bidsPerJob: { min: number; max: number };
  completionRate: number;
  disputeRate: number;
  timeHorizonDays: number;
}

export const PRESETS: Record<string, SeedConfig> = {
  small: {
    agents: 5,
    posters: 3,
    jobs: 15,
    bidsPerJob: { min: 1, max: 3 },
    completionRate: 0.6,
    disputeRate: 0.1,
    timeHorizonDays: 30,
  },
  medium: {
    agents: 15,
    posters: 8,
    jobs: 100,
    bidsPerJob: { min: 2, max: 5 },
    completionRate: 0.7,
    disputeRate: 0.08,
    timeHorizonDays: 90,
  },
  large: {
    agents: 30,
    posters: 15,
    jobs: 500,
    bidsPerJob: { min: 2, max: 8 },
    completionRate: 0.75,
    disputeRate: 0.05,
    timeHorizonDays: 180,
  },
};

// Test-only mnemonic (Hardhat default) — DO NOT use for real funds
export const SEED_MNEMONIC =
  'test test test test test test test test test test test junk';

// USDC has 6 decimals
export const USDC_DECIMALS = 6;
export const USDC_MULTIPLIER = 10n ** BigInt(USDC_DECIMALS);

// Fake genesis block for timestamp → block mapping
export const GENESIS_BLOCK = 1_000_000n;
export const BLOCK_TIME_S = 2; // ~2s per block on ARC testnet

// Job category distribution weights (must sum to 1.0)
export const CATEGORY_WEIGHTS: {
  category: string;
  jobType: string;
  weight: number;
  budgetRange: [number, number];
  tags: string[];
  deliverableType: string;
}[] = [
  {
    category: 'Smart Contract Audit',
    jobType: 'audit',
    weight: 0.20,
    budgetRange: [100, 500],
    tags: ['audit', 'solidity', 'evm', 'security'],
    deliverableType: 'report',
  },
  {
    category: 'DeFi',
    jobType: 'audit',
    weight: 0.12,
    budgetRange: [200, 800],
    tags: ['defi', 'amm', 'lending', 'yield'],
    deliverableType: 'report',
  },
  {
    category: 'Code Review',
    jobType: 'code_review',
    weight: 0.15,
    budgetRange: [80, 300],
    tags: ['code-review', 'python', 'node', 'testing'],
    deliverableType: 'code',
  },
  {
    category: 'Data Engineering',
    jobType: 'data_engineering',
    weight: 0.12,
    budgetRange: [150, 600],
    tags: ['etl', 'data-pipeline', 'sql', 'analytics'],
    deliverableType: 'code',
  },
  {
    category: 'NLP/Content',
    jobType: 'nlp_content',
    weight: 0.10,
    budgetRange: [100, 400],
    tags: ['nlp', 'sentiment', 'text-generation'],
    deliverableType: 'model',
  },
  {
    category: 'ML/AI',
    jobType: 'ml_ai',
    weight: 0.10,
    budgetRange: [200, 1000],
    tags: ['pytorch', 'ml', 'deep-learning'],
    deliverableType: 'model',
  },
  {
    category: 'Frontend/UX',
    jobType: 'frontend_ux',
    weight: 0.12,
    budgetRange: [80, 250],
    tags: ['react', 'nextjs', 'accessibility'],
    deliverableType: 'code',
  },
  {
    category: 'Infrastructure',
    jobType: 'infrastructure',
    weight: 0.09,
    budgetRange: [150, 500],
    tags: ['docker', 'kubernetes', 'ci-cd'],
    deliverableType: 'code',
  },
];
