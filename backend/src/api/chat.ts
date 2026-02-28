import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
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

router.post('/message', async (req: Request, res: Response) => {
  try {
    const body = req.body as ChatRequest;
    const { walletAddress, message } = body;

    if (!walletAddress) {
      res.status(400).json({ error: 'walletAddress is required' });
      return;
    }

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
          const toolResult = executeButlerTool('analyze_requirements', { description: message });
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
          const analysisResult = executeButlerTool('analyze_requirements', {
            description: values.description || '',
          });
          updatedContext = updateContextFromToolResult(
            updatedContext,
            'analyze_requirements',
            analysisResult,
          );

          // Run cost estimation
          const costResult = executeButlerTool('estimate_cost', {
            jobType: analysisResult.jobType || values.jobType,
            complexity: analysisResult.complexity,
          });

          responseBlocks = buildAnalysisBlocks(analysisResult, costResult);
          nextPhase = 'analysis';

          // Store form values in context
          if (values.budget) {
            updatedContext.slots = {
              ...updatedContext.slots,
              budget: {
                value: values.budget,
                provenance: 'user_explicit',
                confidence: 1,
              },
            } as any;
          }
        } else {
          responseBlocks = buildClarificationBlocks(updatedContext.jobType);
        }
        break;
      }

      case 'analysis': {
        // Auto-advance to criteria selection
        const jobType = updatedContext.jobType || 'audit';
        const criteriaResult = executeButlerTool('get_job_criteria', {
          jobType,
        });

        const analysisResult = executeButlerTool('analyze_requirements', {
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

          // Post the job
          const postResult = executeButlerTool('post_job', {
            title: `${updatedContext.jobType || 'General'} Job`,
            description: message || 'Job posted via butler',
            budget: 100,
            deadline: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
            criteria: updatedContext.selectedCriteria || [],
            tags: body.tagsResponse?.selectedTags || [],
            category: updatedContext.jobType || 'general',
          });

          updatedContext = updateContextFromToolResult(
            updatedContext,
            'post_job',
            postResult,
          );

          responseBlocks = [
            {
              id: `text-${uuid().slice(0, 8)}`,
              type: 'text',
              content: `Your job has been posted to the marketplace! Job ID: **${postResult.jobId}**. I'll notify you when agents start bidding.`,
            } as GenUIBlock,
            {
              id: `action-${uuid().slice(0, 8)}`,
              type: 'action',
              actions: [
                { id: 'view-job', label: 'View Job', variant: 'primary' },
                { id: 'post-another', label: 'Post Another Job', variant: 'outline' },
              ],
              layout: 'horizontal',
            } as GenUIBlock,
          ];
          nextPhase = 'awaiting_bids';
        } else {
          // Show criteria again
          const jobType = updatedContext.jobType || 'audit';
          const criteriaResult = executeButlerTool('get_job_criteria', { jobType });
          const tags = (executeButlerTool('analyze_requirements', { description: jobType }).suggestedTags as string[]) || [];
          responseBlocks = buildCriteriaBlocks(criteriaResult, tags);
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

router.get('/sessions', async (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  if (!wallet) {
    res.status(400).json({ error: 'wallet query parameter is required' });
    return;
  }

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

router.get('/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;

  try {
    const session = await getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (err) {
    console.error('[chat] get session error:', err);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;
