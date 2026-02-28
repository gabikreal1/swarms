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
  private _llm: ReturnType<typeof createLLMProvider> | null = null;
  private _embedder: ReturnType<typeof createEmbeddingProvider> | null = null;
  private _qdrant: QdrantService | null = null;

  private get llm() {
    if (!this._llm) this._llm = createLLMProvider();
    return this._llm;
  }
  private get embedder() {
    if (!this._embedder) this._embedder = createEmbeddingProvider();
    return this._embedder;
  }
  private get qdrant() {
    if (!this._qdrant) this._qdrant = new QdrantService();
    return this._qdrant;
  }

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const sessionId = request.sessionId || uuid();

    // Step 1: LLM slot extraction (serial, ~1-2s)
    const extraction = await this.llm.extractSlots(request.query);
    const slots = extraction.slots;

    // Step 2: Embed description + completeness assessment (parallel)
    let embedding: number[] = [];
    let completeness: { score: number; missingSlots: any[]; clarifyingQuestions: any[] };

    try {
      [embedding, completeness] = await Promise.all([
        this.embedder.embed(request.query),
        this.llm.assessCompleteness(slots),
      ]);
    } catch (err) {
      console.warn('[analyze] Embedding/completeness failed, using defaults:', (err as Error).message);
      completeness = { score: 0.5, missingSlots: [], clarifyingQuestions: [] };
    }

    // Step 3: Qdrant similarity search (needs embedding)
    let similarJobs: SimilarJob[] = [];
    try {
      if (embedding.length > 0) {
        const similarResults = await this.qdrant.findSimilarJobs(embedding, {
          category: slots.deliverableType?.value || undefined,
          tags: slots.requiredCapabilities?.value || undefined,
        });

        similarJobs = similarResults.map((r) => ({
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
      }
    } catch (err) {
      console.warn('[analyze] Qdrant search failed, continuing without similar jobs:', (err as Error).message);
    }

    // Step 4: LLM criteria suggestion (needs slots + similar jobs)
    const criteriaSuggestion = await this.llm.suggestCriteria(slots, similarJobs);

    // Step 5: Save draft (fire-and-forget)
    if (embedding.length > 0) {
      this.qdrant
        .saveDraft(sessionId, request.walletAddress || '', slots, embedding)
        .catch(() => {});
    }

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
