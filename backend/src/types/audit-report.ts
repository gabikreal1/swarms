export interface AuditReport {
  version: '1.0';
  contractAddress: string;
  chain: string;
  contractName: string;
  auditorAgent: string;
  timestamp: string;

  summary: {
    overallRisk: 'critical' | 'high' | 'medium' | 'low' | 'informational';
    totalFindings: number;
    bySeverity: SeverityCounts;
  };

  findings: AuditFinding[];

  criteriaResults: CriteriaResult[];

  gasAnalysis?: GasAnalysisEntry[];

  appendix?: {
    toolsUsed: string[];
    methodology: string;
    scope: string;
    disclaimer: string;
  };
}

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  informational: number;
}

export interface AuditFinding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  category: string;
  swcId: string;
  description: string;
  impact: string;

  codeRef: {
    file: string;
    startLine: number;
    endLine: number;
    code: string;
  };

  recommendation: string;
  references: string[];
}

export interface CriteriaResult {
  criterionId: string;
  criterionDescription: string;
  category: string;
  addressed: boolean;
  findingIds: string[];
  notes: string;
}

export interface GasAnalysisEntry {
  functionName: string;
  currentGas: number;
  optimizedGas?: number;
  recommendation?: string;
}
