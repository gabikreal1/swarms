import { v4 as uuid } from 'uuid';
import type {
  GenUIBlock,
  TableBlock,
  CriteriaBlock,
  CriteriaItem,
  TagsBlock,
  ActionBlock,
  TransactionBlock,
} from '../types/chat';

function blockId(prefix: string): string {
  return `${prefix}-${uuid().slice(0, 8)}`;
}

export function mapToolResultToBlocks(
  toolName: string,
  toolResult: Record<string, unknown>,
): GenUIBlock[] {
  switch (toolName) {
    case 'analyze_requirements':
      return buildAnalysisBlocks(toolResult);
    case 'estimate_cost':
      return buildCostBlocks(toolResult);
    case 'get_job_criteria':
      return buildCriteriaBlocks(toolResult);
    case 'post_job':
      return buildPostJobBlocks(toolResult);
    case 'get_my_jobs':
      return buildMyJobsBlocks(toolResult);
    case 'get_job_bids':
      return buildBidsBlocks(toolResult);
    case 'accept_bid':
      return buildTransactionBlocks(toolResult, 'Accept Bid');
    case 'get_delivery_status':
      return buildDeliveryStatusBlocks(toolResult);
    case 'approve_delivery':
      return buildTransactionBlocks(toolResult, 'Approve Delivery');
    default:
      return [];
  }
}

// ── analyze_requirements ────────────────────────────────────

function buildAnalysisBlocks(result: Record<string, unknown>): GenUIBlock[] {
  const rows = [
    {
      field: 'Job Type',
      value: String(result.jobType || 'unknown'),
      status: result.jobType ? 'detected' : 'missing',
    },
    {
      field: 'Complexity',
      value: String(result.complexity || 'unknown'),
      status: result.complexity ? 'detected' : 'missing',
    },
    {
      field: 'Suggested Tags',
      value: Array.isArray(result.suggestedTags) ? result.suggestedTags.join(', ') : '-',
      status: Array.isArray(result.suggestedTags) && result.suggestedTags.length > 0 ? 'detected' : 'none',
    },
  ];

  if (result.estimatedCostUSDC !== undefined) {
    rows.push({
      field: 'Est. Cost',
      value: `${result.estimatedCostUSDC} USDC`,
      status: 'estimated',
    });
  }

  const table: TableBlock = {
    id: blockId('table'),
    type: 'table',
    columns: [
      { key: 'field', label: 'Field', align: 'left' },
      { key: 'value', label: 'Value', align: 'left' },
      { key: 'status', label: 'Status', align: 'center' },
    ],
    rows,
    sortable: false,
  };

  return [table];
}

// ── estimate_cost ───────────────────────────────────────────

function buildCostBlocks(result: Record<string, unknown>): GenUIBlock[] {
  const breakdown = result.breakdown as Record<string, unknown> | undefined;
  const rows: Record<string, string | number>[] = [
    { item: 'Base Cost', amount: String(breakdown?.baseCost ?? '-') },
    { item: 'Per-LOC Cost', amount: String(breakdown?.perLOCCost ?? '-') },
    { item: 'Complexity Multiplier', amount: `x${breakdown?.complexityMultiplier ?? '-'}` },
    { item: 'Total Estimate', amount: `${result.estimatedCostUSDC ?? '-'} USDC` },
  ];

  const table: TableBlock = {
    id: blockId('table'),
    type: 'table',
    columns: [
      { key: 'item', label: 'Item', align: 'left' },
      { key: 'amount', label: 'Amount', align: 'right' },
    ],
    rows,
    sortable: false,
  };

  return [table];
}

// ── get_job_criteria ────────────────────────────────────────

function buildCriteriaBlocks(result: Record<string, unknown>): GenUIBlock[] {
  const blocks: GenUIBlock[] = [];

  const rawCriteria = result.criteria as Record<string, unknown>[] | undefined;
  if (rawCriteria && rawCriteria.length > 0) {
    const criteriaItems: CriteriaItem[] = rawCriteria.map((c) => ({
      id: String(c.id),
      description: String(c.description || c.name || ''),
      category: String(c.category || result.jobType || 'general'),
      measurable: true,
      source: 'llm_suggested' as const,
      preselected: true,
    }));

    const criteriaBlock: CriteriaBlock = {
      id: blockId('criteria'),
      type: 'criteria',
      criteria: criteriaItems,
      allowCustom: true,
    };
    blocks.push(criteriaBlock);
  }

  // Tags block if suggested tags exist
  const tags = result.suggestedTags as string[] | undefined;
  if (tags && tags.length > 0) {
    const tagsBlock: TagsBlock = {
      id: blockId('tags'),
      type: 'tags',
      suggested: tags,
      selected: [],
      allowCustom: true,
    };
    blocks.push(tagsBlock);
  }

  // Action block: confirm or go back
  const actionBlock: ActionBlock = {
    id: blockId('action'),
    type: 'action',
    actions: [
      {
        id: 'confirm-criteria',
        label: 'Confirm & Post Job',
        variant: 'primary',
      },
      {
        id: 'go-back',
        label: 'Go Back',
        variant: 'outline',
      },
    ],
    layout: 'horizontal',
  };
  blocks.push(actionBlock);

  return blocks;
}

// ── post_job ────────────────────────────────────────────────

function buildPostJobBlocks(result: Record<string, unknown>): GenUIBlock[] {
  const tx = result.transaction as { to: string; data: string; value: string; chainId: number } | undefined;
  if (!tx) return [];

  const txBlock: TransactionBlock = {
    id: blockId('tx'),
    type: 'transaction',
    transaction: tx,
    title: String(result.title || 'Post Job'),
    budget: result.budget as number | undefined,
    criteriaCount: Array.isArray(result.useCriteria) ? result.useCriteria.length : undefined,
  };

  return [txBlock];
}

// ── get_my_jobs ─────────────────────────────────────────────

function buildMyJobsBlocks(result: Record<string, unknown>): GenUIBlock[] {
  const jobs = result.jobs as Record<string, unknown>[] | undefined;
  if (!jobs || jobs.length === 0) {
    return [{
      id: blockId('text'),
      type: 'text',
      content: 'You have no jobs matching that filter.',
    }];
  }

  const rows = jobs.map((j) => ({
    description: String(j.description || j.title || '-'),
    status: String(j.status || '-'),
    bids: Number(j.bid_count ?? j.bidCount ?? 0),
    budget: String(j.budget ?? '-'),
  }));

  const table: TableBlock = {
    id: blockId('table'),
    type: 'table',
    columns: [
      { key: 'description', label: 'Description', align: 'left' },
      { key: 'status', label: 'Status', align: 'center' },
      { key: 'bids', label: 'Bids', align: 'center' },
      { key: 'budget', label: 'Budget', align: 'right' },
    ],
    rows,
    sortable: true,
  };

  return [table];
}

// ── get_job_bids ────────────────────────────────────────────

function buildBidsBlocks(result: Record<string, unknown>): GenUIBlock[] {
  const blocks: GenUIBlock[] = [];
  const bids = result.bids as Record<string, unknown>[] | undefined;

  if (!bids || bids.length === 0) {
    return [{
      id: blockId('text'),
      type: 'text',
      content: 'No bids have been placed on this job yet.',
    }];
  }

  const rows = bids.map((b) => ({
    agent: String(b.agent_name || b.bidder || '-'),
    price: String(b.price ?? '-'),
    reputation: String(b.reputation ?? '-'),
  }));

  const table: TableBlock = {
    id: blockId('table'),
    type: 'table',
    columns: [
      { key: 'agent', label: 'Agent', align: 'left' },
      { key: 'price', label: 'Price (USDC)', align: 'right' },
      { key: 'reputation', label: 'Reputation', align: 'center' },
    ],
    rows,
    sortable: true,
  };
  blocks.push(table);

  // Action buttons to accept each bid
  const actions = bids.map((b) => ({
    id: blockId('btn'),
    label: `Accept ${String(b.agent_name || b.bidder || '').slice(0, 10)}`,
    variant: 'primary' as const,
    toolCall: 'accept_bid',
    toolArgs: {
      jobId: String(result.jobId || ''),
      bidId: String(b.id || ''),
    },
    confirmMessage: `Accept this bid for ${b.price ?? '?'} wei?`,
  }));

  const actionBlock: ActionBlock = {
    id: blockId('action'),
    type: 'action',
    actions,
    layout: 'vertical',
  };
  blocks.push(actionBlock);

  return blocks;
}

// ── Transaction helpers (accept_bid, approve_delivery) ──────

function buildTransactionBlocks(
  result: Record<string, unknown>,
  title: string,
): GenUIBlock[] {
  const tx = result.transaction as { to: string; data: string; value: string; chainId: number } | undefined;
  if (!tx) return [];

  const txBlock: TransactionBlock = {
    id: blockId('tx'),
    type: 'transaction',
    transaction: tx,
    title,
  };

  return [txBlock];
}

// ── get_delivery_status ─────────────────────────────────────

function buildDeliveryStatusBlocks(result: Record<string, unknown>): GenUIBlock[] {
  const rows = [
    { field: 'Status', value: String(result.status || '-') },
    { field: 'Proof Hash', value: String(result.proof_hash || '-') },
    { field: 'Delivered At', value: String(result.delivered_at || '-') },
  ];

  const table: TableBlock = {
    id: blockId('table'),
    type: 'table',
    columns: [
      { key: 'field', label: 'Field', align: 'left' },
      { key: 'value', label: 'Value', align: 'left' },
    ],
    rows,
    sortable: false,
  };

  return [table];
}
