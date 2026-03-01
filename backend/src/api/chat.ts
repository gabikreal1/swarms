/// <reference path="../types/express.d.ts" />
import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatSSEEvent,
  GenUIBlock,
  SessionPhase,
} from '../types/chat';
import {
  upsertSession,
  getSession,
  insertMessage,
  updateSessionPhase,
  updateSessionContext,
  getSessionsByWallet,
} from '../db/chat-queries';
import { executeButlerTool, BUTLER_TOOLS } from '../services/butler-tools';
import { updateContextFromToolResult } from '../services/butler-chat';
import { getButlerSystemPrompt } from '../llm/butler-prompts';
import { createLLMProvider } from '../llm/factory';
import { LLMProvider } from '../llm/types';
import { FinalizePipeline } from '../pipeline/finalize';
import { validateBody } from './middleware';
import { optionalAuth } from './auth';

const finalizePipeline = new FinalizePipeline();

export const chatMessageSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  message: z.string().max(2000).optional(),
  sessionId: z.string().uuid().optional(),
  formResponse: z.object({
    formId: z.string(),
    values: z.record(z.string()),
  }).optional(),
  actionResponse: z.object({
    actionId: z.string(),
    toolCall: z.string().optional(),
    toolArgs: z.record(z.unknown()).optional(),
  }).optional(),
  criteriaResponse: z.object({
    selectedIds: z.array(z.string()),
    customCriteria: z.array(z.string()).optional(),
  }).optional(),
  tagsResponse: z.object({
    selectedTags: z.array(z.string()),
  }).optional(),
});

const router = Router();

// SSE connections keyed by sessionId
const sseConnections = new Map<string, Set<Response>>();

// Heartbeat: keep SSE connections alive
setInterval(() => {
  for (const [, clients] of sseConnections) {
    for (const res of clients) {
      res.write(': heartbeat\n\n');
    }
  }
}, 30_000);

function sendSSE(sessionId: string, event: ChatSSEEvent): void {
  const clients = sseConnections.get(sessionId);
  if (!clients) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) {
    res.write(payload);
  }
}

// Phase flow: determine next phase based on user input
function inferNextPhase(
  currentPhase: SessionPhase,
  hasFormResponse: boolean,
  hasActionResponse: boolean,
  hasCriteriaResponse: boolean,
  hasTagsResponse: boolean,
): SessionPhase {
  switch (currentPhase) {
    case 'greeting':
      if (hasActionResponse) return 'clarification';
      return 'greeting';
    case 'clarification':
      if (hasFormResponse) return 'analysis';
      return 'clarification';
    case 'analysis':
      return 'criteria_selection';
    case 'criteria_selection':
      if (hasCriteriaResponse || hasTagsResponse) return 'posting';
      return 'criteria_selection';
    case 'posting':
      return 'awaiting_bids';
    default:
      return currentPhase;
  }
}

// Build greeting blocks
function buildGreetingBlocks(): GenUIBlock[] {
  return [
    {
      id: `text-${uuid().slice(0, 8)}`,
      type: 'text',
      content: 'Welcome to the SWARMS Agent Marketplace! I can help you post jobs across multiple verticals. What kind of task do you need help with?',
    } as GenUIBlock,
    {
      id: `action-${uuid().slice(0, 8)}`,
      type: 'action',
      actions: [
        { id: 'v-audit', label: 'Smart Contract Audit', variant: 'primary', toolCall: 'analyze_requirements', toolArgs: { jobType: 'audit' } },
        { id: 'v-code-review', label: 'Code Review', variant: 'secondary', toolCall: 'analyze_requirements', toolArgs: { jobType: 'code_review' } },
        { id: 'v-data', label: 'Data Engineering', variant: 'secondary', toolCall: 'analyze_requirements', toolArgs: { jobType: 'data_engineering' } },
        { id: 'v-nlp', label: 'NLP / Content', variant: 'secondary', toolCall: 'analyze_requirements', toolArgs: { jobType: 'nlp_content' } },
        { id: 'v-ml', label: 'ML / AI', variant: 'secondary', toolCall: 'analyze_requirements', toolArgs: { jobType: 'ml_ai' } },
        { id: 'v-frontend', label: 'Frontend / UX', variant: 'secondary', toolCall: 'analyze_requirements', toolArgs: { jobType: 'frontend_ux' } },
        { id: 'v-infra', label: 'Infrastructure / DevOps', variant: 'secondary', toolCall: 'analyze_requirements', toolArgs: { jobType: 'infrastructure' } },
      ],
      layout: 'vertical',
    } as GenUIBlock,
  ];
}

// Build clarification form blocks
function buildClarificationBlocks(jobType?: string): GenUIBlock[] {
  return [
    {
      id: `text-${uuid().slice(0, 8)}`,
      type: 'text',
      content: 'Great choice! Let me gather some details about your job. Please fill in what you can:',
    } as GenUIBlock,
    {
      id: `form-${uuid().slice(0, 8)}`,
      type: 'form',
      formId: 'job-details',
      fields: [
        {
          name: 'jobType',
          label: 'Job Type',
          type: 'select',
          required: true,
          defaultValue: jobType || '',
          options: [
            { label: 'Smart Contract Audit', value: 'audit' },
            { label: 'Code Review', value: 'code_review' },
            { label: 'Data Engineering', value: 'data_engineering' },
            { label: 'NLP / Content', value: 'nlp_content' },
            { label: 'ML / AI', value: 'ml_ai' },
            { label: 'Frontend / UX', value: 'frontend_ux' },
            { label: 'Infrastructure / DevOps', value: 'infrastructure' },
          ],
        },
        {
          name: 'description',
          label: 'Job Description',
          type: 'textarea',
          placeholder: 'Describe what you need done...',
          required: true,
        },
        {
          name: 'budget',
          label: 'Budget (USDC)',
          type: 'number',
          placeholder: '100',
          validation: { min: 1 },
        },
        {
          name: 'deadline',
          label: 'Deadline',
          type: 'text',
          placeholder: 'e.g., 2 weeks, March 15',
        },
      ],
      submitLabel: 'Analyze Job',
      cancelLabel: 'Cancel',
    } as GenUIBlock,
  ];
}

// Build analysis blocks from tool results
function buildAnalysisBlocks(
  toolResult: Record<string, unknown>,
  costResult: Record<string, unknown>,
): GenUIBlock[] {
  const jobType = toolResult.jobType as string || 'unknown';
  const complexity = toolResult.complexity as string || 'moderate';
  const cost = costResult.estimatedCostUSDC as number || 0;
  const suggestedTags = (toolResult.suggestedTags as string[]) || [];

  return [
    {
      id: `text-${uuid().slice(0, 8)}`,
      type: 'text',
      content: 'Here\'s my analysis of your job requirements:',
    } as GenUIBlock,
    {
      id: `table-${uuid().slice(0, 8)}`,
      type: 'table',
      columns: [
        { key: 'field', label: 'Category', align: 'left' },
        { key: 'value', label: 'Detail', align: 'left' },
        { key: 'status', label: 'Status', align: 'center' },
      ],
      rows: [
        { field: 'Job Type', value: jobType.replace('_', ' '), status: 'Detected' },
        { field: 'Complexity', value: complexity, status: 'Inferred' },
        { field: 'Estimated Cost', value: `${cost} USDC`, status: 'Estimated' },
        { field: 'Suggested Tags', value: suggestedTags.join(', '), status: 'Suggested' },
      ],
    } as GenUIBlock,
  ];
}

// Build criteria selection blocks
function buildCriteriaBlocks(
  criteriaResult: Record<string, unknown>,
  tags: string[],
): GenUIBlock[] {
  const criteria = (criteriaResult.criteria as any[]) || [];

  const blocks: GenUIBlock[] = [
    {
      id: `text-${uuid().slice(0, 8)}`,
      type: 'text',
      content: 'Here are suggested success criteria for your job. Select the ones you want to include:',
    } as GenUIBlock,
  ];

  if (criteria.length > 0) {
    blocks.push({
      id: `criteria-${uuid().slice(0, 8)}`,
      type: 'criteria',
      criteria: criteria.map((c: any) => ({
        id: c.id,
        description: c.description || c.name,
        category: criteriaResult.jobType as string || 'general',
        measurable: true,
        source: 'llm_suggested' as const,
        preselected: true,
      })),
      allowCustom: true,
    } as GenUIBlock);
  }

  if (tags.length > 0) {
    blocks.push({
      id: `tags-${uuid().slice(0, 8)}`,
      type: 'tags',
      suggested: tags,
      selected: tags,
      allowCustom: true,
    } as GenUIBlock);
  }

  blocks.push({
    id: `action-${uuid().slice(0, 8)}`,
    type: 'action',
    actions: [
      { id: 'confirm-criteria', label: 'Confirm & Post Job', variant: 'primary' },
      { id: 'go-back', label: 'Go Back', variant: 'outline' },
    ],
    layout: 'horizontal',
  } as GenUIBlock);

  return blocks;
}

// ────────────────────────────────────────────────────────────
// POST /v1/chat/message
// ────────────────────────────────────────────────────────────

router.post('/message', optionalAuth, validateBody(chatMessageSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as ChatRequest;
    // Use authenticated wallet if available, fall back to body for unauthenticated clients
    const walletAddress = req.walletAddress || body.walletAddress;
    const { message } = body;

    // Get or create session
    let sessionId = body.sessionId || uuid();
    let session = body.sessionId ? await getSession(body.sessionId) : null;

    if (!session) {
      session = {
        sessionId,
        walletAddress,
        phase: 'greeting' as SessionPhase,
        context: {},
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await upsertSession(session);
    }

    // Store user message
    const userMessage: ChatMessage = {
      id: uuid(),
      role: 'user',
      blocks: message
        ? [{ id: uuid(), type: 'text', content: message } as GenUIBlock]
        : [],
      timestamp: new Date().toISOString(),
    };
    await insertMessage(sessionId, userMessage);

    // Determine response blocks based on phase and input
    let responseBlocks: GenUIBlock[] = [];
    let nextPhase = session.phase;
    let updatedContext = { ...session.context };

    const hasFormResponse = !!body.formResponse;
    const hasActionResponse = !!body.actionResponse;
    const hasCriteriaResponse = !!body.criteriaResponse;
    const hasTagsResponse = !!body.tagsResponse;

    switch (session.phase) {
      case 'greeting': {
        if (hasActionResponse) {
          // User selected a vertical — set jobType directly from toolArgs
          const jobType = (body.actionResponse!.toolArgs?.jobType as string) || 'audit';
          updatedContext.jobType = jobType as any;
          responseBlocks = buildClarificationBlocks(jobType);
          nextPhase = 'clarification';
        } else if (message) {
          // User typed a message — infer job type
          const toolResult = await executeButlerTool('analyze_requirements', { description: message });
          updatedContext.jobType = (toolResult.jobType as string) as any;
          responseBlocks = buildClarificationBlocks(updatedContext.jobType);
          nextPhase = 'clarification';
        } else {
          // Show greeting
          responseBlocks = buildGreetingBlocks();
        }
        break;
      }

      case 'clarification': {
        if (hasFormResponse && body.formResponse!.formId === 'job-details') {
          const values = body.formResponse!.values;

          // Run analyze_requirements tool
          const analysisResult = await executeButlerTool('analyze_requirements', {
            description: values.description || '',
          });
          updatedContext = updateContextFromToolResult(
            updatedContext,
            'analyze_requirements',
            analysisResult,
          );

          // Run cost estimation
          const costResult = await executeButlerTool('estimate_cost', {
            jobType: analysisResult.jobType || values.jobType,
            complexity: analysisResult.complexity,
          });

          // Store all form values in context
          if (values.description) {
            updatedContext.description = values.description;
          }
          if (values.budget) {
            updatedContext.budget = values.budget;
          }
          if (values.deadline) {
            updatedContext.deadline = values.deadline;
          }
          if (values.jobType) {
            updatedContext.jobType = values.jobType as any;
          }

          // Get criteria + tags in the same response so user can act
          const jobType = analysisResult.jobType || values.jobType || updatedContext.jobType || 'audit';
          const criteriaResult = await executeButlerTool('get_job_criteria', { jobType });
          const tags = (analysisResult.suggestedTags as string[]) || [];

          // Combine analysis table + criteria selection into one response
          responseBlocks = [
            ...buildAnalysisBlocks(analysisResult, costResult),
            ...buildCriteriaBlocks(criteriaResult, tags),
          ];
          nextPhase = 'criteria_selection';
        } else {
          responseBlocks = buildClarificationBlocks(updatedContext.jobType);
        }
        break;
      }

      case 'analysis': {
        // Fallback if session got stuck in analysis phase
        const jobType = updatedContext.jobType || 'audit';
        const criteriaResult = await executeButlerTool('get_job_criteria', {
          jobType,
        });

        const analysisResult = await executeButlerTool('analyze_requirements', {
          description: message || jobType,
        });
        const tags = (analysisResult.suggestedTags as string[]) || [];

        responseBlocks = buildCriteriaBlocks(criteriaResult, tags);
        nextPhase = 'criteria_selection';
        break;
      }

      case 'criteria_selection': {
        if (hasCriteriaResponse || hasTagsResponse || hasActionResponse) {
          if (body.criteriaResponse) {
            updatedContext.selectedCriteria = body.criteriaResponse.selectedIds;
          }

          // Build finalize request from accumulated context
          const selectedTags = body.tagsResponse?.selectedTags || [];
          const jobType = updatedContext.jobType || 'general';
          const description = (updatedContext.slots as any)?.description
            || (updatedContext as any).description
            || message
            || `${jobType} job`;
          const budgetRaw = (updatedContext.slots as any)?.budget?.value
            || (updatedContext as any).budget;
          const budgetAmount = typeof budgetRaw === 'object' ? budgetRaw.amount : (parseFloat(budgetRaw) || 100);
          const deadlineRaw = (updatedContext.slots as any)?.deadline?.value
            || (updatedContext as any).deadline;
          const deadlineISO = deadlineRaw
            || new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();

          // Get full criteria objects for the selected IDs
          const criteriaResult = await executeButlerTool('get_job_criteria', { jobType });
          const allCriteria = (criteriaResult.criteria as any[]) || [];
          const selectedIds = new Set(updatedContext.selectedCriteria || []);
          const acceptedCriteria = allCriteria
            .filter((c: any) => selectedIds.has(c.id))
            .map((c: any) => ({
              id: c.id,
              description: c.description || c.name,
              measurable: true,
              source: 'llm_suggested' as const,
              accepted: true,
            }));

          try {
            const finalizeResult = await finalizePipeline.finalize({
              sessionId,
              slots: {
                taskDescription: { value: description, provenance: 'user_explicit', confidence: 1 },
                deliverableType: { value: jobType, provenance: 'llm_inferred', confidence: 0.8 },
                scope: { value: { complexity: (updatedContext as any).complexity || 'moderate' }, provenance: 'llm_inferred', confidence: 0.7 },
                deadline: { value: deadlineISO, provenance: deadlineRaw ? 'user_explicit' : 'default', confidence: deadlineRaw ? 1 : 0.5 },
                budget: { value: { amount: budgetAmount, currency: 'USDC' }, provenance: budgetRaw ? 'user_explicit' : 'default', confidence: budgetRaw ? 1 : 0.5 },
                acceptanceCriteria: { value: [], provenance: 'default', confidence: 0.5 },
                requiredCapabilities: { value: [], provenance: 'default', confidence: 0.5 },
                preferredAgentReputation: { value: 0, provenance: 'default', confidence: 0.5 },
                context: { value: '', provenance: 'default', confidence: 0.5 },
                exampleOutputs: { value: [], provenance: 'default', confidence: 0.5 },
              },
              acceptedCriteria,
              walletAddress,
              tags: selectedTags,
              category: jobType,
            });

            responseBlocks = [
              {
                id: `text-${uuid().slice(0, 8)}`,
                type: 'text',
                content: `Your job is ready to post! Please sign the transaction to publish it on-chain.`,
              } as GenUIBlock,
              {
                id: `tx-${uuid().slice(0, 8)}`,
                type: 'transaction',
                transaction: finalizeResult.transaction,
                title: description.slice(0, 80),
                budget: budgetAmount,
                criteriaCount: acceptedCriteria.length,
              } as GenUIBlock,
            ];
            nextPhase = 'posting';
          } catch (err) {
            console.error('[chat] finalize error:', err);
            responseBlocks = [
              {
                id: `text-${uuid().slice(0, 8)}`,
                type: 'text',
                content: `There was an error preparing your transaction: ${(err as Error).message}. Please try again.`,
              } as GenUIBlock,
            ];
          }
        } else {
          // Show criteria again
          const jobType = updatedContext.jobType || 'audit';
          const criteriaResult = await executeButlerTool('get_job_criteria', { jobType });
          const tags = ((await executeButlerTool('analyze_requirements', { description: jobType })).suggestedTags as string[]) || [];
          responseBlocks = buildCriteriaBlocks(criteriaResult, tags);
        }
        break;
      }

      case 'posting': {
        // Client reports transaction result
        if (hasActionResponse && body.actionResponse!.actionId === 'tx-confirmed') {
          const txHash = body.actionResponse!.toolArgs?.txHash as string || '';
          responseBlocks = [
            {
              id: `text-${uuid().slice(0, 8)}`,
              type: 'text',
              content: `Your job has been posted on-chain! Transaction: **${txHash.slice(0, 10)}...**\n\nI'll notify you when agents start bidding.`,
            } as GenUIBlock,
            {
              id: `action-${uuid().slice(0, 8)}`,
              type: 'action',
              actions: [
                { id: 'post-another', label: 'Post Another Job', variant: 'outline' },
              ],
              layout: 'horizontal',
            } as GenUIBlock,
          ];
          nextPhase = 'awaiting_bids';
        } else {
          responseBlocks = [
            {
              id: `text-${uuid().slice(0, 8)}`,
              type: 'text',
              content: 'Please sign the transaction to post your job.',
            } as GenUIBlock,
          ];
        }
        break;
      }

      default: {
        // For other phases, echo back a text response
        responseBlocks = [
          {
            id: `text-${uuid().slice(0, 8)}`,
            type: 'text',
            content: `Your job is in the **${session.phase}** phase. I'm monitoring for updates and will notify you of any changes.`,
          } as GenUIBlock,
        ];
        break;
      }
    }

    // Update phase and context
    if (nextPhase !== session.phase) {
      await updateSessionPhase(sessionId, nextPhase);
      sendSSE(sessionId, { type: 'phase_change', phase: nextPhase });
    }
    await updateSessionContext(sessionId, updatedContext);

    // Store butler response
    const butlerMessage: ChatMessage = {
      id: uuid(),
      role: 'butler',
      blocks: responseBlocks,
      timestamp: new Date().toISOString(),
      metadata: {
        sessionPhase: nextPhase,
      },
    };
    await insertMessage(sessionId, butlerMessage);

    // Send blocks via SSE
    for (const block of responseBlocks) {
      sendSSE(sessionId, {
        type: 'block_start',
        blockId: block.id,
        blockType: block.type as any,
      });
      sendSSE(sessionId, {
        type: 'block_complete',
        blockId: block.id,
        block,
      });
    }
    sendSSE(sessionId, {
      type: 'done',
      messageId: butlerMessage.id,
    });

    // REST response
    const chatResponse: ChatResponse = {
      sessionId,
      message: butlerMessage,
      phase: nextPhase,
    };
    res.json(chatResponse);
  } catch (err) {
    console.error('[chat] message error:', err);
    res.status(500).json({
      error: 'Chat processing failed',
      message: (err as Error).message,
    });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/chat/:sessionId/stream
// ────────────────────────────────────────────────────────────

router.get('/:sessionId/stream', (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send connected event
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Register connection
  if (!sseConnections.has(sessionId)) {
    sseConnections.set(sessionId, new Set());
  }
  sseConnections.get(sessionId)!.add(res);

  // Clean up on disconnect
  req.on('close', () => {
    const clients = sseConnections.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseConnections.delete(sessionId);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────
// GET /v1/chat/sessions?wallet=0x...
// ────────────────────────────────────────────────────────────

router.get('/sessions', optionalAuth, async (req: Request, res: Response) => {
  // Use authenticated wallet if available, fall back to query param
  const wallet = req.walletAddress || (req.query.wallet as string);

  try {
    const sessions = await getSessionsByWallet(wallet);
    res.json({ sessions });
  } catch (err) {
    console.error('[chat] sessions error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ────────────────────────────────────────────────────────────
// GET /v1/chat/:sessionId
// ────────────────────────────────────────────────────────────

router.get('/:sessionId', optionalAuth, async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  try {
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // If authenticated, verify session ownership
    if (req.walletAddress && session.walletAddress.toLowerCase() !== req.walletAddress) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json(session);
  } catch (err) {
    console.error('[chat] get session error:', err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;
