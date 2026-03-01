import { insertJob, updateJobStatus } from '../../db/queries';
import { getPool } from '../../db/pool';
import { JOB_TEMPLATES } from '../templates/jobs';
import { pickCriteriaForJob, criteriaToSuccessCriteria } from '../templates/criteria';
import { CATEGORY_WEIGHTS, USDC_MULTIPLIER, type SeedConfig } from '../config';
import {
  pick, randomInt, randomFloat, weightedPick,
  fakeTxHash, fakeIpfsUri, fakeCriteriaHash,
  timestampToBlock, generateRampUpTimestamps, daysAgo,
} from '../utils';
import { generatePosterWallets } from '../wallets';

export type JobStatus = 'open' | 'in_progress' | 'delivered' | 'validating' | 'completed' | 'disputed';

export interface SeededJob {
  id: bigint;
  poster: string;
  title: string;
  description: string;
  category: string;
  jobType: string;
  tags: string[];
  budget: bigint;
  budgetUsdc: number;
  deadline: bigint;
  status: JobStatus;
  createdAt: Date;
  completedAt: Date | null;
  criteriaIds: string[];
  successCriteria: { id: string; description: string; measurable: boolean; source: string }[];
  deliverableType: string;
}

function pickStatus(createdAt: Date, now: Date, cfg: SeedConfig): JobStatus {
  const days = daysAgo(createdAt, now);
  const r = Math.random();

  if (days > 14) {
    // Old jobs: mostly completed or disputed
    if (r < cfg.completionRate) return 'completed';
    if (r < cfg.completionRate + cfg.disputeRate) return 'disputed';
    if (r < cfg.completionRate + cfg.disputeRate + 0.1) return 'in_progress';
    return 'open';
  } else if (days > 7) {
    // Medium-age jobs
    if (r < 0.4) return 'completed';
    if (r < 0.7) return 'in_progress';
    if (r < 0.85) return 'delivered';
    if (r < 0.9) return 'validating';
    return 'open';
  } else {
    // Recent jobs: mostly open
    if (r < 0.55) return 'open';
    if (r < 0.75) return 'in_progress';
    if (r < 0.88) return 'delivered';
    if (r < 0.95) return 'completed';
    return 'validating';
  }
}

export async function seedJobs(
  cfg: SeedConfig,
  genesisDate: Date,
): Promise<SeededJob[]> {
  const now = new Date();
  const posterWallets = generatePosterWallets(cfg.posters);
  const endDate = new Date(now.getTime() - 2 * 3600 * 1000); // 2 hours ago
  const timestamps = generateRampUpTimestamps(cfg.jobs, genesisDate, endDate);
  const pool = getPool();

  const categories = CATEGORY_WEIGHTS.map((c) => c);
  const weights = CATEGORY_WEIGHTS.map((c) => c.weight);

  const jobs: SeededJob[] = [];

  for (let i = 0; i < cfg.jobs; i++) {
    const id = BigInt(i + 1);
    const createdAt = timestamps[i];
    const catConfig = weightedPick(categories, weights);
    const templates = JOB_TEMPLATES[catConfig.category] ?? [];
    if (templates.length === 0) continue;

    const template = pick(templates);
    const poster = pick(posterWallets);
    const budgetUsdc = randomInt(catConfig.budgetRange[0], catConfig.budgetRange[1]);
    const budget = BigInt(budgetUsdc) * USDC_MULTIPLIER;
    const deadlineDays = randomInt(3, 30);
    const deadline = BigInt(Math.floor(createdAt.getTime() / 1000) + deadlineDays * 86400);
    const blockNumber = timestampToBlock(createdAt, genesisDate);

    const status = pickStatus(createdAt, now, cfg);

    const criteria = pickCriteriaForJob(catConfig.jobType);
    const criteriaIds = criteria.map((c) => c.id);
    const successCriteria = criteriaToSuccessCriteria(criteria);
    const criteriaHash = criteriaIds.length > 0 ? fakeCriteriaHash(criteriaIds) : undefined;

    // Insert the job
    await insertJob({
      id,
      poster,
      description: template.description,
      metadataUri: fakeIpfsUri(),
      tags: catConfig.tags,
      deadline,
      blockNumber,
      txHash: fakeTxHash(),
    });

    // Set budget, category, criteria fields via direct SQL (not in insertJob params)
    await pool.query(
      `UPDATE jobs SET
        budget = $2,
        category = $3,
        criteria_hash = $4,
        criteria_count = $5,
        all_required = $6,
        passing_score = $7,
        created_at = $8
      WHERE id = $1`,
      [
        id.toString(),
        budget.toString(),
        catConfig.category,
        criteriaHash ?? null,
        criteriaIds.length,
        criteriaIds.length <= 5, // all_required for small criteria sets
        70, // passing score
        createdAt.toISOString(),
      ],
    );

    // Compute completed_at for completed/disputed jobs
    let completedAt: Date | null = null;
    if (status === 'completed' || status === 'disputed') {
      const completionHours = randomInt(24, deadlineDays * 24);
      completedAt = new Date(createdAt.getTime() + completionHours * 3600 * 1000);
      if (completedAt > now) completedAt = new Date(now.getTime() - randomInt(1, 48) * 3600 * 1000);
    }

    // Update status (insertJob sets it to 'open')
    if (status !== 'open') {
      await updateJobStatus(id, status);
      if (completedAt) {
        await pool.query(
          `UPDATE jobs SET completed_at = $2 WHERE id = $1`,
          [id.toString(), completedAt.toISOString()],
        );
      }
    }

    jobs.push({
      id,
      poster,
      title: template.title,
      description: template.description,
      category: catConfig.category,
      jobType: catConfig.jobType,
      tags: catConfig.tags,
      budget,
      budgetUsdc,
      deadline,
      status,
      createdAt,
      completedAt,
      criteriaIds,
      successCriteria,
      deliverableType: catConfig.deliverableType,
    });
  }

  console.log(`  [jobs] seeded ${jobs.length} jobs`);
  const statusCounts: Record<string, number> = {};
  for (const j of jobs) statusCounts[j.status] = (statusCounts[j.status] ?? 0) + 1;
  console.log(`  [jobs] status distribution:`, statusCounts);

  return jobs;
}
