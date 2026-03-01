import type { ChatCompletionTool } from 'openai/resources/chat/completions';

export type ButlerToolName =
  | 'analyze_requirements'
  | 'estimate_cost'
  | 'get_job_criteria'
  | 'post_job'
  | 'get_my_jobs'
  | 'get_job_bids'
  | 'accept_bid'
  | 'get_delivery_status'
  | 'approve_delivery';

export const BUTLER_TOOL_SCHEMAS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'analyze_requirements',
      description: 'Infer job type, complexity, tags, and cost estimate from a natural-language job description.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'The user-provided job description to analyze.',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimate_cost',
      description: 'Compute a deterministic cost estimate for a job based on its vertical, complexity, and optional lines of code.',
      parameters: {
        type: 'object',
        properties: {
          jobType: {
            type: 'string',
            description: 'The job vertical.',
            enum: ['audit', 'code_review', 'data_engineering', 'nlp_content', 'ml_ai', 'frontend_ux', 'infrastructure'],
          },
          complexity: {
            type: 'string',
            description: 'Estimated complexity level.',
            enum: ['simple', 'moderate', 'complex'],
          },
          linesOfCode: {
            type: 'number',
            description: 'Estimated lines of code, if applicable.',
          },
        },
        required: ['jobType', 'complexity'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_job_criteria',
      description: 'Fetch success criteria for a given job vertical. Returns criteria items the user can select or customize.',
      parameters: {
        type: 'object',
        properties: {
          jobType: {
            type: 'string',
            description: 'The job vertical to fetch criteria for.',
            enum: ['audit', 'code_review', 'data_engineering', 'nlp_content', 'ml_ai', 'frontend_ux', 'infrastructure'],
          },
          subtypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional subtypes for more specific criteria (e.g., defi, governance for audit).',
          },
        },
        required: ['jobType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'post_job',
      description: 'Finalize a job posting and encode the on-chain transaction calldata. Only call after confirming all details with the user.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Job title.',
          },
          description: {
            type: 'string',
            description: 'Full job description.',
          },
          budget: {
            type: 'number',
            description: 'Budget in USDC.',
          },
          deadline: {
            type: 'string',
            description: 'Deadline as an ISO-8601 date string.',
          },
          criteria: {
            type: 'array',
            items: { type: 'string' },
            description: 'Selected criteria IDs.',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Job tags for discovery.',
          },
          category: {
            type: 'string',
            description: 'Job category / vertical.',
          },
        },
        required: ['title', 'description', 'budget', 'deadline', 'criteria', 'tags', 'category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_my_jobs',
      description: 'Query the current user\'s jobs, optionally filtered by status.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by job status.',
            enum: ['open', 'in_progress', 'delivered', 'completed', 'disputed'],
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_job_bids',
      description: 'Retrieve all bids on a specific job.',
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The ID of the job to fetch bids for.',
          },
        },
        required: ['jobId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'accept_bid',
      description: 'Accept a bid on a job, encoding the on-chain transaction to assign the agent.',
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The ID of the job.',
          },
          bidId: {
            type: 'string',
            description: 'The ID of the bid to accept.',
          },
        },
        required: ['jobId', 'bidId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_delivery_status',
      description: 'Check the delivery status of a job, including proof hash and timestamps.',
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The ID of the job to check.',
          },
        },
        required: ['jobId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'approve_delivery',
      description: 'Approve a delivery and encode the on-chain release-escrow transaction.',
      parameters: {
        type: 'object',
        properties: {
          jobId: {
            type: 'string',
            description: 'The ID of the job to approve delivery for.',
          },
        },
        required: ['jobId'],
      },
    },
  },
];
