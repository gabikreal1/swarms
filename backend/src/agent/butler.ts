import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import { createLLMProvider } from '../llm/factory';
import { AgentWalletManager } from './wallet';
import { LLMProvider } from '../llm/types';
import { config } from '../config';
import { log } from '../lib/logger';
import { pinata } from '../services/pinata';
import { Response } from 'express';

// Minimal ABI fragments for OrderBook interactions
const ORDERBOOK_ABI = [
  'function placeBid(uint256 jobId, uint256 price, uint64 deliveryTime, string metadataURI) returns (uint256)',
  'function submitDelivery(uint256 jobId, bytes32 proofHash)',
  'function submitDeliveryWithEvidence(uint256 jobId, bytes32 proofHash, bytes32 evidenceMerkleRoot, string evidenceURI)',
  'event JobPosted(uint256 indexed jobId, address indexed poster)',
];

export interface ButlerTask {
  jobId: number;
  description: string;
  criteria: { index: number; description: string }[];
  deliverables: string[];
}

export interface ButlerProgress {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  detail?: string;
  timestamp: string;
}

interface ExecutionPlan {
  steps: { name: string; description: string; tool?: string }[];
}

export class ButlerAgent extends EventEmitter {
  private llm: LLMProvider;
  private walletManager: AgentWalletManager;
  private activeTasks: Map<number, ButlerTask> = new Map();
  private orderBookContract: ethers.Contract | null = null;

  constructor(walletManager: AgentWalletManager) {
    super();
    this.llm = createLLMProvider();
    this.walletManager = walletManager;
  }

  async init(): Promise<void> {
    if (!config.orderBookAddress) {
      throw new Error('ORDERBOOK_ADDRESS not configured');
    }
    const wallet = this.walletManager.getWallet('butler');
    if (!wallet) throw new Error('Butler wallet not configured');

    this.orderBookContract = new ethers.Contract(
      config.orderBookAddress,
      ORDERBOOK_ABI,
      wallet.signer,
    );
  }

  async startMonitoring(capabilities: string[]): Promise<void> {
    if (!this.orderBookContract) throw new Error('Not initialized');

    const capSet = new Set(capabilities.map((c) => c.toLowerCase()));

    this.orderBookContract.on(
      'JobPosted',
      async (jobId: bigint, poster: string) => {
        try {
          const metadata = await this.fetchJobMetadata(Number(jobId));
          if (!metadata) return;

          const jobTags = (metadata.tags || []).map((t: string) =>
            t.toLowerCase(),
          );
          const overlap = jobTags.filter((t: string) => capSet.has(t));
          if (overlap.length === 0) return;

          log.tool.info(
            `Job ${jobId} matches capabilities: ${overlap.join(', ')}`,
          );

          const shouldBid = await this.evaluateJob(metadata);
          if (shouldBid) {
            await this.placeBid(Number(jobId), metadata);
          }
        } catch (error) {
          log.tool.error(
            `Error processing job ${jobId}:`,
            (error as Error).message,
          );
        }
      },
    );

    log.tool.info(
      `Monitoring for jobs matching: ${capabilities.join(', ')}`,
    );
  }

  async executeTask(task: ButlerTask): Promise<void> {
    this.activeTasks.set(task.jobId, task);
    this.emitProgress(
      task.jobId,
      'analysis',
      'in_progress',
      'Analyzing task requirements',
    );

    try {
      const plan = await this.planExecution(task);
      this.emitProgress(
        task.jobId,
        'planning',
        'completed',
        `Plan: ${plan.steps.length} steps`,
      );

      const stepResults: Map<string, any> = new Map();
      for (const step of plan.steps) {
        this.emitProgress(
          task.jobId,
          step.name,
          'in_progress',
          step.description,
        );
        const result = await this.executeStep(step, stepResults);
        stepResults.set(step.name, result);
        this.emitProgress(task.jobId, step.name, 'completed');
      }

      this.emitProgress(
        task.jobId,
        'compilation',
        'in_progress',
        'Compiling deliverables',
      );
      const deliverables = await this.compileDeliverables(
        task,
        plan,
        stepResults,
      );

      this.emitProgress(
        task.jobId,
        'submission',
        'in_progress',
        'Submitting delivery on-chain',
      );
      await this.submitDelivery(task.jobId, deliverables);
      this.emitProgress(
        task.jobId,
        'submission',
        'completed',
        'Delivery submitted',
      );
    } catch (error: any) {
      this.emitProgress(task.jobId, 'error', 'failed', error.message);
      throw error;
    } finally {
      this.activeTasks.delete(task.jobId);
    }
  }

  streamProgress(jobId: number, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const listener = (progress: ButlerProgress) => {
      res.write(`data: ${JSON.stringify(progress)}\n\n`);
    };

    this.on(`progress:${jobId}`, listener);
    res.on('close', () => {
      this.off(`progress:${jobId}`, listener);
    });
  }

  getActiveTask(jobId: number): ButlerTask | undefined {
    return this.activeTasks.get(jobId);
  }

  private async fetchJobMetadata(jobId: number): Promise<any | null> {
    try {
      // 1. Try fetching metadata_uri from DB (populated by indexer/contract-sync)
      try {
        const { getPool } = require('../db/pool');
        const pool = getPool();
        const { rows } = await pool.query(
          'SELECT metadata_uri, poster, description, tags FROM jobs WHERE chain_id = $1',
          [jobId],
        );
        if (rows[0]?.metadata_uri) {
          const metadata = await pinata.fetchJSON(rows[0].metadata_uri);
          return { jobId, poster: rows[0].poster, ...metadata };
        }
        if (rows[0]) {
          return { jobId, poster: rows[0].poster, description: rows[0].description, tags: rows[0].tags || [] };
        }
      } catch (err) {
        log.tool.debug(`DB metadata lookup for job ${jobId} failed, falling back to on-chain:`, (err as Error).message);
      }

      // 2. Fallback: read on-chain state directly
      const provider = this.walletManager.getProvider();
      const orderBook = new ethers.Contract(
        config.orderBookAddress!,
        [
          'function getJob(uint256 jobId) view returns (tuple(address poster, uint8 status, uint256 acceptedBidId, bytes32 deliveryProof, bool hasDispute), tuple(uint256 id, uint256 jobId, address bidder, uint256 price, uint64 deliveryTime, uint256 reputation, string metadataURI, string responseURI, bool accepted, uint256 createdAt)[])',
        ],
        provider,
      );
      const [jobState] = await orderBook.getJob(jobId);
      return {
        jobId,
        poster: jobState.poster,
        status: Number(jobState.status),
        tags: [],
      };
    } catch {
      return null;
    }
  }

  private async evaluateJob(metadata: any): Promise<boolean> {
    const slots = await this.llm.extractSlots(
      metadata.description || `Job ${metadata.jobId}`,
    );

    const complexity = slots.slots.scope?.value?.complexity;
    if (complexity === 'complex') {
      log.tool.info(
        `Skipping job ${metadata.jobId}: too complex`,
      );
      return false;
    }

    return true;
  }

  private async placeBid(jobId: number, metadata: any): Promise<void> {
    if (!this.orderBookContract) throw new Error('Not initialized');

    // Use LLM to estimate a reasonable price and delivery time
    const assessment = await this.llm.extractSlots(
      metadata.description || `Job ${jobId}`,
    );

    const estimatedHours =
      assessment.slots.scope?.value?.estimatedHours ?? 4;
    const hourlyRate = 25; // USDC per hour
    const price = ethers.parseUnits(
      String(estimatedHours * hourlyRate),
      6,
    );
    const deliveryTime = Math.ceil(estimatedHours * 3600); // seconds

    // Pin bid metadata to IPFS
    let metadataURI = '';
    try {
      const bidMetadata = {
        jobId,
        estimatedHours,
        hourlyRate,
        totalPrice: ethers.formatUnits(price, 6),
        deliveryTimeSeconds: deliveryTime,
        bidderCapabilities: [],
        createdAt: new Date().toISOString(),
      };
      const result = await pinata.pinJSON(bidMetadata, `swarms-bid-job-${jobId}`);
      metadataURI = result.uri;
    } catch (err) {
      log.tool.warn(`IPFS pinning for bid metadata skipped:`, (err as Error).message);
    }

    const tx = await this.orderBookContract.placeBid(
      jobId,
      price,
      deliveryTime,
      metadataURI,
    );
    await tx.wait();

    log.tool.info(
      `Bid placed on job ${jobId}: ${ethers.formatUnits(price, 6)} USDC, ${estimatedHours}h delivery, metadata=${metadataURI}`,
    );
  }

  private async planExecution(
    task: ButlerTask,
  ): Promise<ExecutionPlan> {
    const assessment = await this.llm.extractSlots(task.description);
    const complexity =
      assessment.slots.scope?.value?.complexity ?? 'moderate';

    const steps: ExecutionPlan['steps'] = [];

    steps.push({
      name: 'research',
      description: 'Gather relevant information and context',
      tool: 'web_search',
    });

    if (
      complexity === 'moderate' ||
      complexity === 'complex'
    ) {
      steps.push({
        name: 'analysis',
        description: 'Analyze requirements and design solution approach',
        tool: 'code_analysis',
      });
    }

    steps.push({
      name: 'execution',
      description: 'Generate primary deliverables',
      tool: 'text_generation',
    });

    if (task.criteria.length > 0) {
      steps.push({
        name: 'verification',
        description: 'Verify all success criteria are met',
        tool: 'code_analysis',
      });
    }

    steps.push({
      name: 'packaging',
      description: 'Package and format final output',
      tool: 'text_generation',
    });

    return { steps };
  }

  private async executeStep(
    step: { name: string; description: string; tool?: string },
    priorResults: Map<string, any>,
  ): Promise<any> {
    switch (step.tool) {
      case 'web_search': {
        // In production, this would call a web search API.
        // For now, use LLM to synthesize knowledge.
        const result = await this.llm.extractSlots(
          `Research: ${step.description}`,
        );
        return {
          findings: result.rawInterpretation,
          sources: [],
        };
      }
      case 'code_analysis': {
        const context = Array.from(priorResults.values())
          .map((r) =>
            typeof r === 'string' ? r : JSON.stringify(r),
          )
          .join('\n');
        const result = await this.llm.extractSlots(
          `Analyze: ${step.description}\n\nContext:\n${context}`,
        );
        return {
          analysis: result.rawInterpretation,
        };
      }
      case 'data_retrieval': {
        return { data: null, source: 'none' };
      }
      case 'text_generation':
      default: {
        const context = Array.from(priorResults.values())
          .map((r) =>
            typeof r === 'string' ? r : JSON.stringify(r),
          )
          .join('\n');
        const result = await this.llm.extractSlots(
          `Generate: ${step.description}\n\nContext:\n${context}`,
        );
        return {
          content: result.rawInterpretation,
        };
      }
    }
  }

  private async compileDeliverables(
    task: ButlerTask,
    plan: ExecutionPlan,
    stepResults: Map<string, any>,
  ): Promise<{
    proofHash: string;
    evidenceURI?: string;
    evidenceMerkleRoot?: string;
  }> {
    // Compile all step results into a deliverable manifest
    const manifest = {
      jobId: task.jobId,
      description: task.description,
      deliverables: task.deliverables,
      results: Object.fromEntries(stepResults),
      completedAt: new Date().toISOString(),
    };

    const manifestJson = JSON.stringify(manifest);
    const proofHash = ethers.keccak256(
      ethers.toUtf8Bytes(manifestJson),
    );

    // If criteria exist, build evidence per criterion
    if (task.criteria.length > 0) {
      const evidenceItems = task.criteria.map((criterion) => {
        const relevantResults = Array.from(stepResults.values());
        return {
          criterionIndex: criterion.index,
          description: criterion.description,
          evidence: JSON.stringify(relevantResults),
        };
      });

      const evidenceJson = JSON.stringify(evidenceItems);
      const evidenceHash = ethers.keccak256(
        ethers.toUtf8Bytes(evidenceJson),
      );

      // Pin evidence to IPFS
      let evidenceURI = '';
      try {
        const result = await pinata.pinJSON(
          { evidence: evidenceItems, manifest, proofHash },
          `swarms-evidence-job-${task.jobId}`,
        );
        evidenceURI = result.uri;
      } catch (err) {
        log.tool.warn(`IPFS pinning for evidence skipped:`, (err as Error).message);
      }

      // Build a simple Merkle root from evidence hashes
      const leaves = evidenceItems.map((item) =>
        ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(item))),
      );
      const evidenceMerkleRoot = this.buildMerkleRoot(leaves);

      return { proofHash, evidenceURI, evidenceMerkleRoot };
    }

    return { proofHash };
  }

  private buildMerkleRoot(leaves: string[]): string {
    if (leaves.length === 0) return ethers.ZeroHash;
    if (leaves.length === 1) return leaves[0];

    const nextLevel: string[] = [];
    for (let i = 0; i < leaves.length; i += 2) {
      const left = leaves[i];
      const right = i + 1 < leaves.length ? leaves[i + 1] : left;
      const pair =
        left < right
          ? ethers.concat([left, right])
          : ethers.concat([right, left]);
      nextLevel.push(ethers.keccak256(pair));
    }

    return this.buildMerkleRoot(nextLevel);
  }

  private async submitDelivery(
    jobId: number,
    deliverables: {
      proofHash: string;
      evidenceURI?: string;
      evidenceMerkleRoot?: string;
    },
  ): Promise<void> {
    if (!this.orderBookContract) throw new Error('Not initialized');

    let tx: ethers.ContractTransactionResponse;

    if (deliverables.evidenceURI && deliverables.evidenceMerkleRoot) {
      tx = await this.orderBookContract.submitDeliveryWithEvidence(
        jobId,
        deliverables.proofHash,
        deliverables.evidenceMerkleRoot,
        deliverables.evidenceURI,
      );
    } else {
      tx = await this.orderBookContract.submitDelivery(
        jobId,
        deliverables.proofHash,
      );
    }

    await tx.wait();
    log.tool.info(`Delivery submitted for job ${jobId}`);
  }

  private emitProgress(
    jobId: number,
    step: string,
    status: ButlerProgress['status'],
    detail?: string,
  ): void {
    const progress: ButlerProgress = {
      step,
      status,
      detail,
      timestamp: new Date().toISOString(),
    };
    this.emit(`progress:${jobId}`, progress);
  }
}
