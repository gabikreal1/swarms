import type { JobSlots, SuccessCriterion } from './job-slots';

// ── GenUI Block Types ─────────────────────────────────────

export type GenUIBlockType =
  | 'text' | 'code' | 'card' | 'form' | 'criteria' | 'tags'
  | 'action' | 'progress' | 'table' | 'findings' | 'chart' | 'diff'
  | 'transaction' | 'link';

interface BaseBlock {
  id: string;
  type: GenUIBlockType;
}

export interface TextBlock extends BaseBlock {
  type: 'text';
  content: string;
}

export interface CodeBlock extends BaseBlock {
  type: 'code';
  language: string;
  code: string;
  filename?: string;
  highlightLines?: number[];
}

export interface CardBlock extends BaseBlock {
  type: 'card';
  variant: 'agent_profile' | 'bid_summary' | 'job_status' | 'payment' | 'validation_result';
  data: Record<string, unknown>;
}

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'address';
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  defaultValue?: string;
  validation?: { pattern?: string; min?: number; max?: number; message?: string };
}

export interface FormBlock extends BaseBlock {
  type: 'form';
  formId: string;
  fields: FormField[];
  submitLabel: string;
  cancelLabel?: string;
}

export interface CriteriaItem {
  id: string;
  description: string;
  category: string;
  measurable: boolean;
  source: 'owasp' | 'llm_suggested' | 'user_defined' | 'similar_job';
  preselected: boolean;
}

export interface CriteriaBlock extends BaseBlock {
  type: 'criteria';
  criteria: CriteriaItem[];
  allowCustom: boolean;
}

export interface TagsBlock extends BaseBlock {
  type: 'tags';
  suggested: string[];
  selected: string[];
  allowCustom: boolean;
}

export interface ActionItem {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'destructive' | 'outline';
  toolCall?: string;
  toolArgs?: Record<string, unknown>;
  confirmMessage?: string;
}

export interface ActionBlock extends BaseBlock {
  type: 'action';
  actions: ActionItem[];
  layout: 'horizontal' | 'vertical';
}

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  detail?: string;
}

export interface ProgressBlock extends BaseBlock {
  type: 'progress';
  steps: ProgressStep[];
  currentStep: string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  flex?: number;
}

export interface TableBlock extends BaseBlock {
  type: 'table';
  columns: TableColumn[];
  rows: Record<string, string | number>[];
  sortable?: boolean;
}

export interface FindingItem {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  category: string;
  description: string;
  codeRef?: {
    file: string;
    startLine: number;
    endLine: number;
    code: string;
  };
  recommendation: string;
  status: 'confirmed' | 'disputed' | 'acknowledged' | 'false_positive';
}

export interface FindingsBlock extends BaseBlock {
  type: 'findings';
  findings: FindingItem[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
  };
}

export interface ChartBlock extends BaseBlock {
  type: 'chart';
  chartType: 'severity_distribution' | 'score_breakdown' | 'timeline';
  data: Record<string, number>;
  title: string;
}

export interface DiffBlock extends BaseBlock {
  type: 'diff';
  language: string;
  before: string;
  after: string;
  filename?: string;
}

export interface TransactionBlock extends BaseBlock {
  type: 'transaction';
  transaction: { to: string; data: string; value: string; chainId: number };
  title?: string;
  budget?: number;
  criteriaCount?: number;
}

export interface LinkBlock extends BaseBlock {
  type: 'link';
  label: string;
  url: string;
  icon?: string;
}

export type GenUIBlock =
  | TextBlock | CodeBlock | CardBlock | FormBlock | CriteriaBlock
  | TagsBlock | ActionBlock | ProgressBlock | TableBlock
  | FindingsBlock | ChartBlock | DiffBlock | TransactionBlock | LinkBlock;

// ── Session Phases ────────────────────────────────────────

export type SessionPhase =
  | 'greeting'
  | 'clarification'
  | 'analysis'
  | 'criteria_selection'
  | 'posting'
  | 'awaiting_bids'
  | 'bid_selection'
  | 'execution'
  | 'delivery_review'
  | 'validation'
  | 'completed'
  | 'status_inquiry';

// ── Chat Message ──────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'butler';
  blocks: GenUIBlock[];
  timestamp: string;
  metadata?: {
    toolCalls?: string[];
    sessionPhase?: SessionPhase;
  };
}

// ── Conversation Session ──────────────────────────────────

export interface SessionContext {
  contractAddress?: string;
  chain?: string;
  contractSource?: string;
  jobType?: 'audit' | 'code_review' | 'data_engineering' | 'nlp_content' | 'ml_ai' | 'frontend_ux' | 'infrastructure';
  slots?: JobSlots;
  selectedCriteria?: string[];
  jobId?: string;
  chainJobId?: number;
  acceptedBidId?: string;
  bids?: Record<string, unknown>[];
  lastJobsQuery?: Record<string, unknown>[];
  currentJobId?: string;
  deliveryProofHash?: string;
  validationReport?: Record<string, unknown>;
  paymentTxHash?: string;
  description?: string;
  budget?: string;
  deadline?: string;
  complexity?: string;
}

export interface ConversationSession {
  sessionId: string;
  walletAddress: string;
  phase: SessionPhase;
  context: SessionContext;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ── API Request / Response ────────────────────────────────

export interface ChatRequest {
  sessionId?: string;
  walletAddress: string;
  message: string;
  formResponse?: {
    formId: string;
    values: Record<string, string>;
  };
  actionResponse?: {
    actionId: string;
    toolCall?: string;
    toolArgs?: Record<string, unknown>;
  };
  criteriaResponse?: {
    selectedIds: string[];
    customCriteria?: string[];
  };
  tagsResponse?: {
    selectedTags: string[];
  };
}

export interface ChatResponse {
  sessionId: string;
  message: ChatMessage;
  phase: SessionPhase;
}

// ── SSE Events ────────────────────────────────────────────

export type ChatSSEEvent =
  | { type: 'block_start'; blockId: string; blockType: GenUIBlockType }
  | { type: 'block_delta'; blockId: string; delta: string }
  | { type: 'block_complete'; blockId: string; block: GenUIBlock }
  | { type: 'phase_change'; phase: SessionPhase }
  | { type: 'progress_update'; blockId: string; stepId: string; status: string; detail?: string }
  | { type: 'done'; messageId: string }
  | { type: 'error'; message: string; code: string };
