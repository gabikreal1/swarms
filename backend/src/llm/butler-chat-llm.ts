import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionChunk,
} from 'openai/resources/chat/completions';
import { config } from '../config';
import { log } from '../lib/logger';

const MODEL = 'gpt-5.2';
const DEFAULT_MAX_ITERATIONS = 5;

export interface StreamCallbacks {
  onTextDelta: (delta: string) => void;
  onToolCallComplete: (
    toolName: string,
    args: Record<string, unknown>,
    result: Record<string, unknown>,
  ) => void;
  onExecuteTool: (
    toolName: string,
    args: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  onDone: (fullText: string, toolsCalled: string[]) => void;
  onError: (error: Error) => void;
}

interface AccumulatedToolCall {
  index: number;
  id: string;
  name: string;
  arguments: string;
}

export class ButlerChatLLM {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async streamChatWithToolLoop(
    messages: ChatCompletionMessageParam[],
    tools: ChatCompletionTool[],
    callbacks: StreamCallbacks,
    maxIterations = DEFAULT_MAX_ITERATIONS,
  ): Promise<void> {
    const allToolsCalled: string[] = [];
    let fullText = '';
    let iteration = 0;

    // Copy messages so we can append tool results without mutating the caller's array
    const conversationMessages = [...messages];

    try {
      while (iteration < maxIterations) {
        iteration++;
        log.llm.info(`iteration ${iteration}/${maxIterations} msgs=${conversationMessages.length}`);

        const stream = await this.client.chat.completions.create({
          model: MODEL,
          messages: conversationMessages,
          tools: tools.length > 0 ? tools : undefined,
          stream: true,
        });

        let iterationText = '';
        const accumulatedToolCalls: Map<number, AccumulatedToolCall> = new Map();

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (!delta) continue;

          // Accumulate text deltas
          if (delta.content) {
            iterationText += delta.content;
            fullText += delta.content;
            callbacks.onTextDelta(delta.content);
          }

          // Accumulate tool call deltas
          if (delta.tool_calls) {
            for (const toolCallDelta of delta.tool_calls) {
              const idx = toolCallDelta.index;
              let existing = accumulatedToolCalls.get(idx);

              if (!existing) {
                existing = {
                  index: idx,
                  id: toolCallDelta.id || '',
                  name: toolCallDelta.function?.name || '',
                  arguments: '',
                };
                accumulatedToolCalls.set(idx, existing);
              }

              if (toolCallDelta.id) {
                existing.id = toolCallDelta.id;
              }
              if (toolCallDelta.function?.name) {
                existing.name = toolCallDelta.function.name;
              }
              if (toolCallDelta.function?.arguments) {
                existing.arguments += toolCallDelta.function.arguments;
              }
            }
          }
        }

        // If no tool calls, we are done
        if (accumulatedToolCalls.size === 0) {
          log.llm.info('no tool calls, finishing');
          break;
        }

        log.llm.info(`${accumulatedToolCalls.size} tool call(s):`, Array.from(accumulatedToolCalls.values()).map(tc => tc.name).join(', '));

        // Build the assistant message with tool_calls for the conversation history
        const sortedToolCalls = Array.from(accumulatedToolCalls.values()).sort(
          (a, b) => a.index - b.index,
        );

        const assistantMessage: ChatCompletionMessageParam = {
          role: 'assistant',
          content: iterationText || null,
          tool_calls: sortedToolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        };
        conversationMessages.push(assistantMessage);

        // Execute each tool call and append results
        for (const tc of sortedToolCalls) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.arguments);
          } catch {
            parsedArgs = { _raw: tc.arguments };
          }

          allToolsCalled.push(tc.name);

          const result = await callbacks.onExecuteTool(tc.name, parsedArgs);
          callbacks.onToolCallComplete(tc.name, parsedArgs, result);

          conversationMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          } as ChatCompletionMessageParam);
        }

        // Loop back to get the LLM's response incorporating tool results
      }

      callbacks.onDone(fullText, allToolsCalled);
    } catch (error) {
      callbacks.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }
}

let instance: ButlerChatLLM | null = null;

export function getButlerLLM(): ButlerChatLLM {
  if (!instance) {
    const apiKey = config.openaiApiKey;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    instance = new ButlerChatLLM(apiKey);
  }
  return instance;
}
