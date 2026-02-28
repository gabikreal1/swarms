export interface CriteriaCategory {
  id: string;
  name: string;
  description: string;
  criterionDescription: string;
  slitherDetectors: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  applicableTo: ('erc20' | 'erc721' | 'defi' | 'governance' | 'all')[];
}

/** @deprecated Use CriteriaCategory instead */
export type OwaspCategory = CriteriaCategory;

export const OWASP_SMART_CONTRACT_TOP_10: OwaspCategory[] = [
  {
    id: 'SWC-107',
    name: 'Reentrancy',
    description: 'Functions that make external calls before updating state, allowing recursive callbacks to drain funds.',
    criterionDescription: 'All reentrancy vulnerabilities identified and documented, including cross-function and cross-contract reentrancy vectors.',
    slitherDetectors: ['reentrancy-eth', 'reentrancy-no-eth', 'reentrancy-benign', 'reentrancy-events'],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-101',
    name: 'Integer Overflow and Underflow',
    description: 'Arithmetic operations that wrap around on overflow/underflow, potentially causing unexpected behavior.',
    criterionDescription: 'All arithmetic operations checked for overflow/underflow vulnerabilities. Contracts using Solidity <0.8.0 verified for SafeMath usage.',
    slitherDetectors: ['divide-before-multiply'],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-104',
    name: 'Unchecked Call Return Value',
    description: 'External calls whose return values are not checked, potentially silently failing.',
    criterionDescription: 'All external calls (low-level call, send, delegatecall) verified to check return values, with appropriate error handling.',
    slitherDetectors: ['unchecked-lowlevel', 'unchecked-send'],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-105',
    name: 'Unprotected Ether Withdrawal',
    description: 'Functions that can send ETH/tokens to arbitrary addresses without proper access control.',
    criterionDescription: 'All functions involving value transfer verified to have proper access control. No unauthorized withdrawal paths exist.',
    slitherDetectors: ['arbitrary-send', 'arbitrary-send-erc20', 'arbitrary-send-erc20-permit'],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-106',
    name: 'Unprotected SELFDESTRUCT',
    description: 'Contract self-destruction accessible by unauthorized parties.',
    criterionDescription: 'No unprotected selfdestruct/suicide calls. If selfdestruct exists, proper multi-sig or timelock protection verified.',
    slitherDetectors: ['suicidal'],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-112',
    name: 'Delegatecall to Untrusted Callee',
    description: 'Using delegatecall with a user-controlled or upgradeable target can lead to complete contract takeover.',
    criterionDescription: 'All delegatecall usage verified to use trusted, immutable targets. Proxy patterns analyzed for upgrade safety.',
    slitherDetectors: ['controlled-delegatecall', 'delegatecall-loop'],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-115',
    name: 'Authorization through tx.origin',
    description: 'Using tx.origin for authentication allows phishing attacks through intermediate contracts.',
    criterionDescription: 'No usage of tx.origin for authorization. All access control uses msg.sender or proper signature verification.',
    slitherDetectors: ['tx-origin'],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-119',
    name: 'Shadowing State Variables',
    description: 'State variables in derived contracts that shadow base contract variables, leading to confusion and bugs.',
    criterionDescription: 'No shadowed state variables in inheritance chain. All variable names are unique across the contract hierarchy.',
    slitherDetectors: ['shadowing-state', 'shadowing-local', 'shadowing-abstract'],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-109',
    name: 'Uninitialized Storage Pointer',
    description: 'Uninitialized storage variables pointing to unexpected storage slots, potentially corrupting state.',
    criterionDescription: 'All storage variables properly initialized. No uninitialized structs or arrays used in storage context.',
    slitherDetectors: ['uninitialized-state', 'uninitialized-storage', 'uninitialized-local'],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'SWC-116',
    name: 'Block Values as Proxy for Time',
    description: 'Using block.timestamp or block.number for critical logic that can be manipulated by miners.',
    criterionDescription: 'No critical logic (locking, vesting, randomness) relies on block.timestamp or block.number without tolerance thresholds.',
    slitherDetectors: ['timestamp'],
    severity: 'medium',
    applicableTo: ['defi', 'governance'],
  },
];

export const DEFI_COMPLIANCE_CRITERIA: OwaspCategory[] = [
  {
    id: 'DEFI-001',
    name: 'Sanctions Screening',
    description: 'Addresses interacting with the protocol checked against OFAC SDN list and other sanctions lists.',
    criterionDescription: 'Protocol implements or can integrate with on-chain sanctions checking. All deposit/withdrawal paths are screened.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['defi'],
  },
  {
    id: 'DEFI-002',
    name: 'Oracle Manipulation',
    description: 'Price feeds can be manipulated via flash loans or low-liquidity attacks.',
    criterionDescription: 'All price oracle dependencies identified. TWAP, Chainlink, or multi-source oracles used. Flash loan attack vectors analyzed.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['defi'],
  },
  {
    id: 'DEFI-003',
    name: 'Flash Loan Attack Vectors',
    description: 'Protocol logic can be exploited via single-transaction flash loan attacks.',
    criterionDescription: 'All state-changing functions analyzed for flash loan attack vectors. No single-block manipulation possible for critical operations.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['defi'],
  },
  {
    id: 'DEFI-004',
    name: 'Governance Centralization Risk',
    description: 'Admin/owner keys have excessive control over protocol funds or parameters.',
    criterionDescription: 'All admin functions catalogued with risk assessment. Timelock and multi-sig requirements documented. No single key can drain funds.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['defi', 'governance'],
  },
  {
    id: 'DEFI-005',
    name: 'Liquidity and TVL Risk',
    description: 'Protocol risk assessment based on TVL concentration, impermanent loss exposure, and liquidity depth.',
    criterionDescription: 'TVL concentration risk analyzed. Impermanent loss scenarios modeled. Liquidity withdrawal scenarios stress-tested.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['defi'],
  },
  {
    id: 'DEFI-006',
    name: 'Regulatory Compliance',
    description: 'Protocol compliance with applicable regulations (MiCA, US securities law, etc.).',
    criterionDescription: 'Token classification analyzed (utility vs security). Applicable regulatory frameworks identified. KYC/AML integration points documented.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['defi'],
  },
];

export const CODE_REVIEW_CRITERIA: CriteriaCategory[] = [
  {
    id: 'CR-001',
    name: 'SOLID Principles',
    description: 'Code adheres to Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion principles.',
    criterionDescription: 'All modules follow SOLID principles. Classes have single responsibilities. Dependencies are properly inverted and injected.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'CR-002',
    name: 'Test Coverage',
    description: 'Adequate test coverage for critical paths, edge cases, and regression scenarios.',
    criterionDescription: 'Test coverage meets minimum thresholds. Critical paths have unit and integration tests. Edge cases are covered.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'CR-003',
    name: 'Error Handling',
    description: 'Consistent and comprehensive error handling across the codebase.',
    criterionDescription: 'All error paths are handled gracefully. No unhandled promise rejections or uncaught exceptions. Error messages are descriptive.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'CR-004',
    name: 'Dependency Management',
    description: 'Dependencies are up-to-date, minimal, and free of known vulnerabilities.',
    criterionDescription: 'No known CVEs in dependencies. Lock files are committed. Unused dependencies removed. Version pinning strategy documented.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'CR-005',
    name: 'Documentation',
    description: 'Code is well-documented with clear comments, README, and API docs.',
    criterionDescription: 'Public APIs are documented. Complex logic has inline comments. README is current. Setup instructions are accurate.',
    slitherDetectors: [],
    severity: 'low',
    applicableTo: ['all'],
  },
  {
    id: 'CR-006',
    name: 'Performance',
    description: 'Code is optimized for performance without unnecessary bottlenecks.',
    criterionDescription: 'No N+1 queries. Expensive operations are cached or batched. Memory leaks are absent. Time complexity is reasonable.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'CR-007',
    name: 'Security Basics',
    description: 'Basic security practices are followed including input validation and output encoding.',
    criterionDescription: 'No SQL injection, XSS, or CSRF vulnerabilities. Secrets are not hardcoded. Input is validated at boundaries.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'CR-008',
    name: 'Maintainability',
    description: 'Code is readable, consistent, and easy to maintain over time.',
    criterionDescription: 'Consistent coding style enforced. No dead code. Functions are small and focused. Naming conventions are clear.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
];

export const DATA_ENGINEERING_CRITERIA: CriteriaCategory[] = [
  {
    id: 'DE-001',
    name: 'Schema Validation',
    description: 'Data schemas are validated at ingestion and transformation stages.',
    criterionDescription: 'All data inputs are validated against defined schemas. Schema evolution is handled gracefully. Breaking changes are detected.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'DE-002',
    name: 'Data Quality',
    description: 'Data quality checks ensure completeness, consistency, and correctness.',
    criterionDescription: 'Data quality rules are defined and enforced. Null rates, duplicates, and outliers are monitored. Quality metrics are reported.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'DE-003',
    name: 'Pipeline Reliability',
    description: 'Data pipelines are reliable with proper retry logic and failure handling.',
    criterionDescription: 'Pipelines have retry mechanisms with exponential backoff. Partial failures are recoverable. SLAs are defined and monitored.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'DE-004',
    name: 'Error Recovery',
    description: 'Pipelines can recover from errors without data loss or corruption.',
    criterionDescription: 'Dead letter queues are implemented. Failed records are logged and replayable. Recovery procedures are documented and tested.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'DE-005',
    name: 'Scalability',
    description: 'Pipelines scale to handle increasing data volumes and velocity.',
    criterionDescription: 'Horizontal scaling is supported. Partitioning strategy is defined. Backpressure is handled. Load testing results are documented.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'DE-006',
    name: 'Monitoring',
    description: 'Pipeline health and performance are monitored with alerting.',
    criterionDescription: 'Pipeline metrics are collected (throughput, latency, error rates). Alerts are configured for anomalies. Dashboards are available.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'DE-007',
    name: 'Data Freshness',
    description: 'Data is delivered within defined freshness SLAs.',
    criterionDescription: 'Freshness SLAs are defined per dataset. Staleness is monitored and alerted. End-to-end latency is tracked.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'DE-008',
    name: 'Idempotency',
    description: 'Pipeline operations are idempotent and safe to retry.',
    criterionDescription: 'All write operations are idempotent. Re-running pipelines produces the same result. Deduplication is implemented.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
];

export const NLP_CONTENT_CRITERIA: CriteriaCategory[] = [
  {
    id: 'NLP-001',
    name: 'Accuracy',
    description: 'NLP outputs are accurate and relevant to the input.',
    criterionDescription: 'Output accuracy is measured against ground truth. Precision and recall metrics meet defined thresholds.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'NLP-002',
    name: 'Bias Detection',
    description: 'Content is free from harmful biases across demographics.',
    criterionDescription: 'Outputs are tested for gender, racial, and cultural bias. Bias detection tools are integrated. Mitigation strategies are documented.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'NLP-003',
    name: 'Readability',
    description: 'Generated content meets readability standards for the target audience.',
    criterionDescription: 'Content readability scores meet target levels. Sentence complexity is appropriate. Jargon is minimized or explained.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'NLP-004',
    name: 'Factuality',
    description: 'Generated content is factually correct and verifiable.',
    criterionDescription: 'Claims are verified against reliable sources. No fabricated statistics or references. Fact-checking pipeline is implemented.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'NLP-005',
    name: 'Hallucination Detection',
    description: 'System detects and prevents hallucinated or fabricated content.',
    criterionDescription: 'Hallucination detection mechanisms are in place. Confidence scores are provided. Low-confidence outputs are flagged for review.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'NLP-006',
    name: 'Style Consistency',
    description: 'Content maintains consistent tone, voice, and style.',
    criterionDescription: 'Style guide is defined and enforced. Tone consistency is measured. Brand voice alignment is verified.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'NLP-007',
    name: 'Attribution',
    description: 'Sources and references are properly attributed.',
    criterionDescription: 'All claims include source attribution. Citation format is consistent. Source reliability is assessed.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'NLP-008',
    name: 'Language Quality',
    description: 'Content is free from grammatical errors and linguistically correct.',
    criterionDescription: 'Grammar and spelling are correct. Punctuation is consistent. Language is natural and fluent.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
];

export const ML_AI_CRITERIA: CriteriaCategory[] = [
  {
    id: 'ML-001',
    name: 'Model Accuracy',
    description: 'Model meets defined accuracy benchmarks on test data.',
    criterionDescription: 'Accuracy, F1, AUC-ROC, or other relevant metrics meet defined thresholds. Performance is validated on held-out test sets.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'ML-002',
    name: 'Reproducibility',
    description: 'Training and inference results are reproducible across environments.',
    criterionDescription: 'Random seeds are fixed. Training environment is containerized. Results are reproducible within defined tolerance.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'ML-003',
    name: 'Fairness',
    description: 'Model does not discriminate across protected groups.',
    criterionDescription: 'Fairness metrics (demographic parity, equalized odds) are computed. Disparate impact is within acceptable thresholds.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'ML-004',
    name: 'Data Leakage Prevention',
    description: 'No information leakage between training, validation, and test sets.',
    criterionDescription: 'Train/test splits are properly separated. No future data leaks into training. Feature engineering does not use target information.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'ML-005',
    name: 'Overfitting Detection',
    description: 'Model generalizes well and does not overfit to training data.',
    criterionDescription: 'Training vs validation loss curves are monitored. Regularization is applied. Cross-validation results are consistent.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'ML-006',
    name: 'Latency Requirements',
    description: 'Model inference meets latency SLAs for production use.',
    criterionDescription: 'P50, P95, P99 inference latencies are within SLA. Model is optimized for target hardware. Batch vs real-time trade-offs are documented.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'ML-007',
    name: 'Explainability',
    description: 'Model decisions can be explained and interpreted.',
    criterionDescription: 'Feature importance is computed. SHAP/LIME explanations are available for critical predictions. Decision boundaries are documented.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'ML-008',
    name: 'Model Versioning',
    description: 'Models are versioned with lineage tracking.',
    criterionDescription: 'Model artifacts are versioned. Training data lineage is tracked. Model registry is maintained with metadata.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
];

export const FRONTEND_UX_CRITERIA: CriteriaCategory[] = [
  {
    id: 'FE-001',
    name: 'WCAG Accessibility',
    description: 'UI meets WCAG 2.1 AA accessibility standards.',
    criterionDescription: 'All interactive elements are keyboard accessible. ARIA labels are present. Color contrast ratios meet AA standards. Screen reader compatible.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'FE-002',
    name: 'Lighthouse Performance',
    description: 'Page achieves target Lighthouse performance scores.',
    criterionDescription: 'Lighthouse performance score meets minimum threshold. Core Web Vitals (LCP, FID, CLS) are within good ranges.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'FE-003',
    name: 'Responsive Design',
    description: 'UI adapts correctly to all screen sizes and orientations.',
    criterionDescription: 'Layout works on mobile, tablet, and desktop. Breakpoints are tested. Touch targets are adequately sized. No horizontal scrolling.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'FE-004',
    name: 'Cross-Browser Compatibility',
    description: 'UI works consistently across supported browsers.',
    criterionDescription: 'Tested on Chrome, Firefox, Safari, and Edge. No browser-specific bugs. Polyfills are used where needed.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'FE-005',
    name: 'UX Consistency',
    description: 'Design patterns and interactions are consistent throughout the app.',
    criterionDescription: 'Component library is used consistently. Spacing, typography, and colors follow the design system. Interaction patterns are predictable.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'FE-006',
    name: 'Error States',
    description: 'All error conditions display helpful, user-friendly messages.',
    criterionDescription: 'Error messages are clear and actionable. Network errors are handled gracefully. Form validation provides inline feedback.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'FE-007',
    name: 'Loading States',
    description: 'Loading and skeleton states provide feedback during async operations.',
    criterionDescription: 'All async operations show loading indicators. Skeleton screens are used for content areas. No blank screens during data fetching.',
    slitherDetectors: [],
    severity: 'low',
    applicableTo: ['all'],
  },
  {
    id: 'FE-008',
    name: 'SEO',
    description: 'Pages are optimized for search engine indexing.',
    criterionDescription: 'Meta tags are present and accurate. Semantic HTML is used. Open Graph tags are configured. Sitemap is generated.',
    slitherDetectors: [],
    severity: 'low',
    applicableTo: ['all'],
  },
];

export const INFRASTRUCTURE_CRITERIA: CriteriaCategory[] = [
  {
    id: 'INF-001',
    name: 'Uptime SLA',
    description: 'System meets defined uptime service level agreements.',
    criterionDescription: 'Uptime target (e.g., 99.9%) is defined and monitored. Downtime incidents are tracked. Failover mechanisms are tested.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'INF-002',
    name: 'Auto-Scaling',
    description: 'Infrastructure scales automatically based on load.',
    criterionDescription: 'Auto-scaling policies are configured. Scale-up and scale-down thresholds are defined. Load testing validates scaling behavior.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'INF-003',
    name: 'Monitoring and Alerting',
    description: 'Comprehensive monitoring with actionable alerts.',
    criterionDescription: 'Key metrics are monitored (CPU, memory, disk, network). Alerts are configured with appropriate thresholds. On-call rotation is defined.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
  {
    id: 'INF-004',
    name: 'Backup and Recovery',
    description: 'Data is backed up regularly with tested recovery procedures.',
    criterionDescription: 'Backup schedule is defined and automated. Recovery procedures are documented and tested. RPO and RTO targets are met.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'INF-005',
    name: 'Security Hardening',
    description: 'Infrastructure is hardened against common attack vectors.',
    criterionDescription: 'Network segmentation is implemented. Unnecessary ports are closed. OS and runtime patches are current. Secrets are managed securely.',
    slitherDetectors: [],
    severity: 'critical',
    applicableTo: ['all'],
  },
  {
    id: 'INF-006',
    name: 'Cost Optimization',
    description: 'Infrastructure costs are optimized without sacrificing reliability.',
    criterionDescription: 'Resource utilization is monitored. Right-sizing recommendations are implemented. Reserved instances or savings plans are used where appropriate.',
    slitherDetectors: [],
    severity: 'low',
    applicableTo: ['all'],
  },
  {
    id: 'INF-007',
    name: 'Centralized Logging',
    description: 'Logs are aggregated in a centralized system for analysis.',
    criterionDescription: 'All services emit structured logs. Logs are aggregated centrally. Log retention policy is defined. Log search and analysis is available.',
    slitherDetectors: [],
    severity: 'medium',
    applicableTo: ['all'],
  },
  {
    id: 'INF-008',
    name: 'CI/CD Pipeline',
    description: 'Continuous integration and deployment pipeline is reliable and fast.',
    criterionDescription: 'Build, test, and deploy stages are automated. Pipeline failures are alerted. Deployment rollback is supported. Pipeline duration is optimized.',
    slitherDetectors: [],
    severity: 'high',
    applicableTo: ['all'],
  },
];

export function getCriteriaForJobType(jobType: string, subtypes?: string[]): CriteriaCategory[] {
  switch (jobType) {
    case 'audit': {
      const types = subtypes ?? ['all'];
      const includeDefi = types.some(t => ['defi', 'governance'].includes(t.toLowerCase()));
      return getCriteriaForContract(types, includeDefi);
    }
    case 'code_review': return CODE_REVIEW_CRITERIA;
    case 'data_engineering': return DATA_ENGINEERING_CRITERIA;
    case 'nlp_content': return NLP_CONTENT_CRITERIA;
    case 'ml_ai': return ML_AI_CRITERIA;
    case 'frontend_ux': return FRONTEND_UX_CRITERIA;
    case 'infrastructure': return INFRASTRUCTURE_CRITERIA;
    default: return [];
  }
}

/**
 * Get criteria relevant to a specific contract type.
 */
export function getCriteriaForContract(
  contractTypes: string[],
  includeDefi: boolean = false,
): OwaspCategory[] {
  const types = new Set(contractTypes.map(t => t.toLowerCase()));
  types.add('all');

  let criteria = OWASP_SMART_CONTRACT_TOP_10.filter(
    c => c.applicableTo.some(a => types.has(a)),
  );

  if (includeDefi) {
    const defi = DEFI_COMPLIANCE_CRITERIA.filter(
      c => c.applicableTo.some(a => types.has(a)),
    );
    criteria = [...criteria, ...defi];
  }

  return criteria;
}

/**
 * Map a Slither detector name to an OWASP SWC category ID.
 */
export function mapDetectorToSWC(detector: string): string {
  const all = [...OWASP_SMART_CONTRACT_TOP_10, ...DEFI_COMPLIANCE_CRITERIA];
  for (const cat of all) {
    if (cat.slitherDetectors.includes(detector)) return cat.id;
  }
  return 'SWC-000';
}
