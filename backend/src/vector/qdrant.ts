import { QdrantClient } from '@qdrant/js-client-rest';
import { config } from '../config';

const COMPLETED_JOBS_COLLECTION = 'completed_jobs';
const JOB_DRAFTS_COLLECTION = 'job_drafts';
const SCORE_THRESHOLD = 0.4;

export interface SimilarJobResult {
  id: string;
  score: number;
  title: string;
  description: string;
  tags: string[];
  category: string;
  budget?: number;
  successCriteria: any[];
  completionTime?: number;
}

export interface CompletedJobPayload {
  jobId: number;
  title: string;
  description: string;
  tags: string[];
  category: string;
  budget: number;
  successCriteria: any[];
  completionTime?: number;
  wasDisputed: boolean;
  completedAt: number;
  deliverableType: string;
}

export class QdrantService {
  private client: QdrantClient;

  constructor() {
    this.client = new QdrantClient({
      url: config.qdrantUrl,
      ...(config.qdrantApiKey ? { apiKey: config.qdrantApiKey } : {}),
    });
  }

  async initCollections(): Promise<void> {
    const dimension = config.embeddingDimension;

    // Create completed_jobs collection
    await this.ensureCollection(COMPLETED_JOBS_COLLECTION, dimension);
    await this.createPayloadIndexes(COMPLETED_JOBS_COLLECTION, [
      { field: 'category', type: 'keyword' },
      { field: 'tags', type: 'keyword' },
      { field: 'deliverableType', type: 'keyword' },
      { field: 'finalBudget', type: 'float' },
      { field: 'completedAt', type: 'integer' },
      { field: 'wasDisputed', type: 'bool' },
    ]);

    // Create job_drafts collection
    await this.ensureCollection(JOB_DRAFTS_COLLECTION, dimension);
    await this.createPayloadIndexes(JOB_DRAFTS_COLLECTION, [
      { field: 'walletAddress', type: 'keyword' },
      { field: 'updatedAt', type: 'integer' },
    ]);
  }

  async findSimilarJobs(
    queryVector: number[],
    filters?: {
      category?: string;
      tags?: string[];
      budgetMin?: number;
      budgetMax?: number;
    },
    limit: number = 5,
  ): Promise<SimilarJobResult[]> {
    const must: any[] = [];

    if (filters?.category) {
      must.push({
        key: 'category',
        match: { value: filters.category },
      });
    }

    if (filters?.tags && filters.tags.length > 0) {
      must.push({
        key: 'tags',
        match: { any: filters.tags },
      });
    }

    if (filters?.budgetMin !== undefined) {
      must.push({
        key: 'finalBudget',
        range: { gte: filters.budgetMin },
      });
    }

    if (filters?.budgetMax !== undefined) {
      must.push({
        key: 'finalBudget',
        range: { lte: filters.budgetMax },
      });
    }

    const filter = must.length > 0 ? { must } : undefined;

    const results = await this.client.search(COMPLETED_JOBS_COLLECTION, {
      vector: queryVector,
      limit,
      score_threshold: SCORE_THRESHOLD,
      with_payload: true,
      ...(filter ? { filter } : {}),
    });

    return results.map((result) => {
      const payload = result.payload as Record<string, any>;
      return {
        id: String(result.id),
        score: result.score,
        title: payload.title ?? '',
        description: payload.description ?? '',
        tags: payload.tags ?? [],
        category: payload.category ?? '',
        budget: payload.finalBudget,
        successCriteria: payload.successCriteria ?? [],
        completionTime: payload.completionTime,
      };
    });
  }

  async indexCompletedJob(job: CompletedJobPayload, vector: number[]): Promise<void> {
    await this.client.upsert(COMPLETED_JOBS_COLLECTION, {
      wait: true,
      points: [
        {
          id: String(job.jobId),
          vector,
          payload: {
            title: job.title,
            description: job.description,
            tags: job.tags,
            category: job.category,
            finalBudget: job.budget,
            successCriteria: job.successCriteria,
            completionTime: job.completionTime,
            wasDisputed: job.wasDisputed,
            completedAt: job.completedAt,
            deliverableType: job.deliverableType,
          },
        },
      ],
    });
  }

  async saveDraft(
    sessionId: string,
    walletAddress: string,
    slots: any,
    vector: number[],
  ): Promise<void> {
    await this.client.upsert(JOB_DRAFTS_COLLECTION, {
      wait: true,
      points: [
        {
          id: sessionId,
          vector,
          payload: {
            walletAddress,
            slots,
            updatedAt: Date.now(),
          },
        },
      ],
    });
  }

  async getDraft(sessionId: string): Promise<any | null> {
    try {
      const results = await this.client.retrieve(JOB_DRAFTS_COLLECTION, {
        ids: [sessionId],
        with_payload: true,
        with_vector: false,
      });
      if (results.length === 0) return null;
      return results[0].payload;
    } catch {
      return null;
    }
  }

  async deleteDraft(sessionId: string): Promise<void> {
    await this.client.delete(JOB_DRAFTS_COLLECTION, {
      wait: true,
      points: [sessionId],
    });
  }

  private async ensureCollection(name: string, dimension: number): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === name);
    if (!exists) {
      await this.client.createCollection(name, {
        vectors: {
          size: dimension,
          distance: 'Cosine',
        },
      });
    }
  }

  private async createPayloadIndexes(
    collection: string,
    indexes: { field: string; type: string }[],
  ): Promise<void> {
    for (const { field, type } of indexes) {
      try {
        await this.client.createPayloadIndex(collection, {
          field_name: field,
          field_schema: type as any,
          wait: true,
        });
      } catch {
        // Index may already exist, safe to ignore
      }
    }
  }
}
