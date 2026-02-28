// Slot provenance tracking
export type SlotProvenance = 'user_explicit' | 'llm_inferred' | 'similar_job' | 'default' | 'empty';

export interface SlotValue<T> {
  value: T | null;
  provenance: SlotProvenance;
  confidence: number; // 0-1
}

// Slot weights for completeness scoring
export const SLOT_WEIGHTS = {
  // Required
  taskDescription: 0.30,
  deliverableType: 0.15,
  scope: 0.10,
  // Recommended
  deadline: 0.10,
  budget: 0.15,
  acceptanceCriteria: 0.10,
  // Optional
  requiredCapabilities: 0.05,
  preferredAgentReputation: 0.02,
  context: 0.02,
  exampleOutputs: 0.01,
} as const;

export type SlotName = keyof typeof SLOT_WEIGHTS;

export interface JobSlots {
  // Required
  taskDescription: SlotValue<string>;
  deliverableType: SlotValue<string>;
  scope: SlotValue<{ estimatedHours?: number; complexity?: 'simple' | 'moderate' | 'complex' }>;
  // Recommended
  deadline: SlotValue<string>; // ISO date
  budget: SlotValue<{ amount: number; currency: string }>;
  acceptanceCriteria: SlotValue<string[]>;
  // Optional
  requiredCapabilities: SlotValue<string[]>;
  preferredAgentReputation: SlotValue<number>;
  context: SlotValue<string>;
  exampleOutputs: SlotValue<string[]>;
}

export interface SuccessCriterion {
  id: string;
  description: string;
  measurable: boolean;
  source: 'similar_job' | 'llm_suggested' | 'user_defined';
  accepted: boolean;
}

export interface JobMetadataDocument {
  version: '1.0';
  title: string;
  description: string;
  deliverableType: string;
  scope: { estimatedHours?: number; complexity?: string };
  deadline?: string;
  budget?: { amount: number; currency: string };
  tags: string[];
  category: string;
  acceptanceCriteria: string[];
  successCriteria: SuccessCriterion[];
  context?: string;
  exampleOutputs?: string[];
  requiredCapabilities?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OnChainJobFields {
  description: string;
  metadataURI: string;
  tags: string[];
  deadline: number; // unix timestamp
  // For criteria-aware jobs
  criteriaHash?: string;  // bytes32
  criteriaCount?: number;
  allRequired?: boolean;
  passingScore?: number;
}

export interface AnalyzeRequest {
  query: string;
  sessionId?: string;
  walletAddress?: string;
}

export interface AnalyzeResponse {
  sessionId: string;
  slots: JobSlots;
  completenessScore: number;
  missingSlots: { slot: SlotName; importance: 'required' | 'recommended' | 'optional'; question: string }[];
  suggestedCriteria: SuccessCriterion[];
  similarJobs: SimilarJob[];
  clarifyingQuestions: string[];
}

export interface SimilarJob {
  title: string;
  description: string;
  tags: string[];
  budget?: number;
  successCriteria: SuccessCriterion[];
  completionTime?: number;
  score: number; // similarity score
}

export interface FinalizeRequest {
  sessionId: string;
  slots: JobSlots;
  acceptedCriteria: SuccessCriterion[];
  walletAddress: string;
  tags: string[];
  category: string;
}

export interface FinalizeResponse {
  metadataURI: string;
  metadataDocument: JobMetadataDocument;
  transaction: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  };
  useCriteria: boolean;
}
