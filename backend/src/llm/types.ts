export type LLMTask = 'slot_extraction' | 'completeness_assessment' | 'criteria_suggestion';

export interface SlotExtractionResult {
  slots: import('../types/job-slots').JobSlots;
  rawInterpretation: string;
}

export interface CompletenessAssessment {
  score: number; // 0-100
  missingSlots: {
    slot: import('../types/job-slots').SlotName;
    importance: 'required' | 'recommended' | 'optional';
    question: string;
  }[];
  clarifyingQuestions: string[];
}

export interface CriteriaSuggestion {
  criteria: import('../types/job-slots').SuccessCriterion[];
  reasoning: string;
}

export interface LLMProvider {
  extractSlots(query: string): Promise<SlotExtractionResult>;
  assessCompleteness(slots: import('../types/job-slots').JobSlots): Promise<CompletenessAssessment>;
  suggestCriteria(
    slots: import('../types/job-slots').JobSlots,
    similarJobs: import('../types/job-slots').SimilarJob[]
  ): Promise<CriteriaSuggestion>;
}
