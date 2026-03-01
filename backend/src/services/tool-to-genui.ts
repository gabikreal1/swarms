import { v4 as uuid } from 'uuid';
import type {
  GenUIBlock,
  TableBlock,
  CardBlock,
  CriteriaBlock,
  CriteriaItem,
  TagsBlock,
  ActionBlock,
  TransactionBlock,
  LinkBlock,
} from '../types/chat';
import { pinata } from './pinata';

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
      { key: 'field', label: 'Field', align: 'left', flex: 1 },
      { key: 'value', label: 'Value', align: 'left', flex: 2 },
      { key: 'status', label: 'Status', align: 'center', flex: 1 },
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
      { key: 'item', label: 'Item', align: 'left', flex: 2 },
      { key: 'amount', label: 'Amount', align: 'right', flex: 1 },
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

  // Emit one card per job — much better on mobile than a cramped table
  const blocks: GenUIBlock[] = jobs.map((j) => {
    const card: CardBlock = {
      id: blockId('card'),
      type: 'card',
      variant: 'job_status',
      data: {
        id: j.id ?? j.jobId ?? '',
        chain_id: j.chain_id ?? j.chainId ?? null,
        description: j.description || j.title || '',
        status: j.status || 'open',
        bid_count: Number(j.bid_count ?? j.bidCount ?? 0),
        tags: j.tags || [],
        budget: j.budget != null ? Number(j.budget) / 1e6 : null,
      },
    };
    return card;
  });

  return blocks;
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

  // Build a card per bid with proposal details (if fetched from IPFS)
  for (const b of bids) {
    const agentName = String(b.agent_name || b.bidder || '-');
    const price = b.price != null ? `${Number(b.price) / 1e6} USDC` : '-';
    const proposal = b.proposal as Record<string, unknown> | undefined;

    let proposalSummary = '';
    if (proposal) {
      // Extract meaningful fields from the IPFS proposal document
      const parts: string[] = [];
      if (proposal.approach) parts.push(`**Approach:** ${proposal.approach}`);
      if (proposal.description) parts.push(`**Description:** ${proposal.description}`);
      if (proposal.timeline) parts.push(`**Timeline:** ${proposal.timeline}`);
      if (proposal.deliverables) {
        const dels = Array.isArray(proposal.deliverables)
          ? proposal.deliverables.join(', ')
          : String(proposal.deliverables);
        parts.push(`**Deliverables:** ${dels}`);
      }
      // Fallback: show raw JSON summary if no known fields
      if (parts.length === 0) {
        proposalSummary = JSON.stringify(proposal).slice(0, 500);
      } else {
        proposalSummary = parts.join('\n');
      }
    }

    const rows = [
      { field: 'Agent', value: agentName },
      { field: 'Price', value: price },
      { field: 'Reputation', value: String(b.reputation ?? '-') },
      { field: 'Delivery Time', value: b.delivery_time ? `${Number(b.delivery_time)}s` : '-' },
    ];

    if (proposalSummary) {
      rows.push({ field: 'Proposal', value: proposalSummary });
    }

    const table: TableBlock = {
      id: blockId('table'),
      type: 'table',
      columns: [
        { key: 'field', label: 'Field', align: 'left', flex: 1 },
        { key: 'value', label: 'Value', align: 'left', flex: 3 },
      ],
      rows,
      sortable: false,
    };
    blocks.push(table);

    // Clickable IPFS link for bid proposal
    if (b.metadata_uri) {
      const uri = String(b.metadata_uri);
      const url = uri.startsWith('ipfs://') ? pinata.getGatewayUrl(uri) : uri;
      blocks.push({
        id: blockId('link'),
        type: 'link',
        label: `View ${agentName}'s Proposal`,
        url,
        icon: 'open-outline',
      } as LinkBlock);
    }
  }

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
    confirmMessage: `Accept this bid for ${b.price != null ? Number(b.price) / 1e6 : '?'} USDC?`,
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

  // Pass through USDC approval info if present (e.g. for accept_bid → escrow)
  if (result.approval) {
    (txBlock as any).approval = result.approval;
  }

  return [txBlock];
}

// ── get_delivery_status ─────────────────────────────────────

function buildDeliveryStatusBlocks(result: Record<string, unknown>): GenUIBlock[] {
  const blocks: GenUIBlock[] = [];
  const status = String(result.status || '-');

  const rows: Record<string, string>[] = [
    { field: 'Status', value: status },
    { field: 'Proof Hash', value: String(result.proof_hash || '-') },
    { field: 'Delivered At', value: String(result.delivered_at || '-') },
  ];

  const table: TableBlock = {
    id: blockId('table'),
    type: 'table',
    columns: [
      { key: 'field', label: 'Field', align: 'left', flex: 1 },
      { key: 'value', label: 'Value', align: 'left', flex: 2 },
    ],
    rows,
    sortable: false,
  };
  blocks.push(table);

  // Clickable IPFS link for evidence
  if (result.evidenceURI) {
    const uri = String(result.evidenceURI);
    const url = uri.startsWith('ipfs://') ? pinata.getGatewayUrl(uri) : uri;
    blocks.push({
      id: blockId('link'),
      type: 'link',
      label: 'View Delivery Evidence',
      url,
      icon: 'document-text-outline',
    } as LinkBlock);
  }

  // Clickable IPFS link for job metadata
  if (result.job_metadata_uri) {
    const uri = String(result.job_metadata_uri);
    const url = uri.startsWith('ipfs://') ? pinata.getGatewayUrl(uri) : uri;
    blocks.push({
      id: blockId('link'),
      type: 'link',
      label: 'View Job Metadata',
      url,
      icon: 'folder-open-outline',
    } as LinkBlock);
  }

  // Show delivery evidence summary if fetched from IPFS
  const evidence = result.evidence as Record<string, unknown> | undefined;
  if (evidence) {
    let evidenceText = '';
    const manifest = evidence.manifest as Record<string, unknown> | undefined;
    const evidenceItems = evidence.evidence as Record<string, unknown>[] | undefined;

    if (manifest) {
      const parts: string[] = [];
      if (manifest.description) parts.push(`**Job:** ${manifest.description}`);
      if (manifest.completedAt) parts.push(`**Completed:** ${manifest.completedAt}`);
      const results = manifest.results as Record<string, unknown> | undefined;
      if (results) {
        for (const [step, val] of Object.entries(results)) {
          const summary = typeof val === 'string' ? val.slice(0, 300) : JSON.stringify(val).slice(0, 300);
          parts.push(`**${step}:** ${summary}`);
        }
      }
      evidenceText += parts.join('\n');
    }

    if (evidenceItems && evidenceItems.length > 0) {
      const criteriaLines = evidenceItems.map((item) =>
        `- **Criterion ${item.criterionIndex}** (${item.description}): ${String(item.evidence).slice(0, 200)}`,
      );
      evidenceText += (evidenceText ? '\n\n' : '') + '**Validation Evidence:**\n' + criteriaLines.join('\n');
    }

    if (evidenceText) {
      blocks.push({
        id: blockId('text'),
        type: 'text' as const,
        content: evidenceText,
      });
    }
  }

  // Add action buttons based on status
  if (status === 'delivered') {
    const actionBlock: ActionBlock = {
      id: blockId('action'),
      type: 'action',
      actions: [
        {
          id: blockId('btn'),
          label: 'Approve & Release Escrow',
          variant: 'primary' as const,
          toolCall: 'approve_delivery',
          toolArgs: { jobId: String(result.id || '') },
          confirmMessage: 'Approve this delivery and release escrowed funds to the agent?',
        },
        {
          id: blockId('btn'),
          label: 'Check Again',
          variant: 'outline' as const,
          toolCall: 'get_delivery_status',
          toolArgs: { jobId: String(result.id || '') },
        },
      ],
      layout: 'horizontal',
    };
    blocks.push(actionBlock);
  } else if (status === 'in_progress') {
    const actionBlock: ActionBlock = {
      id: blockId('action'),
      type: 'action',
      actions: [
        {
          id: blockId('btn'),
          label: 'Check Delivery Status',
          variant: 'primary' as const,
          toolCall: 'get_delivery_status',
          toolArgs: { jobId: String(result.id || '') },
        },
      ],
      layout: 'horizontal',
    };
    blocks.push(actionBlock);
  }

  return blocks;
}
