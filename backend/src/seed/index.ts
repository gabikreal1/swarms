import dotenv from 'dotenv';
dotenv.config();

import { PRESETS, type SeedConfig } from './config';
import { resetAll } from './reset';
import { seedAgents } from './generators/agents';
import { seedJobs } from './generators/jobs';
import { seedBids } from './generators/bids';
import { seedDeliveriesAndEscrows } from './generators/deliveries';
import { seedDisputes } from './generators/disputes';
import { seedReputation } from './generators/reputation';
import { seedMarketData } from './generators/market-data';
import { seedVectors } from './generators/vectors';
import { getPool } from '../db/pool';
import { runMigrations } from '../db/migrate';

interface CliArgs {
  scale: string;
  reset: boolean;
  skipVectors: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    scale: 'medium',
    reset: false,
    skipVectors: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scale' && args[i + 1]) {
      result.scale = args[++i];
    } else if (args[i] === '--reset') {
      result.reset = true;
    } else if (args[i] === '--skip-vectors') {
      result.skipVectors = true;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const cfg: SeedConfig = PRESETS[args.scale];
  if (!cfg) {
    console.error(`Unknown scale: ${args.scale}. Use: small, medium, large`);
    process.exit(1);
  }

  console.log(`\n=== SWARMS Seed: scale=${args.scale}, reset=${args.reset}, skipVectors=${args.skipVectors} ===\n`);
  console.log(`Config: ${cfg.jobs} jobs, ${cfg.agents} agents, ${cfg.posters} posters, ${cfg.timeHorizonDays}d history\n`);

  // Initialize DB (getPool auto-creates on first call)
  getPool();
  await runMigrations();

  const now = new Date();
  const genesisDate = new Date(now.getTime() - cfg.timeHorizonDays * 86400000);

  // Step 0: Reset if requested
  if (args.reset) {
    await resetAll(args.skipVectors);
  }

  // Step 1: Seed agents
  const agents = await seedAgents(cfg, genesisDate);

  // Step 2: Seed jobs
  const jobs = await seedJobs(cfg, genesisDate);

  // Step 3: Seed bids
  const bidsByJob = await seedBids(cfg, jobs, agents, genesisDate);

  // Step 4: Seed deliveries and escrows
  await seedDeliveriesAndEscrows(jobs, bidsByJob, genesisDate);

  // Step 5: Seed disputes
  await seedDisputes(jobs, genesisDate);

  // Step 6: Seed reputation
  await seedReputation(agents, jobs, bidsByJob, genesisDate);

  // Step 7: Seed market data (aggregation + historical)
  await seedMarketData(cfg);

  // Step 8: Seed vectors (embeddings + Qdrant)
  if (!args.skipVectors) {
    await seedVectors(jobs);
  } else {
    console.log('  [vectors] skipped (--skip-vectors)');
  }

  console.log('\n=== Seed complete ===\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
