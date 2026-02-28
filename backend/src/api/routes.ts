import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AnalyzePipeline } from '../pipeline/analyze';
import { FinalizePipeline } from '../pipeline/finalize';
import { QdrantService } from '../vector/qdrant';
import { validateBody } from './middleware';

const router = Router();
const analyzePipeline = new AnalyzePipeline();
const finalizePipeline = new FinalizePipeline();
const qdrant = new QdrantService();

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const analyzeSchema = z.object({
  query: z.string().min(1, 'query is required'),
  sessionId: z.string().uuid().optional(),
  walletAddress: z.string().optional(),
});

const slotValueSchema = z.object({
  value: z.any().nullable(),
  provenance: z.enum(['user_explicit', 'llm_inferred', 'similar_job', 'default', 'empty']),
  confidence: z.number().min(0).max(1),
});

const slotsSchema = z.object({
  taskDescription: slotValueSchema,
  deliverableType: slotValueSchema,
  scope: slotValueSchema,
  deadline: slotValueSchema,
  budget: slotValueSchema,
  acceptanceCriteria: slotValueSchema,
  requiredCapabilities: slotValueSchema,
  preferredAgentReputation: slotValueSchema,
  context: slotValueSchema,
  exampleOutputs: slotValueSchema,
});

const similarJobSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  budget: z.number().optional(),
  successCriteria: z.array(z.any()),
  completionTime: z.number().optional(),
  score: z.number(),
});

const suggestCriteriaSchema = z.object({
  slots: slotsSchema,
  similarJobs: z.array(similarJobSchema).optional().default([]),
});

const successCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  measurable: z.boolean(),
  source: z.enum(['similar_job', 'llm_suggested', 'user_defined']),
  accepted: z.boolean(),
});

const finalizeSchema = z.object({
  sessionId: z.string(),
  slots: slotsSchema,
  acceptedCriteria: z.array(successCriterionSchema),
  walletAddress: z.string().min(1, 'walletAddress is required'),
  tags: z.array(z.string()),
  category: z.string(),
});

// ---------------------------------------------------------------------------
// POST /v1/jobs/analyze
// ---------------------------------------------------------------------------
router.post(
  '/v1/jobs/analyze',
  validateBody(analyzeSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await analyzePipeline.analyze(req.body);
      res.json({ data: result });
    } catch (err) {
      console.error('Analyze pipeline error:', err);
      res.status(500).json({
        error: 'Analysis failed',
        message: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined,
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/jobs/suggest-criteria
// ---------------------------------------------------------------------------
router.post(
  '/v1/jobs/suggest-criteria',
  validateBody(suggestCriteriaSchema),
  async (req: Request, res: Response) => {
    try {
      const { slots, similarJobs } = req.body;
      const llm = analyzePipeline['llm']; // reuse the LLM provider
      const suggestion = await llm.suggestCriteria(slots, similarJobs);
      res.json({ data: suggestion });
    } catch (err) {
      console.error('Suggest criteria error:', err);
      res.status(500).json({
        error: 'Criteria suggestion failed',
        message: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined,
      });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /v1/jobs/finalize
// ---------------------------------------------------------------------------
router.post(
  '/v1/jobs/finalize',
  validateBody(finalizeSchema),
  async (req: Request, res: Response) => {
    try {
      const result = await finalizePipeline.finalize(req.body);
      res.json({ data: result });
    } catch (err) {
      console.error('Finalize pipeline error:', err);
      res.status(500).json({
        error: 'Finalization failed',
        message: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined,
      });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /v1/jobs/draft/:sessionId
// ---------------------------------------------------------------------------
router.get('/v1/jobs/draft/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId as string;
    const draft = await qdrant.getDraft(sessionId);

    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    res.json({ data: draft });
  } catch (err) {
    console.error('Get draft error:', err);
    res.status(500).json({
      error: 'Failed to retrieve draft',
      message: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined,
    });
  }
});

export default router;
