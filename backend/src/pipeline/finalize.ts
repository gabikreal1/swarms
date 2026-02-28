import { ethers } from 'ethers';
import {
  FinalizeRequest,
  FinalizeResponse,
  JobMetadataDocument,
  SuccessCriterion,
} from '../types/job-slots';
import { config } from '../config';

// Minimal ABI fragments for encoding calldata
const ORDERBOOK_ABI = [
  'function postJob(string description, string metadataURI, string[] tags, uint64 deadline) returns (uint256 jobId)',
  'function postJobWithCriteria(string description, string metadataURI, string[] tags, uint64 deadline, bytes32 criteriaHash, uint8 criteriaCount, bool allRequired, uint8 passingScore) returns (uint256 jobId)',
];

export class FinalizePipeline {
  private orderBookInterface = new ethers.Interface(ORDERBOOK_ABI);

  async finalize(request: FinalizeRequest): Promise<FinalizeResponse> {
    // 1. Build JobMetadataDocument from finalized slots
    const metadata = this.buildMetadataDocument(request);

    // 2. Pin to IPFS via Pinata (skip if not configured)
    let metadataURI = '';
    try {
      metadataURI = await this.pinToIPFS(metadata);
    } catch (err) {
      console.warn('[finalize] IPFS pinning skipped:', (err as Error).message);
    }

    // 3. Determine if criteria-aware or standard job
    const useCriteria = request.acceptedCriteria.length > 0;

    // 4. Encode contract calldata
    const transaction = useCriteria
      ? this.encodePostJobWithCriteria(metadata, metadataURI, request)
      : this.encodePostJob(metadata, metadataURI, request);

    return {
      metadataURI,
      metadataDocument: metadata,
      transaction,
      useCriteria,
    };
  }

  private buildMetadataDocument(request: FinalizeRequest): JobMetadataDocument {
    const { slots, acceptedCriteria, tags, category } = request;
    const now = new Date().toISOString();

    return {
      version: '1.0',
      title: slots.taskDescription?.value || 'Untitled Job',
      description: slots.taskDescription?.value || '',
      deliverableType: slots.deliverableType?.value || 'general',
      scope: {
        estimatedHours: slots.scope?.value?.estimatedHours,
        complexity: slots.scope?.value?.complexity,
      },
      deadline: slots.deadline?.value || undefined,
      budget: slots.budget?.value || undefined,
      tags,
      category,
      acceptanceCriteria: slots.acceptanceCriteria?.value || [],
      successCriteria: acceptedCriteria,
      context: slots.context?.value || undefined,
      exampleOutputs: slots.exampleOutputs?.value || undefined,
      requiredCapabilities: slots.requiredCapabilities?.value || undefined,
      createdAt: now,
      updatedAt: now,
    };
  }

  private async pinToIPFS(metadata: JobMetadataDocument): Promise<string> {
    if (!config.pinataApiKey || !config.pinataSecretKey) {
      throw new Error('PINATA_API_KEY and PINATA_SECRET_KEY are required for IPFS pinning');
    }

    const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        pinata_api_key: config.pinataApiKey,
        pinata_secret_api_key: config.pinataSecretKey,
      },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: {
          name: `swarms-job-${metadata.title.slice(0, 50)}`,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Pinata IPFS pinning failed (${response.status}): ${errorBody}`);
    }

    const result = (await response.json()) as { IpfsHash: string };
    return `ipfs://${result.IpfsHash}`;
  }

  private encodePostJob(
    metadata: JobMetadataDocument,
    metadataURI: string,
    request: FinalizeRequest,
  ): { to: string; data: string; value: string; chainId: number } {
    const deadline = metadata.deadline
      ? Math.floor(new Date(metadata.deadline).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // default 30 days

    const data = this.orderBookInterface.encodeFunctionData('postJob', [
      metadata.description,
      metadataURI,
      request.tags,
      deadline,
    ]);

    return {
      to: config.orderBookAddress || ethers.ZeroAddress,
      data,
      value: '0',
      chainId: config.chainId,
    };
  }

  private encodePostJobWithCriteria(
    metadata: JobMetadataDocument,
    metadataURI: string,
    request: FinalizeRequest,
  ): { to: string; data: string; value: string; chainId: number } {
    const deadline = metadata.deadline
      ? Math.floor(new Date(metadata.deadline).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // default 30 days

    // Build criteria hash: keccak256 of stringified accepted criteria
    const criteriaPayload = JSON.stringify(
      request.acceptedCriteria.map((c) => ({
        id: c.id,
        description: c.description,
        measurable: c.measurable,
      })),
    );
    const criteriaHash = ethers.keccak256(ethers.toUtf8Bytes(criteriaPayload));

    const criteriaCount = request.acceptedCriteria.length;
    const allRequired = true; // default: all criteria must pass
    const passingScore = 100; // default: 100% passing score

    const data = this.orderBookInterface.encodeFunctionData('postJobWithCriteria', [
      metadata.description,
      metadataURI,
      request.tags,
      deadline,
      criteriaHash,
      criteriaCount,
      allRequired,
      passingScore,
    ]);

    return {
      to: config.orderBookAddress || ethers.ZeroAddress,
      data,
      value: '0',
      chainId: config.chainId,
    };
  }
}
