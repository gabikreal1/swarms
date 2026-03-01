export interface JobTemplate {
  title: string;
  description: string;
  category: string;
}

export const JOB_TEMPLATES: Record<string, JobTemplate[]> = {
  'Smart Contract Audit': [
    {
      title: 'Security audit of ERC-20 token contract',
      description: 'Comprehensive security audit of a custom ERC-20 token with minting, burning, and pausable functionality. Check for reentrancy, overflow, access control, and gas optimization issues. Deliver a detailed PDF report with severity-rated findings.',
      category: 'Smart Contract Audit',
    },
    {
      title: 'Audit ERC-721 NFT marketplace contracts',
      description: 'Full audit of an NFT marketplace including listing, bidding, and royalty distribution logic. Verify safe transfer hooks, access controls, and fee calculation correctness. Expected deliverable: audit report with PoC exploits for any critical findings.',
      category: 'Smart Contract Audit',
    },
    {
      title: 'Review upgradeable proxy pattern implementation',
      description: 'Audit a UUPS upgradeable proxy pattern for storage collision, initialization safety, and upgrade authorization. Ensure compliance with EIP-1967 and verify the initializer modifier usage throughout the contract hierarchy.',
      category: 'Smart Contract Audit',
    },
    {
      title: 'Gas optimization review for batch transfer contract',
      description: 'Review and optimize a batch ERC-20 transfer contract handling up to 500 recipients per transaction. Identify gas bottlenecks, suggest packed storage patterns, and benchmark improvements. Target: 30% gas reduction.',
      category: 'Smart Contract Audit',
    },
    {
      title: 'Formal verification of vault contract invariants',
      description: 'Apply formal verification to an ERC-4626 vault contract. Verify invariants: total assets >= total supply, deposit/withdraw monotonicity, and share price manipulation resistance. Use Certora or Halmos.',
      category: 'Smart Contract Audit',
    },
    {
      title: 'Multi-sig wallet security assessment',
      description: 'Audit a custom multi-signature wallet contract supporting configurable thresholds, delegate calls, and ERC-1271 signature validation. Focus on replay protection, nonce management, and signature malleability.',
      category: 'Smart Contract Audit',
    },
    {
      title: 'Audit staking contract with reward distribution',
      description: 'Security review of a staking contract with time-weighted reward distribution, early withdrawal penalties, and compounding mechanisms. Verify reward calculation precision and check for rounding attack vectors.',
      category: 'Smart Contract Audit',
    },
  ],

  'DeFi': [
    {
      title: 'Audit AMM liquidity pool with concentrated ranges',
      description: 'Full security audit of a Uniswap v3-style concentrated liquidity AMM. Review tick math, position management, fee accumulation, and flash loan integration. Deliver report covering all DeFi-specific risk vectors.',
      category: 'DeFi',
    },
    {
      title: 'Flash loan vulnerability assessment for lending protocol',
      description: 'Assess a lending protocol for flash loan attack vectors including oracle manipulation, price impact during liquidations, and governance attacks via flash-borrowed tokens.',
      category: 'DeFi',
    },
    {
      title: 'Oracle integration security review',
      description: 'Review Chainlink and TWAP oracle integrations in a DeFi protocol. Verify freshness checks, fallback mechanisms, decimal handling, and manipulation resistance. Check for sandwich attack exposure.',
      category: 'DeFi',
    },
    {
      title: 'Yield aggregator strategy audit',
      description: 'Audit yield farming strategies for a vault aggregator protocol. Review deposit/withdraw flows, strategy migration, emergency shutdown, and yield calculation accuracy across multiple underlying protocols.',
      category: 'DeFi',
    },
    {
      title: 'Governance token and voting contract review',
      description: 'Security audit of a governance system with token-weighted voting, delegation, timelocked execution, and quorum requirements. Analyze flash loan governance attacks and vote manipulation vectors.',
      category: 'DeFi',
    },
    {
      title: 'Cross-chain bridge security assessment',
      description: 'Audit a cross-chain token bridge handling lock-and-mint across EVM chains. Review message verification, relayer trust assumptions, replay protection, and fund recovery mechanisms.',
      category: 'DeFi',
    },
  ],

  'Code Review': [
    {
      title: 'Review Node.js REST API for security and quality',
      description: 'Comprehensive code review of a Node.js Express REST API. Check for SQL injection, XSS, CSRF, rate limiting, error handling patterns, input validation, and adherence to SOLID principles. ~5000 LOC.',
      category: 'Code Review',
    },
    {
      title: 'Python data processing library code review',
      description: 'Review a Python library for data transformation and validation. Assess type safety, error handling, test coverage, documentation, and API design. Focus on performance for large datasets (~100K+ rows).',
      category: 'Code Review',
    },
    {
      title: 'TypeScript SDK architecture review',
      description: 'Review the architecture and code quality of a TypeScript SDK for a blockchain API. Check typing correctness, error propagation, retry logic, and developer ergonomics. Provide refactoring recommendations.',
      category: 'Code Review',
    },
    {
      title: 'Go microservice code quality assessment',
      description: 'Code review of a Go gRPC microservice handling payment processing. Review concurrency patterns, error handling, graceful shutdown, and observability instrumentation. ~3000 LOC.',
      category: 'Code Review',
    },
    {
      title: 'Review authentication middleware implementation',
      description: 'Review JWT and OAuth2 authentication middleware for a multi-tenant SaaS API. Check token validation, refresh flow, session management, RBAC implementation, and security headers.',
      category: 'Code Review',
    },
    {
      title: 'Rust CLI tool quality review',
      description: 'Code review of a Rust command-line tool for file processing. Evaluate error handling with anyhow/thiserror, async I/O patterns, test coverage, and cross-platform compatibility.',
      category: 'Code Review',
    },
    {
      title: 'Review test suite and improve coverage',
      description: 'Analyze existing test suite for a Node.js application. Identify gaps in coverage, add missing edge case tests, improve test reliability, and set up coverage reporting with minimum thresholds.',
      category: 'Code Review',
    },
  ],

  'Data Engineering': [
    {
      title: 'Build ETL pipeline for blockchain event indexing',
      description: 'Design and implement an ETL pipeline that indexes smart contract events from multiple EVM chains into a PostgreSQL data warehouse. Handle reorgs, missed blocks, and schema evolution.',
      category: 'Data Engineering',
    },
    {
      title: 'Data quality monitoring system',
      description: 'Build a data quality monitoring system that tracks freshness, completeness, and consistency metrics across 20+ data tables. Include anomaly detection, alerting, and a dashboard for quality scores.',
      category: 'Data Engineering',
    },
    {
      title: 'Optimize slow SQL queries in analytics database',
      description: 'Profile and optimize 15 slow-running analytical queries on a 50GB PostgreSQL database. Add appropriate indexes, rewrite suboptimal joins, and implement materialized views where beneficial.',
      category: 'Data Engineering',
    },
    {
      title: 'Real-time data streaming pipeline with Kafka',
      description: 'Implement a real-time data ingestion pipeline using Kafka Connect. Process JSON events, apply schema validation with Avro, handle late-arriving data, and ensure exactly-once delivery semantics.',
      category: 'Data Engineering',
    },
    {
      title: 'Web scraping pipeline with anti-detection',
      description: 'Build a scalable web scraping pipeline that collects pricing data from 10 DeFi aggregator sites. Handle rate limiting, IP rotation, dynamic content rendering, and data deduplication.',
      category: 'Data Engineering',
    },
    {
      title: 'Build data warehouse schema for marketplace analytics',
      description: 'Design a star schema for a job marketplace analytics warehouse. Create fact and dimension tables for jobs, bids, agents, and transactions. Implement incremental loading and slowly changing dimensions.',
      category: 'Data Engineering',
    },
  ],

  'NLP/Content': [
    {
      title: 'Build sentiment analysis model for crypto news',
      description: 'Train a sentiment analysis model on cryptocurrency news articles. Classify articles as bullish, bearish, or neutral. Target F1 > 0.85 on held-out test set. Deliver model, evaluation report, and inference API.',
      category: 'NLP/Content',
    },
    {
      title: 'Automated smart contract documentation generator',
      description: 'Build a tool that generates human-readable documentation from Solidity source code. Parse NatSpec comments, function signatures, and events into structured markdown. Support multi-contract projects.',
      category: 'NLP/Content',
    },
    {
      title: 'Content moderation pipeline for user submissions',
      description: 'Build a content moderation pipeline that detects spam, toxic content, and PII in user-submitted job descriptions. Use a combination of rule-based filters and LLM classification.',
      category: 'NLP/Content',
    },
    {
      title: 'Multi-language translation pipeline',
      description: 'Implement a translation pipeline for marketplace content supporting English, Spanish, Chinese, and Japanese. Maintain technical terminology accuracy. Include quality scoring per translation.',
      category: 'NLP/Content',
    },
    {
      title: 'Summarization model for audit reports',
      description: 'Fine-tune a summarization model that produces executive summaries from detailed audit reports. Preserve severity ratings, key findings, and recommendations. Target ROUGE-L > 0.6.',
      category: 'NLP/Content',
    },
    {
      title: 'Build RAG pipeline for technical documentation QA',
      description: 'Implement a retrieval-augmented generation pipeline for answering questions about Solidity documentation. Use chunking, embedding, and vector search with citation tracking.',
      category: 'NLP/Content',
    },
  ],

  'ML/AI': [
    {
      title: 'Train anomaly detection model for smart contract transactions',
      description: 'Build an anomaly detection model that identifies suspicious transaction patterns in smart contract interactions. Use transaction graph features, temporal patterns, and value distributions. Target precision > 0.9.',
      category: 'ML/AI',
    },
    {
      title: 'Build recommendation engine for job matching',
      description: 'Implement a content-based and collaborative filtering recommendation engine that matches agents to jobs based on skills, past performance, and job requirements. Evaluate with MAP@k and NDCG.',
      category: 'ML/AI',
    },
    {
      title: 'Price prediction model for marketplace jobs',
      description: 'Train a regression model predicting fair market price for marketplace jobs based on description, complexity, tags, deadline, and historical data. Target MAPE < 20%.',
      category: 'ML/AI',
    },
    {
      title: 'Fraud detection classifier for agent reputation',
      description: 'Build a classifier that detects reputation gaming patterns among agents. Use features from bid history, completion rates, timing patterns, and social graph analysis.',
      category: 'ML/AI',
    },
    {
      title: 'Computer vision model for UI screenshot analysis',
      description: 'Train a model that analyzes UI screenshots for accessibility issues, layout problems, and design system compliance. Output structured annotations with bounding boxes and severity labels.',
      category: 'ML/AI',
    },
    {
      title: 'Time series forecasting for marketplace demand',
      description: 'Build a time series forecasting model predicting daily job volume by category. Use Prophet or LSTM with external features (crypto prices, GitHub activity). Provide 7-day and 30-day forecasts.',
      category: 'ML/AI',
    },
  ],

  'Frontend/UX': [
    {
      title: 'Build responsive dashboard with chart components',
      description: 'Create a responsive analytics dashboard with line charts, bar charts, and heat maps using React and Recharts. Support dark/light themes, mobile layout, and real-time data updates via SSE.',
      category: 'Frontend/UX',
    },
    {
      title: 'WCAG accessibility audit and remediation',
      description: 'Conduct a WCAG 2.1 AA audit of an existing React Native application. Fix all Level A violations, implement keyboard navigation, add ARIA labels, and verify screen reader compatibility.',
      category: 'Frontend/UX',
    },
    {
      title: 'Implement design system component library',
      description: 'Build a reusable component library with Button, Input, Modal, Card, Badge, Toast, and Table components. Include Storybook documentation, theme tokens, and TypeScript props.',
      category: 'Frontend/UX',
    },
    {
      title: 'Optimize Next.js app for Core Web Vitals',
      description: 'Optimize a Next.js 14 application to achieve Lighthouse scores > 90 for Performance, Accessibility, Best Practices, and SEO. Implement image optimization, code splitting, and font loading strategy.',
      category: 'Frontend/UX',
    },
    {
      title: 'Build form wizard with multi-step validation',
      description: 'Implement a multi-step form wizard for job posting with inline validation, progress indicator, draft saving, and conditional logic. Use React Hook Form and Zod for schema validation.',
      category: 'Frontend/UX',
    },
    {
      title: 'Create interactive data visualization for market trends',
      description: 'Build interactive D3.js visualizations showing marketplace trends: bubble charts for tag clusters, candlestick charts for pricing, and network graphs for agent relationships.',
      category: 'Frontend/UX',
    },
  ],

  'Infrastructure': [
    {
      title: 'Set up Kubernetes cluster with monitoring stack',
      description: 'Deploy a production-ready Kubernetes cluster with Prometheus, Grafana, and Alertmanager. Configure pod autoscaling, resource limits, and PDB policies. Include runbook for common alerts.',
      category: 'Infrastructure',
    },
    {
      title: 'Build CI/CD pipeline with GitHub Actions',
      description: 'Create a GitHub Actions CI/CD pipeline with lint, test, build, and deploy stages. Include staging and production environments, rollback capability, and Slack notifications.',
      category: 'Infrastructure',
    },
    {
      title: 'Terraform modules for multi-region deployment',
      description: 'Write Terraform modules for deploying a web application across 3 AWS regions with ALB, ECS Fargate, RDS, and CloudFront. Include disaster recovery and failover configuration.',
      category: 'Infrastructure',
    },
    {
      title: 'Container security scanning and hardening',
      description: 'Implement container security scanning in CI pipeline using Trivy and Snyk. Create hardened base images, set up OPA policies for Kubernetes, and document security baselines.',
      category: 'Infrastructure',
    },
    {
      title: 'Database backup and disaster recovery setup',
      description: 'Implement automated PostgreSQL backup strategy with point-in-time recovery. Set up cross-region replication, test recovery procedures, and document RPO/RTO targets. Target RPO: 1 hour.',
      category: 'Infrastructure',
    },
    {
      title: 'Implement centralized logging with ELK stack',
      description: 'Deploy Elasticsearch, Logstash, and Kibana for centralized log aggregation. Configure structured log forwarding from 5 microservices. Create dashboards and alerts for error patterns.',
      category: 'Infrastructure',
    },
  ],
};
