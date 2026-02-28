// Toggle mock mode: set to false to use real backend + wallet
export const USE_MOCKS = true;

// Simulated latency range (ms) — makes UI feel realistic
export const MOCK_DELAY = { min: 300, max: 800 };

export function mockDelay(): Promise<void> {
  const ms = MOCK_DELAY.min + Math.random() * (MOCK_DELAY.max - MOCK_DELAY.min);
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Wallet ──────────────────────────────────────────────

export const MOCK_WALLET = {
  address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  isConnected: true,
};

// ─── Jobs ────────────────────────────────────────────────

export const MOCK_JOBS = [
  {
    id: 1,
    title: 'Audit ERC-20 token smart contract',
    description:
      'Need an AI agent to perform a comprehensive security audit of our ERC-20 token contract. Should check for reentrancy, overflow, and access control vulnerabilities. Deliver a PDF report with severity ratings.',
    status: 'OPEN',
    budget: '200',
    deadline: '2026-03-15T00:00:00Z',
    category: 'Security',
    tags: ['smart-contract', 'audit', 'erc-20'],
    bidCount: 3,
    criteria: [
      { id: 'c1', description: 'Identify all critical and high severity vulnerabilities', measurable: true, source: 'llm_suggested' as const },
      { id: 'c2', description: 'Deliver PDF report within 48 hours', measurable: true, source: 'similar_job' as const },
      { id: 'c3', description: 'Include remediation suggestions for each finding', measurable: false, source: 'llm_suggested' as const },
    ],
    bids: [
      { id: 101, agentName: 'AuditBot-v3', price: '180', deliveryTime: '36h', reputationScore: 0.94, criteriaBitmask: [0, 1, 2] },
      { id: 102, agentName: 'SecureAgent', price: '210', deliveryTime: '24h', reputationScore: 0.87, criteriaBitmask: [0, 2] },
      { id: 103, agentName: 'ChainGuard', price: '195', deliveryTime: '48h', reputationScore: 0.91, criteriaBitmask: [0, 1, 2] },
    ],
  },
  {
    id: 2,
    title: 'Build data pipeline for on-chain analytics',
    description:
      'Create an automated data pipeline that indexes events from our marketplace contract, computes daily aggregate stats (volume, unique users, avg job price), and stores them in a queryable format.',
    status: 'IN_PROGRESS',
    budget: '500',
    deadline: '2026-03-20T00:00:00Z',
    category: 'Data',
    tags: ['analytics', 'pipeline', 'indexing'],
    bidCount: 1,
    criteria: [
      { id: 'c4', description: 'Index all marketplace contract events within 2 blocks', measurable: true, source: 'user_defined' as const },
      { id: 'c5', description: 'Compute daily stats: volume, users, avg price', measurable: true, source: 'llm_suggested' as const },
    ],
    bids: [],
  },
  {
    id: 3,
    title: 'Generate sentiment report from 500 reviews',
    description:
      'Analyze 500 customer reviews from our product page. Classify each as positive/negative/neutral, extract key themes, and produce a dashboard-ready JSON summary with actionable insights.',
    status: 'DELIVERED',
    budget: '150',
    deadline: '2026-03-10T00:00:00Z',
    category: 'NLP',
    tags: ['sentiment', 'nlp', 'reviews'],
    bidCount: 2,
    criteria: [
      { id: 'c6', description: 'Classify all 500 reviews with >90% accuracy', measurable: true, source: 'similar_job' as const },
      { id: 'c7', description: 'Extract at least 5 key themes', measurable: true, source: 'llm_suggested' as const },
    ],
    bids: [],
    delivery: {
      proofHash: '0xabc123def456789012345678901234567890abcdef1234567890abcdef123456',
      evidenceUri: 'ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco',
      validationStatus: 'passed',
    },
  },
  {
    id: 4,
    title: 'Optimize gas usage for NFT minting contract',
    description:
      'Review and refactor our NFT minting contract to reduce gas costs. Target at least 30% reduction in mint transaction gas. Provide before/after gas benchmarks.',
    status: 'VALIDATING',
    budget: '300',
    deadline: '2026-03-25T00:00:00Z',
    category: 'Optimization',
    tags: ['gas', 'nft', 'optimization'],
    bidCount: 1,
    criteria: [
      { id: 'c8', description: 'Reduce mint gas cost by at least 30%', measurable: true, source: 'user_defined' as const },
      { id: 'c9', description: 'All existing tests still pass', measurable: true, source: 'llm_suggested' as const },
    ],
    bids: [],
    delivery: {
      proofHash: '0xdef789abc012345678901234567890123456789012345678901234567890def0',
      evidenceUri: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      validationStatus: 'pending',
    },
  },
  {
    id: 5,
    title: 'Deploy subgraph for marketplace events',
    description: 'Create and deploy a subgraph that indexes JobPosted, BidPlaced, and JobCompleted events from our marketplace contract on ARC testnet.',
    status: 'COMPLETED',
    budget: '120',
    deadline: '2026-02-28T00:00:00Z',
    category: 'Infrastructure',
    tags: ['subgraph', 'indexing', 'thegraph'],
    bidCount: 2,
    criteria: [
      { id: 'c10', description: 'Index all three event types correctly', measurable: true, source: 'user_defined' as const },
    ],
    bids: [],
  },
];

// ─── Analysis (PostJob screen) ───────────────────────────

export const MOCK_ANALYSIS = {
  sessionId: 'mock-session-001',
  completeness: 72,
  slots: {
    task: 'Smart contract audit',
    budget: '200 USDC',
    deadline: '2 weeks',
    scope: 'ERC-20 token contract',
  },
  missingSlots: [
    { key: 'contract_address', question: 'What is the contract address to audit?' },
    { key: 'chain', question: 'Which blockchain is the contract deployed on?' },
  ],
  suggestedTags: ['smart-contract', 'audit', 'security'],
  criteria: [
    { id: 'mc1', description: 'Identify all critical and high severity vulnerabilities', measurable: true, source: 'llm_suggested' as const },
    { id: 'mc2', description: 'Deliver report within specified deadline', measurable: true, source: 'similar_job' as const },
    { id: 'mc3', description: 'Include gas optimization recommendations', measurable: false, source: 'llm_suggested' as const },
    { id: 'mc4', description: 'Verify no funds can be drained by external actors', measurable: true, source: 'similar_job' as const },
  ],
  similarJobs: [
    { id: 901, title: 'ERC-721 Contract Security Audit', budget: '250', matchScore: 0.89 },
    { id: 902, title: 'DeFi Protocol Audit', budget: '400', matchScore: 0.76 },
    { id: 903, title: 'Token Contract Review', budget: '150', matchScore: 0.71 },
  ],
};

// ─── Tag suggestions ─────────────────────────────────────

export const MOCK_TAG_SUGGESTIONS = [
  { tag: 'smart-contract', categoryPath: 'Development > Blockchain' },
  { tag: 'security', categoryPath: 'Development > Security' },
  { tag: 'audit', categoryPath: 'Services > Audit' },
  { tag: 'solidity', categoryPath: 'Development > Languages' },
  { tag: 'erc-20', categoryPath: 'Development > Standards' },
  { tag: 'defi', categoryPath: 'Finance > DeFi' },
  { tag: 'nft', categoryPath: 'Development > NFT' },
  { tag: 'gas-optimization', categoryPath: 'Development > Performance' },
  { tag: 'analytics', categoryPath: 'Data > Analytics' },
  { tag: 'nlp', categoryPath: 'AI > NLP' },
];

// ─── Chat messages ───────────────────────────────────────

export const MOCK_CHAT_MESSAGES = [
  { id: 'agent-1', role: 'agent' as const, text: 'Hello! I\'ve been assigned to your job. I\'ve reviewed the requirements and I\'m ready to begin the audit.', timestamp: Date.now() - 3600000 },
  { id: 'user-1', role: 'user' as const, text: 'Great! The contract is deployed on ARC testnet. Can you start with the access control checks?', timestamp: Date.now() - 3500000 },
  { id: 'agent-2', role: 'agent' as const, text: 'Absolutely. I\'ll start with access control patterns, then move to reentrancy and overflow checks. I\'ll share preliminary findings within the next few hours.', timestamp: Date.now() - 3400000 },
  { id: 'user-2', role: 'user' as const, text: 'Sounds good. Also please check the approve/transferFrom flow carefully.', timestamp: Date.now() - 1800000 },
  { id: 'agent-3', role: 'agent' as const, text: 'Noted. I\'ve completed the initial static analysis. Found 2 medium-severity issues in the approval flow:\n\n1. Missing zero-address check in approve()\n2. No event emission on allowance change\n\nI\'m now running the dynamic analysis suite.', timestamp: Date.now() - 900000 },
];

// ─── Notifications ───────────────────────────────────────

export const MOCK_NOTIFICATIONS = [
  {
    type: 'info' as const,
    title: 'New Bid',
    body: 'AuditBot-v3 placed a bid on "Audit ERC-20 token"',
    jobId: '1',
  },
  {
    type: 'info' as const,
    title: 'New Bid',
    body: 'SecureAgent placed a bid on "Audit ERC-20 token"',
    jobId: '1',
  },
  {
    type: 'success' as const,
    title: 'Job Completed',
    body: '"Deploy subgraph for marketplace events" has been completed',
    jobId: '5',
  },
  {
    type: 'info' as const,
    title: 'Delivery Submitted',
    body: 'An agent submitted a delivery for "Generate sentiment report"',
    jobId: '3',
  },
  {
    type: 'success' as const,
    title: 'Validation Passed',
    body: 'Delivery for "Generate sentiment report" passed validation',
    jobId: '3',
  },
  {
    type: 'warning' as const,
    title: 'Validation Pending',
    body: 'Delivery for "Optimize gas usage" is awaiting validation',
    jobId: '4',
  },
];

// ─── Butler Chat GenUI Blocks ────────────────────────────

export const GREETING_BLOCKS = [
  {
    id: 'greeting-text',
    type: 'text' as const,
    content: 'Welcome to the SWARMS Agent Marketplace! I can help you post jobs across multiple verticals. What kind of task do you need help with?',
  },
  {
    id: 'greeting-actions',
    type: 'action' as const,
    actions: [
      { id: 'v-audit', label: 'Smart Contract Audit', variant: 'primary' as const, toolCall: 'analyze_requirements', toolArgs: { jobType: 'audit' } },
      { id: 'v-code-review', label: 'Code Review', variant: 'secondary' as const, toolCall: 'analyze_requirements', toolArgs: { jobType: 'code_review' } },
      { id: 'v-data', label: 'Data Engineering', variant: 'secondary' as const, toolCall: 'analyze_requirements', toolArgs: { jobType: 'data_engineering' } },
      { id: 'v-nlp', label: 'NLP / Content', variant: 'secondary' as const, toolCall: 'analyze_requirements', toolArgs: { jobType: 'nlp_content' } },
      { id: 'v-ml', label: 'ML / AI', variant: 'secondary' as const, toolCall: 'analyze_requirements', toolArgs: { jobType: 'ml_ai' } },
      { id: 'v-frontend', label: 'Frontend / UX', variant: 'secondary' as const, toolCall: 'analyze_requirements', toolArgs: { jobType: 'frontend_ux' } },
      { id: 'v-infra', label: 'Infrastructure / DevOps', variant: 'secondary' as const, toolCall: 'analyze_requirements', toolArgs: { jobType: 'infrastructure' } },
    ],
    layout: 'vertical' as const,
  },
];

export const CLARIFICATION_BLOCKS = [
  {
    id: 'clarify-text',
    type: 'text' as const,
    content: 'Great! Let me gather some details about your job. Please fill in what you can:',
  },
  {
    id: 'clarify-form',
    type: 'form' as const,
    formId: 'job-details',
    fields: [
      {
        name: 'jobType',
        label: 'Job Type',
        type: 'select' as const,
        required: true,
        options: [
          { label: 'Smart Contract Audit', value: 'audit' },
          { label: 'Code Review', value: 'code_review' },
          { label: 'Data Engineering', value: 'data_engineering' },
          { label: 'NLP / Content', value: 'nlp_content' },
          { label: 'ML / AI', value: 'ml_ai' },
          { label: 'Frontend / UX', value: 'frontend_ux' },
          { label: 'Infrastructure / DevOps', value: 'infrastructure' },
        ],
      },
      {
        name: 'description',
        label: 'Job Description',
        type: 'textarea' as const,
        placeholder: 'Describe what you need done...',
        required: true,
      },
      {
        name: 'budget',
        label: 'Budget (USDC)',
        type: 'number' as const,
        placeholder: '100',
        validation: { min: 1 },
      },
      {
        name: 'deadline',
        label: 'Deadline',
        type: 'text' as const,
        placeholder: 'e.g., 2 weeks, March 15',
      },
    ],
    submitLabel: 'Analyze Job',
    cancelLabel: 'Cancel',
  },
];

export const ANALYSIS_BLOCKS = [
  {
    id: 'analysis-text',
    type: 'text' as const,
    content: 'Here\'s my analysis of your job requirements:',
  },
  {
    id: 'analysis-table',
    type: 'table' as const,
    columns: [
      { key: 'field', label: 'Category', align: 'left' as const },
      { key: 'value', label: 'Detail', align: 'left' as const },
      { key: 'status', label: 'Status', align: 'center' as const },
    ],
    rows: [
      { field: 'Job Type', value: 'Data Engineering', status: 'Detected' },
      { field: 'Complexity', value: 'Moderate', status: 'Inferred' },
      { field: 'Estimated Cost', value: '15 USDC', status: 'Estimated' },
      { field: 'Suggested Criteria', value: '8 criteria available', status: 'Ready' },
      { field: 'Suggested Tags', value: 'data, pipeline, etl', status: 'Suggested' },
    ],
    sortable: false,
  },
];
