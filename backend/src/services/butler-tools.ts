import { CriteriaCategory, getCriteriaForJobType } from '../validator/owasp-criteria';
import { FinalizePipeline } from '../pipeline/finalize';
import { SuccessCriterion } from '../types/job-slots';
import { getPool } from '../db/pool';
import { ethers } from 'ethers';
import { config } from '../config';
import { log } from '../lib/logger';
import { pinata } from './pinata';

const finalizePipeline = new FinalizePipeline();

// ABI fragments for on-chain interactions
const ACCEPT_BID_ABI = ['function acceptBid(uint256 jobId, uint256 bidId, string responseURI)'];
const APPROVE_JOB_ABI = ['function approveJob(uint256 jobId)'];

const acceptBidIface = new ethers.Interface(ACCEPT_BID_ABI);
const approveJobIface = new ethers.Interface(APPROVE_JOB_ABI);

/**
 * Converts relative deadlines ("2 days", "1 week") and natural dates
 * ("March 15") into ISO 8601 strings. Falls back to default (14 days).
 */
function parseDeadlineToISO(raw: string | undefined): string {
  if (!raw) return new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

  // Already a valid ISO date?
  const directParse = new Date(raw);
  if (!isNaN(directParse.getTime()) && raw.length > 6) {
    return directParse.toISOString();
  }

  // Relative: "2 days", "3 weeks", "1 month"
  const relMatch = raw.match(/^(\d+)\s*(day|days|week|weeks|month|months|hour|hours)$/i);
  if (relMatch) {
    const n = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase().replace(/s$/, '');
    const ms: Record<string, number> = {
      hour: 3600 * 1000,
      day: 24 * 3600 * 1000,
      week: 7 * 24 * 3600 * 1000,
      month: 30 * 24 * 3600 * 1000,
    };
    return new Date(Date.now() + n * (ms[unit] || ms.day)).toISOString();
  }

  // Fallback
  return new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
}

export interface ButlerTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean; enum?: string[] }>;
}

export const BUTLER_TOOLS: ButlerTool[] = [
  {
    name: 'get_job_criteria',
    description: 'Get success criteria for a specific job type',
    parameters: {
      jobType: { type: 'string', description: 'The job vertical', required: true, enum: ['audit', 'code_review', 'data_engineering', 'nlp_content', 'ml_ai', 'frontend_ux', 'infrastructure'] },
      subtypes: { type: 'string[]', description: 'Optional subtypes for filtering (e.g., defi, governance for audit)', required: false },
    },
  },
  {
    name: 'analyze_requirements',
    description: 'Analyze a job description to infer job type, complexity, and suggestions',
    parameters: {
      description: { type: 'string', description: 'The job description to analyze', required: true },
    },
  },
  {
    name: 'estimate_cost',
    description: 'Estimate cost for a job based on type and scope',
    parameters: {
      jobType: { type: 'string', description: 'The job vertical', required: true },
      linesOfCode: { type: 'number', description: 'Estimated lines of code (if applicable)', required: false },
      complexity: { type: 'string', description: 'Job complexity', required: false, enum: ['simple', 'moderate', 'complex'] },
    },
  },
  {
    name: 'post_job',
    description: 'Post a job to the marketplace',
    parameters: {
      title: { type: 'string', description: 'Job title', required: true },
      description: { type: 'string', description: 'Job description', required: true },
      budget: { type: 'number', description: 'Budget in USDC', required: true },
      deadline: { type: 'string', description: 'Deadline as ISO-8601 date', required: true },
      criteria: { type: 'string[]', description: 'Selected criteria IDs', required: true },
      tags: { type: 'string[]', description: 'Job tags', required: true },
      category: { type: 'string', description: 'Job category/vertical', required: true },
    },
  },
];

function inferJobType(description: string): string {
  const d = description.toLowerCase();
  if (/\b(data|pipeline|etl|warehouse|scraping|ingestion)\b/.test(d)) return 'data_engineering';
  if (/\b(review|pr\b|refactor|code quality|pull request)\b/.test(d)) return 'code_review';
  if (/\b(sentiment|nlp|summariz|content gen|text analysis)\b/.test(d)) return 'nlp_content';
  if (/\b(model|training|fine.?tun|ml\b|machine learn|neural)\b/.test(d)) return 'ml_ai';
  if (/\b(ui\b|frontend|accessibility|a11y|lighthouse|ux\b)\b/.test(d)) return 'frontend_ux';
  if (/\b(deploy|ci.?cd|monitor|infrastructure|devops|subgraph)\b/.test(d)) return 'infrastructure';
  return 'audit';
}

function inferComplexity(description: string): 'simple' | 'moderate' | 'complex' {
  const words = description.split(/\s+/).length;
  if (words < 20) return 'simple';
  if (words < 60) return 'moderate';
  return 'complex';
}

const BASE_COSTS: Record<string, { base: number; perLOC: number }> = {
  audit: { base: 5, perLOC: 0.01 },
  code_review: { base: 3, perLOC: 0.005 },
  data_engineering: { base: 10, perLOC: 0 },
  nlp_content: { base: 8, perLOC: 0 },
  ml_ai: { base: 15, perLOC: 0 },
  frontend_ux: { base: 5, perLOC: 0 },
  infrastructure: { base: 12, perLOC: 0 },
};

const COMPLEXITY_MULTIPLIER: Record<string, number> = {
  simple: 1,
  moderate: 1.5,
  complex: 2.5,
};

export async function executeButlerTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'get_job_criteria': {
      const jobType = args.jobType as string;
      const subtypes = args.subtypes as string[] | undefined;
      const criteria = getCriteriaForJobType(jobType, subtypes);
      return {
        jobType,
        criteria: criteria.map(c => ({
          id: c.id,
          name: c.name,
          description: c.criterionDescription,
          severity: c.severity,
          selected: false,
        })),
        count: criteria.length,
      };
    }

    case 'analyze_requirements': {
      const description = args.description as string;
      const jobType = inferJobType(description);
      const complexity = inferComplexity(description);
      return {
        jobType,
        complexity,
        suggestedDeliverables: getDeliverables(jobType),
        suggestedTags: getTags(jobType),
      };
    }

    case 'estimate_cost': {
      const jobType = (args.jobType as string) || 'audit';
      const loc = (args.linesOfCode as number) || 0;
      const complexity = (args.complexity as string) || 'moderate';
      const costs = BASE_COSTS[jobType] || BASE_COSTS.audit;
      const multiplier = COMPLEXITY_MULTIPLIER[complexity] || 1.5;
      const estimate = (costs.base + costs.perLOC * loc) * multiplier;
      return {
        jobType,
        linesOfCode: loc,
        complexity,
        estimatedCostUSDC: Math.round(estimate * 100) / 100,
        breakdown: {
          baseCost: costs.base,
          perLOCCost: costs.perLOC * loc,
          complexityMultiplier: multiplier,
        },
      };
    }

    case 'post_job': {
      const title = (args.title as string) || 'Untitled Job';
      const description = (args.description as string) || '';
      const budget = (args.budget as number) || 0;
      const deadline = (args.deadline as string) || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      const criteriaIds = (args.criteria as string[]) || [];
      const tags = (args.tags as string[]) || [];
      const category = (args.category as string) || 'general';

      const acceptedCriteria: SuccessCriterion[] = criteriaIds.map((id) => ({
        id,
        description: id,
        measurable: true,
        source: 'llm_suggested' as const,
        accepted: true,
      }));

      const result = await finalizePipeline.finalize({
        sessionId: `butler-${Date.now()}`,
        slots: {
          taskDescription: { value: description, provenance: 'user_explicit', confidence: 1 },
          deliverableType: { value: category, provenance: 'llm_inferred', confidence: 0.8 },
          scope: { value: { complexity: 'moderate' }, provenance: 'default', confidence: 0.5 },
          deadline: { value: deadline, provenance: 'user_explicit', confidence: 1 },
          budget: { value: { amount: budget, currency: 'USDC' }, provenance: 'user_explicit', confidence: 1 },
          acceptanceCriteria: { value: [], provenance: 'default', confidence: 0.5 },
          requiredCapabilities: { value: [], provenance: 'default', confidence: 0.5 },
          preferredAgentReputation: { value: 0, provenance: 'default', confidence: 0.5 },
          context: { value: '', provenance: 'default', confidence: 0.5 },
          exampleOutputs: { value: [], provenance: 'default', confidence: 0.5 },
        },
        acceptedCriteria,
        walletAddress: (args.walletAddress as string) || '0x0000000000000000000000000000000000000000',
        tags,
        category,
      });

      return {
        success: true,
        title,
        category,
        metadataURI: result.metadataURI,
        transaction: result.transaction,
        useCriteria: result.useCriteria,
      };
    }

    case 'get_my_jobs': {
      const wallet = args.wallet as string;
      const status = args.status as string | undefined;
      const limit = (args.limit as number) || 1; // default: last job only
      const pool = getPool();

      let query = `SELECT j.id, j.chain_id, j.description, j.status, j.budget, j.category, j.tags, j.deadline, j.created_at, COUNT(b.id)::int as bid_count FROM jobs j LEFT JOIN bids b ON b.job_id = j.id WHERE LOWER(j.poster) = LOWER($1)`;
      const params: unknown[] = [wallet];
      let paramIdx = 2;
      if (status) {
        query += ` AND j.status = $${paramIdx}`;
        params.push(status);
        paramIdx++;
      }
      query += ` GROUP BY j.id ORDER BY j.created_at DESC LIMIT $${paramIdx}`;
      params.push(limit);
      const { rows } = await pool.query(query, params);
      log.tool.info(`get_my_jobs: found ${rows.length} jobs for wallet=${wallet} (limit=${limit})`);
      return { jobs: rows };
    }

    case 'get_job_bids': {
      const jobId = args.jobId as string;
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT b.id, b.chain_id, b.bidder, b.price, b.delivery_time, b.reputation, b.accepted, b.metadata_uri, a.name as agent_name FROM bids b LEFT JOIN agents a ON LOWER(a.wallet) = LOWER(b.bidder) WHERE b.job_id = $1 ORDER BY b.price ASC`,
        [jobId],
      );

      // Fetch IPFS proposal content for each bid (best-effort)
      const enrichedBids = await Promise.all(
        rows.map(async (bid: any) => {
          if (bid.metadata_uri) {
            try {
              const proposal = await pinata.fetchJSON(bid.metadata_uri);
              return { ...bid, proposal };
            } catch (err) {
              log.tool.debug(`bid ${bid.id} IPFS fetch failed:`, (err as Error).message);
            }
          }
          return bid;
        }),
      );

      return { jobId, bids: enrichedBids };
    }

    case 'accept_bid': {
      const jobId = args.jobId as string;
      const bidId = args.bidId as string;
      const pool = getPool();
      const jobRow = await pool.query(`SELECT chain_id FROM jobs WHERE id = $1`, [jobId]);
      const bidRow = await pool.query(`SELECT chain_id, price FROM bids WHERE id = $1`, [bidId]);
      const chainJobId = jobRow.rows[0]?.chain_id;
      const chainBidId = bidRow.rows[0]?.chain_id;
      const bidPrice = bidRow.rows[0]?.price;
      if (!chainJobId || !chainBidId) {
        return { error: 'Could not find on-chain IDs for job or bid' };
      }
      const data = acceptBidIface.encodeFunctionData('acceptBid', [chainJobId, chainBidId, '']);
      return {
        bidId,
        transaction: {
          to: config.orderBookAddress,
          data,
          value: '0',
          chainId: config.chainId,
        },
        // Tell frontend to approve USDC for escrow before sending
        approval: {
          spender: config.escrowAddress,
          amount: String(bidPrice || 0),
        },
      };
    }

    case 'get_delivery_status': {
      const jobId = args.jobId as string;
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT j.id, j.chain_id, j.status, j.description, j.metadata_uri as job_metadata_uri, d.proof_hash, d.delivered_at FROM jobs j LEFT JOIN deliveries d ON d.job_id = j.id WHERE j.id = $1`,
        [jobId],
      );
      if (rows.length === 0) return { error: 'Job not found' };

      const job = rows[0];

      // If delivered, try to fetch on-chain evidence URI via criteriaDeliveries
      if (job.chain_id && config.orderBookAddress && (job.status === 'delivered' || job.status === 'completed')) {
        try {
          const CRITERIA_DELIVERY_ABI = [
            'function criteriaDeliveries(uint256) view returns (bytes32 evidenceMerkleRoot, bytes32 overallProofHash, string evidenceURI, uint256 deliveredAt)',
          ];
          const network = new ethers.Network('arc-testnet', config.chainId);
          const provider = new ethers.JsonRpcProvider(config.rpcUrl, network, { staticNetwork: network });
          const contract = new ethers.Contract(config.orderBookAddress!, CRITERIA_DELIVERY_ABI, provider);
          const delivery = await contract.criteriaDeliveries(job.chain_id);
          const evidenceURI: string = delivery.evidenceURI;

          if (evidenceURI) {
            try {
              const evidence = await pinata.fetchJSON(evidenceURI);
              job.evidenceURI = evidenceURI;
              job.evidence = evidence;
            } catch (err) {
              log.tool.debug(`delivery evidence IPFS fetch failed:`, (err as Error).message);
              job.evidenceURI = evidenceURI;
            }
          }
        } catch (err) {
          log.tool.debug(`criteriaDeliveries read failed:`, (err as Error).message);
        }
      }

      return job;
    }

    case 'approve_delivery': {
      const jobId = args.jobId as string;
      const pool = getPool();
      const { rows } = await pool.query(`SELECT chain_id, status FROM jobs WHERE id = $1`, [jobId]);
      if (rows.length === 0) return { error: 'Job not found' };
      const job = rows[0];
      if (job.status !== 'delivered') {
        return { error: `Cannot approve: job status is '${job.status}', expected 'delivered'` };
      }
      if (!job.chain_id) {
        return { error: 'No on-chain ID for this job' };
      }
      const data = approveJobIface.encodeFunctionData('approveJob', [job.chain_id]);
      return {
        jobId,
        transaction: {
          to: config.orderBookAddress,
          data,
          value: '0',
          chainId: config.chainId,
        },
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function getDeliverables(jobType: string): string[] {
  const map: Record<string, string[]> = {
    audit: ['Security audit report', 'Vulnerability summary', 'Remediation guide'],
    code_review: ['Code review report', 'Refactoring suggestions', 'Quality metrics'],
    data_engineering: ['Pipeline implementation', 'Data quality report', 'Schema documentation'],
    nlp_content: ['Analysis results', 'Generated content', 'Quality metrics report'],
    ml_ai: ['Trained model', 'Evaluation report', 'Training documentation'],
    frontend_ux: ['UI audit report', 'Lighthouse scores', 'Accessibility fixes'],
    infrastructure: ['Deployment scripts', 'Monitoring dashboard', 'Runbook documentation'],
  };
  return map[jobType] || map.audit;
}

function getTags(jobType: string): string[] {
  const map: Record<string, string[]> = {
    audit: ['smart-contract', 'security', 'audit'],
    code_review: ['code-review', 'quality', 'refactoring'],
    data_engineering: ['data', 'pipeline', 'etl'],
    nlp_content: ['nlp', 'content', 'text-analysis'],
    ml_ai: ['machine-learning', 'ai', 'model-training'],
    frontend_ux: ['frontend', 'ux', 'accessibility'],
    infrastructure: ['devops', 'infrastructure', 'deployment'],
  };
  return map[jobType] || map.audit;
}
