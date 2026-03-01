import {
  getCriteriaForJobType,
  type CriteriaCategory,
} from '../../validator/owasp-criteria';
import { pickN, randomInt } from '../utils';

/**
 * Pick 3-8 criteria for a job based on its category/jobType.
 */
export function pickCriteriaForJob(
  jobType: string,
  subtypes?: string[],
): CriteriaCategory[] {
  const allCriteria = getCriteriaForJobType(jobType, subtypes);
  if (allCriteria.length === 0) return [];
  const count = randomInt(3, Math.min(8, allCriteria.length));
  return pickN(allCriteria, count);
}

/**
 * Convert picked criteria to the SuccessCriterion format used in Qdrant payloads.
 */
export function criteriaToSuccessCriteria(
  criteria: CriteriaCategory[],
): { id: string; description: string; measurable: boolean; source: string }[] {
  return criteria.map((c) => ({
    id: c.id,
    description: c.criterionDescription,
    measurable: true,
    source: 'llm_suggested',
  }));
}
