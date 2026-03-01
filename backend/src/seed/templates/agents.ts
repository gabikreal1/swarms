export interface AgentTemplate {
  name: string;
  capabilities: string[];
  category: string;
  description: string;
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  // Smart Contract Audit
  {
    name: 'AuditBot-Alpha',
    capabilities: ['audit', 'solidity', 'evm', 'security', 'formal-verification'],
    category: 'Smart Contract Audit',
    description: 'Specialized in EVM smart contract security audits with formal verification tooling.',
  },
  {
    name: 'SlitherScan',
    capabilities: ['audit', 'solidity', 'security', 'slither', 'mythril'],
    category: 'Smart Contract Audit',
    description: 'Automated security scanner combining Slither, Mythril, and manual review.',
  },
  {
    name: 'CertiBot',
    capabilities: ['audit', 'solidity', 'evm', 'security', 'gas-optimization'],
    category: 'Smart Contract Audit',
    description: 'Security-first auditor with gas optimization recommendations.',
  },

  // DeFi
  {
    name: 'DeFiGuard',
    capabilities: ['defi', 'amm', 'lending', 'security', 'audit'],
    category: 'DeFi',
    description: 'DeFi protocol specialist covering AMMs, lending, and yield aggregators.',
  },
  {
    name: 'FlashLoanDetector',
    capabilities: ['defi', 'flash-loans', 'oracle', 'security'],
    category: 'DeFi',
    description: 'Expert in flash loan attack vector analysis and oracle manipulation detection.',
  },

  // Code Review
  {
    name: 'CodeReviewer-v3',
    capabilities: ['code-review', 'python', 'node', 'testing', 'solid-principles'],
    category: 'Code Review',
    description: 'Full-stack code reviewer with expertise in Python and Node.js ecosystems.',
  },
  {
    name: 'QualityGate',
    capabilities: ['code-review', 'testing', 'ci-cd', 'documentation'],
    category: 'Code Review',
    description: 'Enforces coding standards, test coverage, and documentation quality.',
  },
  {
    name: 'RustAnalyzer',
    capabilities: ['code-review', 'rust', 'systems', 'performance'],
    category: 'Code Review',
    description: 'Systems programming specialist for Rust and performance-critical code.',
  },

  // Data Engineering
  {
    name: 'PipelineBot',
    capabilities: ['etl', 'data-pipeline', 'sql', 'spark', 'airflow'],
    category: 'Data Engineering',
    description: 'Builds and reviews data pipelines using Spark, Airflow, and SQL.',
  },
  {
    name: 'DataQualityAgent',
    capabilities: ['data-pipeline', 'sql', 'analytics', 'data-quality'],
    category: 'Data Engineering',
    description: 'Ensures data quality, schema validation, and pipeline reliability.',
  },

  // NLP/Content
  {
    name: 'NLPCrafter',
    capabilities: ['nlp', 'sentiment', 'text-generation', 'summarization'],
    category: 'NLP/Content',
    description: 'NLP specialist for sentiment analysis, summarization, and content generation.',
  },
  {
    name: 'FactChecker',
    capabilities: ['nlp', 'text-generation', 'fact-checking', 'bias-detection'],
    category: 'NLP/Content',
    description: 'Verifies factual accuracy and detects bias in generated content.',
  },

  // ML/AI
  {
    name: 'MLTrainer-Pro',
    capabilities: ['pytorch', 'ml', 'deep-learning', 'computer-vision'],
    category: 'ML/AI',
    description: 'Trains and evaluates deep learning models with PyTorch and TensorFlow.',
  },
  {
    name: 'FairnessAuditor',
    capabilities: ['ml', 'fairness', 'explainability', 'bias-detection'],
    category: 'ML/AI',
    description: 'Audits ML models for fairness, bias, and explainability compliance.',
  },

  // Frontend/UX
  {
    name: 'ReactBuilder',
    capabilities: ['react', 'nextjs', 'accessibility', 'responsive-design'],
    category: 'Frontend/UX',
    description: 'Builds accessible, responsive React and Next.js applications.',
  },
  {
    name: 'A11yChecker',
    capabilities: ['accessibility', 'react', 'wcag', 'screen-reader'],
    category: 'Frontend/UX',
    description: 'WCAG 2.1 AA compliance specialist for web accessibility audits.',
  },
  {
    name: 'PerformanceBot',
    capabilities: ['react', 'nextjs', 'performance', 'lighthouse'],
    category: 'Frontend/UX',
    description: 'Optimizes frontend performance and Core Web Vitals scores.',
  },

  // Infrastructure
  {
    name: 'DevOpsAgent',
    capabilities: ['docker', 'kubernetes', 'ci-cd', 'terraform'],
    category: 'Infrastructure',
    description: 'Manages containerized deployments, CI/CD pipelines, and infrastructure as code.',
  },
  {
    name: 'CloudArchitect',
    capabilities: ['kubernetes', 'aws', 'monitoring', 'auto-scaling'],
    category: 'Infrastructure',
    description: 'Designs scalable cloud architectures with monitoring and auto-scaling.',
  },
  {
    name: 'SecurityHardener',
    capabilities: ['security', 'docker', 'kubernetes', 'ci-cd'],
    category: 'Infrastructure',
    description: 'Hardens infrastructure security, network segmentation, and secrets management.',
  },
];
