/// <reference path="../types/express.d.ts" />
import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { log } from '../lib/logger';
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ChatSSEEvent,
  GenUIBlock,
  SessionPhase,
  SessionContext,
} from '../types/chat';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
  upsertSession,
  getSession,
  insertMessage,
  updateSessionPhase,
  updateSessionContext,
  getSessionsByWallet,
} from '../db/chat-queries';
import { executeButlerTool } from '../services/butler-tools';
import { updateContextFromToolResult } from '../services/butler-chat';
import { getButlerSystemPrompt } from '../llm/butler-prompts';
import { getButlerLLM } from '../llm/butler-chat-llm';
import { BUTLER_TOOL_SCHEMAS } from '../llm/butler-tool-schemas';
import { mapToolResultToBlocks } from '../services/tool-to-genui';
import { validateBody } from './middleware';
import { optionalAuth } from './auth';

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

// ── Vertical action buttons (appended after LLM greeting) ────
function buildVerticalActionBlock(): GenUIBlock {
  return {
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
  } as GenUIBlock;
}

// ── Build OpenAI messages from session history ───────────────
function buildLLMMessages(
  session: { phase: SessionPhase; context: SessionContext; messages: ChatMessage[] },
  walletAddress: string,
  currentUserContent: string,
): ChatCompletionMessageParam[] {
  const systemPrompt = getButlerSystemPrompt(
    walletAddress,
    session.phase,
    session.context,
  );

  const msgs: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add session history (skip the last user message — we add it fresh below)
  for (const msg of session.messages) {
    if (msg.role === 'user') {
      const textContent = msg.blocks
        ?.filter(b => b.type === 'text')
        .map(b => (b as any).content)
        .join('\n') || '';
      if (textContent) {
        msgs.push({ role: 'user', content: textContent });
      }
    } else if (msg.role === 'butler') {
      const textContent = msg.blocks
        ?.filter(b => b.type === 'text')
        .map(b => (b as any).content)
        .join('\n') || '';
      if (textContent) {
        msgs.push({ role: 'assistant', content: textContent });
      }
    }
  }

  // Add current user message
  if (currentUserContent) {
    msgs.push({ role: 'user', content: currentUserContent });
  }

  return msgs;
}

// ── Translate structured responses into text for LLM ─────────
function describeUserInput(body: ChatRequest): string {
  const parts: string[] = [];

  if (body.message) {
    parts.push(body.message);
  }

  if (body.formResponse) {
    const entries = Object.entries(body.formResponse.values)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    parts.push(`I filled out the job details form: ${entries}`);
  }

  if (body.actionResponse) {
    const { actionId, toolCall, toolArgs } = body.actionResponse;
    if (toolArgs?.jobType) {
      parts.push(`I selected the "${toolArgs.jobType}" job vertical.`);
    } else if (actionId === 'tx-confirmed') {
      const txHash = (toolArgs?.txHash as string) || '';
      parts.push(`Transaction confirmed: ${txHash}`);
    } else if (actionId === 'confirm-criteria') {
      parts.push('I confirmed the criteria and want to post the job now.');
    } else if (actionId === 'go-back') {
      parts.push('I want to go back and change something.');
    } else if (toolCall === 'accept_bid' && toolArgs) {
      parts.push(`I want to accept bid ${toolArgs.bidId} on job ${toolArgs.jobId}.`);
    } else {
      parts.push(`I clicked action: ${actionId}`);
    }
  }

  if (body.criteriaResponse) {
    parts.push(`I selected these criteria: ${body.criteriaResponse.selectedIds.join(', ')}`);
    if (body.criteriaResponse.customCriteria?.length) {
      parts.push(`Custom criteria: ${body.criteriaResponse.customCriteria.join(', ')}`);
    }
  }

  if (body.tagsResponse) {
    parts.push(`I selected these tags: ${body.tagsResponse.selectedTags.join(', ')}`);
  }

  return parts.join('\n');
}

// ── Infer phase from tools called ────────────────────────────
function inferPhaseFromTools(
  toolsCalled: string[],
  currentPhase: SessionPhase,
): SessionPhase {
  if (toolsCalled.includes('approve_delivery')) return 'completed';
  if (toolsCalled.includes('accept_bid')) return 'execution';
  if (toolsCalled.includes('post_job')) return 'posting';
  if (toolsCalled.includes('get_job_criteria')) return 'criteria_selection';
  if (toolsCalled.includes('analyze_requirements')) return 'analysis';
  if (
    toolsCalled.includes('get_my_jobs') ||
    toolsCalled.includes('get_job_bids') ||
    toolsCalled.includes('get_delivery_status')
  ) {
    return 'status_inquiry';
  }
  return currentPhase;
}

// ────────────────────────────────────────────────────────────
// POST /v1/chat/message
// ────────────────────────────────────────────────────────────

router.post('/message', optionalAuth, validateBody(chatMessageSchema), async (req: Request, res: Response) => {
  try {
    const body = req.body as ChatRequest;
    const walletAddress = req.walletAddress || body.walletAddress;

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
      log.chat.info(`new session ${sessionId} wallet=${walletAddress.slice(0, 10)}...`);
    } else {
      log.chat.info(`resume session ${sessionId} phase=${session.phase}`);
    }

    // Store user message
    const userText = describeUserInput(body);
    const userMessage: ChatMessage = {
      id: uuid(),
      role: 'user',
      blocks: userText
        ? [{ id: uuid(), type: 'text', content: userText } as GenUIBlock]
        : [],
      timestamp: new Date().toISOString(),
    };
    await insertMessage(sessionId, userMessage);

    // Detect if this is a greeting (new session, no real user input)
    const isGreeting = session.phase === 'greeting' && !body.message && !body.formResponse && !body.actionResponse && !body.criteriaResponse && !body.tagsResponse;

    // Build the user content for the LLM
    const llmUserContent = isGreeting
      ? 'The user just opened the chat. Greet them warmly and let them know what you can help with.'
      : userText;

    // Build OpenAI messages from session history
    const llmMessages = buildLLMMessages(session, walletAddress, llmUserContent);

    // Prepare response tracking
    const responseBlocks: GenUIBlock[] = [];
    let updatedContext = { ...session.context };
    const textBlockId = `text-${uuid().slice(0, 8)}`;

    // Send text block_start via SSE so mobile creates a placeholder
    sendSSE(sessionId, {
      type: 'block_start',
      blockId: textBlockId,
      blockType: 'text',
    });

    // Store criteria/tags from structured response in context before LLM call
    if (body.criteriaResponse) {
      updatedContext.selectedCriteria = body.criteriaResponse.selectedIds;
    }

    // Run LLM streaming loop
    const butlerLLM = getButlerLLM();

    await new Promise<void>((resolve, reject) => {
      butlerLLM.streamChatWithToolLoop(
        llmMessages,
        BUTLER_TOOL_SCHEMAS,
        {
          onTextDelta: (delta) => {
            sendSSE(sessionId, {
              type: 'block_delta',
              blockId: textBlockId,
              delta,
            });
          },

          onExecuteTool: async (toolName, args) => {
            // Inject walletAddress for get_my_jobs (LLM doesn't know the wallet)
            if (toolName === 'get_my_jobs') {
              args.wallet = walletAddress;
            }

            // Inject wallet for post_job
            if (toolName === 'post_job') {
              args.walletAddress = walletAddress;
            }

            log.tool.info(`${toolName}`, JSON.stringify(args).slice(0, 200));

            // Inject selected criteria from the structured response
            if (toolName === 'post_job' && updatedContext.selectedCriteria?.length) {
              args.criteria = args.criteria || updatedContext.selectedCriteria;
            }

            const result = await executeButlerTool(toolName, args);

            // Update session context
            updatedContext = updateContextFromToolResult(
              updatedContext,
              toolName,
              result,
            );

            // Store form values in context if this is analyze_requirements
            if (toolName === 'analyze_requirements') {
              if (body.formResponse?.values?.description) {
                updatedContext.description = body.formResponse.values.description;
              }
              if (body.formResponse?.values?.budget) {
                updatedContext.budget = body.formResponse.values.budget;
              }
              if (body.formResponse?.values?.deadline) {
                updatedContext.deadline = body.formResponse.values.deadline;
              }
              if (result.complexity) {
                updatedContext.complexity = result.complexity as string;
              }
            }

            // Map tool result to GenUI blocks and send via SSE
            const blocks = mapToolResultToBlocks(toolName, result);
            for (const block of blocks) {
              responseBlocks.push(block);
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

            return result;
          },

          onToolCallComplete: (_name, _args, _result) => {
            // Tool result already handled in onExecuteTool
          },

          onDone: (fullText, toolsCalled) => {
            log.chat.info(`done session=${sessionId} tools=[${toolsCalled.join(',')}] textLen=${fullText.length}`);
            // Complete the text block
            const textBlock: GenUIBlock = {
              id: textBlockId,
              type: 'text',
              content: fullText,
            } as GenUIBlock;

            responseBlocks.unshift(textBlock);

            sendSSE(sessionId, {
              type: 'block_complete',
              blockId: textBlockId,
              block: textBlock,
            });

            // For greeting, append vertical action buttons
            if (isGreeting) {
              const actionBlock = buildVerticalActionBlock();
              responseBlocks.push(actionBlock);
              sendSSE(sessionId, {
                type: 'block_start',
                blockId: actionBlock.id,
                blockType: 'action',
              });
              sendSSE(sessionId, {
                type: 'block_complete',
                blockId: actionBlock.id,
                block: actionBlock,
              });
            }

            // Infer phase from tools called
            const nextPhase = inferPhaseFromTools(toolsCalled, session!.phase);

            // Store butler message
            const butlerMessage: ChatMessage = {
              id: uuid(),
              role: 'butler',
              blocks: responseBlocks,
              timestamp: new Date().toISOString(),
              metadata: {
                toolCalls: toolsCalled.length > 0 ? toolsCalled : undefined,
                sessionPhase: nextPhase,
              },
            };

            // Async operations — fire and handle
            (async () => {
              try {
                await insertMessage(sessionId, butlerMessage);

                if (nextPhase !== session!.phase) {
                  log.chat.info(`phase ${session!.phase} → ${nextPhase} session=${sessionId}`);
                  await updateSessionPhase(sessionId, nextPhase);
                  sendSSE(sessionId, { type: 'phase_change', phase: nextPhase });
                }
                await updateSessionContext(sessionId, updatedContext);

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
                resolve();
              } catch (err) {
                reject(err);
              }
            })();
          },

          onError: (error) => {
            log.chat.error('LLM error:', error.message);
            sendSSE(sessionId, {
              type: 'error',
              message: error.message,
              code: 'llm_error',
            });

            // Send error as text block
            const errorBlock: GenUIBlock = {
              id: textBlockId,
              type: 'text',
              content: `I'm having trouble processing your request. Please try again.`,
            } as GenUIBlock;

            sendSSE(sessionId, {
              type: 'block_complete',
              blockId: textBlockId,
              block: errorBlock,
            });
            sendSSE(sessionId, {
              type: 'done',
              messageId: uuid(),
            });

            const errorMessage: ChatMessage = {
              id: uuid(),
              role: 'butler',
              blocks: [errorBlock],
              timestamp: new Date().toISOString(),
            };

            insertMessage(sessionId, errorMessage).catch(() => {});

            res.json({
              sessionId,
              message: errorMessage,
              phase: session!.phase,
            } as ChatResponse);
            resolve();
          },
        },
      ).catch(reject);
    });
  } catch (err) {
    log.chat.error('message error:', (err as Error).message);
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
  log.sse.info(`connected session=${sessionId} clients=${sseConnections.get(sessionId)!.size}`);

  // Clean up on disconnect
  req.on('close', () => {
    const clients = sseConnections.get(sessionId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseConnections.delete(sessionId);
      }
    }
    log.sse.info(`disconnected session=${sessionId}`);
  });
});

// ────────────────────────────────────────────────────────────
// GET /v1/chat/sessions?wallet=0x...
// ────────────────────────────────────────────────────────────

router.get('/sessions', optionalAuth, async (req: Request, res: Response) => {
  const wallet = req.walletAddress || (req.query.wallet as string);

  try {
    const sessions = await getSessionsByWallet(wallet);
    res.json({ sessions });
  } catch (err) {
    log.chat.error('sessions error:', (err as Error).message);
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

    if (req.walletAddress && session.walletAddress.toLowerCase() !== req.walletAddress) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    res.json(session);
  } catch (err) {
    log.chat.error('get session error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;
