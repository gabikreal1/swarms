import { createEmbeddingProvider } from '../../embedding/factory';
import { QdrantService, type CompletedJobPayload } from '../../vector/qdrant';
import { config } from '../../config';
import type { SeededJob } from './jobs';

/**
 * Generate embeddings for completed jobs and index them in Qdrant.
 * Uses whichever embedding provider is configured (openai or minilm).
 */
export async function seedVectors(
  jobs: SeededJob[],
): Promise<void> {
  const completedJobs = jobs.filter((j) => j.status === 'completed');
  if (completedJobs.length === 0) {
    console.log(`  [vectors] no completed jobs to index`);
    return;
  }

  console.log(`  [vectors] generating ${config.embeddingProvider} embeddings (dim=${config.embeddingDimension}) for ${completedJobs.length} completed jobs...`);

  const embedder = createEmbeddingProvider();
  const qdrant = new QdrantService();

  // Ensure collections exist
  await qdrant.initCollections();

  // Prepare texts for batch embedding
  const texts = completedJobs.map((j) => `${j.title} ${j.description}`);

  // Batch embed
  const vectors = await embedder.embedBatch(texts);

  // Upsert to Qdrant
  for (let i = 0; i < completedJobs.length; i++) {
    const job = completedJobs[i];
    const vector = vectors[i];

    const completionTimeS = job.completedAt
      ? Math.floor((job.completedAt.getTime() - job.createdAt.getTime()) / 1000)
      : undefined;

    const payload: CompletedJobPayload = {
      jobId: job.id,
      title: job.title,
      description: job.description,
      tags: job.tags,
      category: job.category,
      budget: job.budgetUsdc,
      successCriteria: job.successCriteria,
      completionTime: completionTimeS,
      wasDisputed: false,
      completedAt: job.completedAt ? Math.floor(job.completedAt.getTime() / 1000) : Math.floor(Date.now() / 1000),
      deliverableType: job.deliverableType,
    };

    await qdrant.indexCompletedJob(payload, vector);
  }

  console.log(`  [vectors] indexed ${completedJobs.length} jobs in Qdrant`);
}
