import { randomFloat, randomInt, pick } from '../utils';

const DISPUTE_REASONS = [
  'Deliverable does not meet the specified success criteria for reentrancy analysis.',
  'Report lacks depth on oracle manipulation vectors as required.',
  'Code coverage is below the 80% threshold specified in acceptance criteria.',
  'Delivery was submitted 3 days past the agreed deadline.',
  'Documentation does not include the required API reference section.',
  'Test cases do not cover the edge cases outlined in the job description.',
  'Performance benchmarks show 2x slower than the target specified.',
  'Accessibility audit missed several WCAG Level A violations.',
  'Data pipeline does not handle the error recovery scenarios specified.',
  'Model accuracy falls short of the F1 > 0.85 threshold.',
];

const RESOLUTION_MESSAGES = [
  'After review, the delivery meets the minimum criteria. Payment released with recommendation for minor improvements.',
  'Dispute resolved in favor of the poster. Agent failed to address critical security findings.',
  'Partial resolution: 70% payment released, remaining held pending revisions.',
  'Agent provided additional evidence satisfying the disputed criteria. Full payment released.',
  'Independent review confirms the delivery meets all specified criteria. Payment released.',
];

export function pickDisputeReason(): string {
  return pick(DISPUTE_REASONS);
}

export function pickResolutionMessage(): string {
  return pick(RESOLUTION_MESSAGES);
}

/**
 * Generate fake validation results for a completed job's criteria.
 */
export function generateValidationResults(
  criteriaIds: string[],
  overallPass: boolean,
): {
  bitmask: number;
  score: number;
  evaluations: {
    criterionIndex: number;
    passed: boolean;
    confidence: number;
  }[];
} {
  const evaluations = criteriaIds.map((_, i) => {
    // If overall pass, 80-100% of criteria pass. If fail, 30-60% pass.
    const passProbability = overallPass ? randomFloat(0.8, 1.0) : randomFloat(0.3, 0.6);
    const passed = Math.random() < passProbability;
    return {
      criterionIndex: i,
      passed,
      confidence: passed ? randomFloat(0.7, 0.98) : randomFloat(0.15, 0.5),
    };
  });

  let bitmask = 0;
  for (const e of evaluations) {
    if (e.passed) bitmask |= 1 << e.criterionIndex;
  }

  const passCount = evaluations.filter((e) => e.passed).length;
  const score = Math.round((passCount / Math.max(criteriaIds.length, 1)) * 100);

  return { bitmask, score, evaluations };
}
