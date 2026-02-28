import { v4 as uuid } from 'uuid';
import { createLLMProvider } from '../llm/factory';
import { createEmbeddingProvider } from '../embedding/factory';
import { QdrantService } from '../vector/qdrant';
import {
  AnalyzeRequest,
  AnalyzeResponse,
  JobSlots,
  SimilarJob,
  SuccessCriterion,
} from '../types/job-slots';

export class AnalyzePipeline {
  private llm = createLLMProvider();
  private embedder = createEmbeddingProvider();
  private qdrant = new QdrantService();

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const sessionId = request.sessionId || uuid();

    // Step 1: LLM slot extraction (serial, ~1-2s)
    const extraction = await this.llm.extractSlots(request.query);
    const slots = extraction.slots;

    // Step 2: Embed description + completeness assessment (parallel)
    const [embedding, completeness] = await Promise.all([
      this.embedder.embed(request.query),
      this.llm.assessCompleteness(slots),
    ]);

    // Step 3: Qdrant similarity search (needs embedding)
    const similarResults = await this.qdrant.findSimilarJobs(embedding, {
      category: slots.deliverableType?.value || undefined,
      tags: slots.requiredCapabilities?.value || undefined,
    });

    const similarJobs: SimilarJob[] = similarResults.map((r) => ({
      title: r.title,
      description: r.description,
      tags: r.tags,
      budget: r.budget,
      successCriteria: r.successCriteria.map((c: any) => ({
        id: c.id || uuid(),
        description: c.description || '',
        measurable: c.measurable ?? true,
        source: 'similar_job' as const,
        accepted: false,
      })),
      completionTime: r.completionTime,
      score: r.score,
    }));

    // Step 4: LLM criteria suggestion (needs slots + similar jobs)
    const criteriaSuggestion = await this.llm.suggestCriteria(slots, similarJobs);

    // Step 5: Save draft (fire-and-forget)
    this.qdrant
      .saveDraft(sessionId, request.walletAddress || '', slots, embedding)
      .catch(() => {});

    return {
      sessionId,
      slots,
      completenessScore: completeness.score,
      missingSlots: completeness.missingSlots,
      suggestedCriteria: criteriaSuggestion.criteria,
      similarJobs,
      clarifyingQuestions: completeness.clarifyingQuestions,
    };
  }
}
