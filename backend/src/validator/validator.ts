import { ethers } from 'ethers';
import { createLLMProvider } from '../llm/factory';
import { AgentWalletManager } from '../agent/wallet';
import { LLMProvider } from '../llm/types';
import { config } from '../config';

const VALIDATION_ORACLE_ABI = [
  'function submitValidation(uint256 jobId, uint256 criteriaPassedBitmask, uint8 score, bytes32 reportHash)',
  'event ValidationRequested(uint256 indexed jobId, address validator)',
];

const ORDERBOOK_READ_ABI = [
  'function jobCriteria(uint256) view returns (bytes32 criteriaHash, uint8 criteriaCount, bool allRequired, uint8 passingScore)',
  'function criteriaDeliveries(uint256) view returns (bytes32 evidenceMerkleRoot, bytes32 overallProofHash, string evidenceURI, uint256 deliveredAt)',
  'function getJob(uint256 jobId) view returns (tuple(address poster, uint8 status, uint256 acceptedBidId, bytes32 deliveryProof, bool hasDispute), tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, string responseURI, bool accepted, uint256 createdAt)[])',
];

export interface CriterionEvaluation {
  criterionIndex: number;
  description: string;
  passed: boolean;
  confidence: number;
  reasoning: string;
  evidenceFound: string[];
}

export interface ValidationReport {
  jobId: number;
  criteria: CriterionEvaluation[];
  overallScore: number;
  passed: boolean;
  summary: string;
  timestamp: string;
}

export class ValidatorAgent {
  private llm: LLMProvider;
  private walletManager: AgentWalletManager;
  private oracleContract: ethers.Contract | null = null;
  private orderBookContract: ethers.Contract | null = null;

  constructor(walletManager: AgentWalletManager) {
    this.llm = createLLMProvider();
    this.walletManager = walletManager;
  }

  async init(): Promise<void> {
    if (!config.validationOracleAddress) {
      throw new Error('VALIDATION_ORACLE_ADDRESS not configured');
    }
    if (!config.orderBookAddress) {
      throw new Error('ORDERBOOK_ADDRESS not configured');
    }

    const wallet = this.walletManager.getWallet('validator');
    if (!wallet) throw new Error('Validator wallet not configured');

    this.oracleContract = new ethers.Contract(
      config.validationOracleAddress,
      VALIDATION_ORACLE_ABI,
      wallet.signer,
    );

    this.orderBookContract = new ethers.Contract(
      config.orderBookAddress,
      ORDERBOOK_READ_ABI,
      this.walletManager.getProvider(),
    );
  }

  async startListening(): Promise<void> {
    if (!this.oracleContract) throw new Error('Not initialized');

    this.oracleContract.on(
      'ValidationRequested',
      async (jobId: bigint, validator: string) => {
        const walletAddress =
          this.walletManager.getWallet('validator')?.address;
        if (
          validator.toLowerCase() !== walletAddress?.toLowerCase()
        ) {
          return;
        }

        console.log(
          `[validator] Validation requested for job ${jobId}`,
        );
        try {
          await this.validateJob(Number(jobId));
        } catch (error) {
          console.error(
            `[validator] Validation failed for job ${jobId}:`,
            error,
          );
        }
      },
    );

    console.log('[validator] Listening for validation requests');
  }

  async validateJob(jobId: number): Promise<ValidationReport> {
    const criteria = await this.fetchJobCriteria(jobId);
    const evidence = await this.fetchDeliveryEvidence(jobId);
    const evaluations = await this.evaluateCriteria(
      criteria,
      evidence,
    );

    // Build bitmask: bit i is set if criterion i passed
    let bitmask = BigInt(0);
    let weightedScore = 0;
    for (const evaluation of evaluations) {
      if (evaluation.passed) {
        bitmask |= BigInt(1) << BigInt(evaluation.criterionIndex);
      }
      weightedScore +=
        evaluation.confidence * (evaluation.passed ? 1 : 0);
    }

    const overallScore =
      evaluations.length > 0
        ? Math.round((weightedScore / evaluations.length) * 100)
        : 0;

    const report: ValidationReport = {
      jobId,
      criteria: evaluations,
      overallScore,
      passed: overallScore >= 70,
      summary: this.buildSummary(evaluations),
      timestamp: new Date().toISOString(),
    };

    const reportHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(report)),
    );

    await this.submitOnChain(jobId, bitmask, overallScore, reportHash);

    return report;
  }

  private async fetchJobCriteria(
    jobId: number,
  ): Promise<{ index: number; description: string }[]> {
    if (!this.orderBookContract) throw new Error('Not initialized');

    const criteriaOnChain =
      await this.orderBookContract.jobCriteria(jobId);
    const criteriaCount = Number(criteriaOnChain.criteriaCount);

    if (criteriaCount === 0) {
      return [];
    }

    // Fetch the job metadata to get criteria descriptions.
    // The criteriaHash on-chain is a hash of the off-chain criteria document
    // stored at the job's metadataURI. In production, we would:
    // 1. Get the metadataURI from the JobRegistry
    // 2. Fetch the metadata document from IPFS
    // 3. Verify that keccak256(criteria) matches criteriaHash
    // 4. Parse the criteria descriptions
    //
    // For now, generate placeholder criteria from the on-chain data.
    try {
      const [, bids] = await this.orderBookContract.getJob(jobId);
      const acceptedBid = bids.find((b: any) => b.accepted);
      const metadataURI = acceptedBid?.metadataURI || '';

      if (metadataURI) {
        try {
          const metadataContent =
            await this.fetchFromURI(metadataURI);
          if (
            metadataContent?.successCriteria &&
            Array.isArray(metadataContent.successCriteria)
          ) {
            return metadataContent.successCriteria.map(
              (
                c: { description: string },
                i: number,
              ) => ({
                index: i,
                description: c.description,
              }),
            );
          }
        } catch {
          // Fall through to generated criteria
        }
      }
    } catch {
      // Fall through to generated criteria
    }

    // Generate placeholder criteria when we cannot fetch the metadata
    const criteria: { index: number; description: string }[] = [];
    for (let i = 0; i < criteriaCount; i++) {
      criteria.push({
        index: i,
        description: `Criterion ${i + 1}`,
      });
    }
    return criteria;
  }

  private async fetchDeliveryEvidence(
    jobId: number,
  ): Promise<{ evidenceURI: string; content: any }> {
    if (!this.orderBookContract) throw new Error('Not initialized');

    const delivery =
      await this.orderBookContract.criteriaDeliveries(jobId);
    const evidenceURI: string = delivery.evidenceURI;

    if (!evidenceURI) {
      return { evidenceURI: '', content: null };
    }

    try {
      const content = await this.fetchFromURI(evidenceURI);
      return { evidenceURI, content };
    } catch (error) {
      console.error(
        `[validator] Failed to fetch evidence from ${evidenceURI}:`,
        error,
      );
      return { evidenceURI, content: null };
    }
  }

  private async fetchFromURI(uri: string): Promise<any> {
    // Support IPFS, HTTP(S), and data URIs
    let url = uri;
    if (uri.startsWith('ipfs://')) {
      const cid = uri.slice('ipfs://'.length);
      url = `https://gateway.pinata.cloud/ipfs/${cid}`;
    }

    if (url.startsWith('data:')) {
      const commaIdx = url.indexOf(',');
      if (commaIdx === -1) return null;
      const data = url.slice(commaIdx + 1);
      return JSON.parse(Buffer.from(data, 'base64').toString());
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  private async evaluateCriteria(
    criteria: { index: number; description: string }[],
    evidence: { evidenceURI: string; content: any },
  ): Promise<CriterionEvaluation[]> {
    if (criteria.length === 0) return [];

    const evidenceSummary = evidence.content
      ? JSON.stringify(evidence.content, null, 2).slice(0, 4000)
      : 'No evidence provided';

    const evaluations: CriterionEvaluation[] = [];

    for (const criterion of criteria) {
      const prompt = [
        `Evaluate whether the following evidence satisfies the criterion.`,
        ``,
        `Criterion ${criterion.index + 1}: "${criterion.description}"`,
        ``,
        `Evidence:`,
        evidenceSummary,
        ``,
        `Respond with ONLY a JSON object:`,
        `{`,
        `  "passed": true/false,`,
        `  "confidence": 0.0-1.0,`,
        `  "reasoning": "brief explanation",`,
        `  "evidenceFound": ["list of relevant evidence items"]`,
        `}`,
      ].join('\n');

      try {
        const result = await this.llm.extractSlots(prompt);
        // The LLM returns a SlotExtractionResult, but we repurpose
        // rawInterpretation which contains JSON for our evaluation.
        // In production, a dedicated LLM method would be cleaner.
        const parsed = this.parseEvaluationResponse(
          result.rawInterpretation,
        );

        evaluations.push({
          criterionIndex: criterion.index,
          description: criterion.description,
          passed: parsed.passed,
          confidence: parsed.confidence,
          reasoning: parsed.reasoning,
          evidenceFound: parsed.evidenceFound,
        });
      } catch (error) {
        console.error(
          `[validator] Failed to evaluate criterion ${criterion.index}:`,
          error,
        );
        evaluations.push({
          criterionIndex: criterion.index,
          description: criterion.description,
          passed: false,
          confidence: 0,
          reasoning: 'Evaluation failed due to an error',
          evidenceFound: [],
        });
      }
    }

    return evaluations;
  }

  private parseEvaluationResponse(raw: string): {
    passed: boolean;
    confidence: number;
    reasoning: string;
    evidenceFound: string[];
  } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          passed: Boolean(parsed.passed),
          confidence: Math.max(
            0,
            Math.min(1, Number(parsed.confidence) || 0),
          ),
          reasoning: String(parsed.reasoning || ''),
          evidenceFound: Array.isArray(parsed.evidenceFound)
            ? parsed.evidenceFound.map(String)
            : [],
        };
      }
    } catch {
      // Fall through
    }

    // Heuristic fallback: look for positive/negative signals
    const lowerRaw = raw.toLowerCase();
    const passed =
      lowerRaw.includes('satisfied') ||
      lowerRaw.includes('met') ||
      lowerRaw.includes('pass');
    return {
      passed,
      confidence: 0.3,
      reasoning: raw.slice(0, 200),
      evidenceFound: [],
    };
  }

  private buildSummary(evaluations: CriterionEvaluation[]): string {
    const passed = evaluations.filter((e) => e.passed).length;
    const total = evaluations.length;
    const failedDescriptions = evaluations
      .filter((e) => !e.passed)
      .map((e) => `Failed: ${e.description}`);
    const failedSuffix =
      failedDescriptions.length > 0
        ? ` ${failedDescriptions.join('. ')}`
        : '';
    return `${passed}/${total} criteria met.${failedSuffix}`;
  }

  private async submitOnChain(
    jobId: number,
    bitmask: bigint,
    score: number,
    reportHash: string,
  ): Promise<void> {
    if (!this.oracleContract) throw new Error('Not initialized');

    // Clamp score to uint8 range
    const clampedScore = Math.max(0, Math.min(255, score));

    const tx = await this.oracleContract.submitValidation(
      jobId,
      bitmask,
      clampedScore,
      reportHash,
    );
    await tx.wait();
    console.log(
      `[validator] Validation submitted for job ${jobId}: score=${clampedScore}`,
    );
  }
}
