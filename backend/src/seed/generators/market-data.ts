import { getPool } from '../../db/pool';
import { Aggregator } from '../../indexer/aggregator';
import { CATEGORY_WEIGHTS, USDC_MULTIPLIER, type SeedConfig } from '../config';
import { randomInt, randomFloat } from '../utils';

/**
 * Seed historical market data:
 * 1. Run the Aggregator to populate tag_clusters and supply_demand from current data.
 * 2. Insert backdated trend_snapshots, price_series, and supply_demand for historical depth.
 */
export async function seedMarketData(
  cfg: SeedConfig,
): Promise<void> {
  // Step 1: Run the aggregator against seeded base data
  const aggregator = new Aggregator();
  await aggregator.refreshTagClusters();
  await aggregator.refreshSupplyDemand();
  console.log(`  [market] ran aggregator for tag_clusters and supply_demand`);

  // Step 2: Insert historical time-series data
  const pool = getPool();
  const now = new Date();
  const weeks = Math.ceil(cfg.timeHorizonDays / 7);

  // Collect all unique tags
  const allTags = new Set<string>();
  for (const cat of CATEGORY_WEIGHTS) {
    for (const tag of cat.tags) allTags.add(tag);
  }

  // For each tag, generate weekly data points
  for (const tag of allTags) {
    const catConfig = CATEGORY_WEIGHTS.find((c) => c.tags.includes(tag));
    if (!catConfig) continue;

    const baseBudget = (catConfig.budgetRange[0] + catConfig.budgetRange[1]) / 2;
    let currentPrice = baseBudget;

    for (let w = weeks; w >= 1; w--) {
      const windowEnd = new Date(now.getTime() - (w - 1) * 7 * 86400000);
      const windowStart = new Date(windowEnd.getTime() - 7 * 86400000);

      // Ramp-up: more jobs in later weeks
      const rampFactor = 1 - (w / weeks) * 0.7; // 0.3 at start, 1.0 at end
      const jobCount = Math.max(1, Math.round(randomInt(2, 8) * rampFactor));
      const bidCount = jobCount * randomInt(2, 5);

      // Momentum: positive for growing tags, negative for declining
      const momentum = randomFloat(-0.2, 0.5) * rampFactor;

      // trend_snapshots
      await pool.query(
        `INSERT INTO trend_snapshots (tag, window_start, window_end, job_count, bid_count, momentum, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $3)`,
        [tag, windowStart.toISOString(), windowEnd.toISOString(), jobCount, bidCount, momentum.toFixed(4)],
      );

      // price_series: random walk around base price
      currentPrice = currentPrice * (1 + randomFloat(-0.15, 0.15));
      currentPrice = Math.max(catConfig.budgetRange[0] * 0.5, Math.min(catConfig.budgetRange[1] * 1.5, currentPrice));

      const avgPrice = BigInt(Math.round(currentPrice)) * USDC_MULTIPLIER;
      const medianPrice = BigInt(Math.round(currentPrice * randomFloat(0.95, 1.05))) * USDC_MULTIPLIER;
      const p25Price = BigInt(Math.round(currentPrice * randomFloat(0.75, 0.9))) * USDC_MULTIPLIER;
      const p75Price = BigInt(Math.round(currentPrice * randomFloat(1.1, 1.3))) * USDC_MULTIPLIER;

      await pool.query(
        `INSERT INTO price_series (tag, bucket_start, bucket_end, avg_price, median_price, p25_price, p75_price, sample_count, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $3)`,
        [
          tag,
          windowStart.toISOString(),
          windowEnd.toISOString(),
          avgPrice.toString(),
          medianPrice.toString(),
          p25Price.toString(),
          p75Price.toString(),
          bidCount,
        ],
      );

      // supply_demand: vary over time
      const activeAgents = randomInt(2, 10);
      const openJobs = Math.max(1, Math.round(jobCount * randomFloat(0.3, 0.7)));
      const ratio = openJobs > 0 ? activeAgents / openJobs : null;

      await pool.query(
        `INSERT INTO supply_demand (tag, active_agents, open_jobs, ratio, snapshot_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          tag,
          activeAgents,
          openJobs,
          ratio?.toFixed(4) ?? null,
          windowEnd.toISOString(),
        ],
      );
    }
  }

  console.log(`  [market] seeded ${weeks} weeks of historical data for ${allTags.size} tags`);
}
