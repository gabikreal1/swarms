import type { SessionContext } from '../types/chat';

export type JobType =
  | 'audit'
  | 'code_review'
  | 'data_engineering'
  | 'nlp_content'
  | 'ml_ai'
  | 'frontend_ux'
  | 'infrastructure';

export const VERTICAL_LABELS: Record<JobType, string> = {
  audit: 'Smart Contract Audit',
  code_review: 'Code Review',
  data_engineering: 'Data Engineering',
  nlp_content: 'NLP / Content',
  ml_ai: 'ML / AI',
  frontend_ux: 'Frontend / UX',
  infrastructure: 'Infrastructure / DevOps',
};

export function updateContextFromToolResult(
  context: SessionContext,
  toolName: string,
  toolResult: Record<string, unknown>,
): SessionContext {
  const updated = { ...context };

  switch (toolName) {
    case 'analyze_contract':
      updated.jobType = 'audit';
      if (toolResult.contractAddress) {
        updated.contractAddress = toolResult.contractAddress as string;
      }
      if (toolResult.chain) {
        updated.chain = toolResult.chain as string;
      }
      break;

    case 'analyze_requirements': {
      const inferredType = toolResult.jobType as string;
      if (isValidJobType(inferredType)) {
        updated.jobType = inferredType;
      }
      break;
    }

    case 'get_job_criteria':
      if (Array.isArray(toolResult.criteria)) {
        updated.selectedCriteria = (toolResult.criteria as { id: string }[]).map(c => c.id);
      }
      break;

    case 'post_job':
      if (typeof toolResult.jobId === 'string') {
        updated.jobId = toolResult.jobId;
      }
      if (typeof toolResult.chainJobId === 'number') {
        updated.chainJobId = toolResult.chainJobId;
      }
      break;

    case 'get_my_jobs':
      updated.lastJobsQuery = toolResult.jobs as Record<string, unknown>[];
      break;

    case 'get_job_bids':
      updated.bids = toolResult.bids as Record<string, unknown>[];
      if (toolResult.jobId) updated.currentJobId = toolResult.jobId as string;
      break;

    case 'accept_bid':
      if (toolResult.bidId) updated.acceptedBidId = toolResult.bidId as string;
      break;

    case 'approve_delivery':
      break;

    default:
      break;
  }

  return updated;
}

function isValidJobType(value: string): value is JobType {
  return ['audit', 'code_review', 'data_engineering', 'nlp_content', 'ml_ai', 'frontend_ux', 'infrastructure'].includes(value);
}
