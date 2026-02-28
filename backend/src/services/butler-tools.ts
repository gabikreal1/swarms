import { CriteriaCategory, getCriteriaForJobType } from '../validator/owasp-criteria';

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

export function executeButlerTool(
  toolName: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
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
      return {
        success: true,
        jobId: Date.now(),
        title: args.title,
        category: args.category,
        status: 'POSTED',
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
