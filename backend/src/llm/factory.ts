import type { LLMProvider } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { OllamaProvider } from './ollama';
import { config } from '../config';

export function createLLMProvider(): LLMProvider {
  switch (config.llmProvider) {
    case 'anthropic':
      if (!config.anthropicApiKey) {
        throw new Error('ANTHROPIC_API_KEY is required when using the Anthropic LLM provider');
      }
      return new AnthropicProvider(config.anthropicApiKey);
    case 'openai':
      if (!config.openaiApiKey) {
        throw new Error('OPENAI_API_KEY is required when using the OpenAI LLM provider');
      }
      return new OpenAIProvider(config.openaiApiKey);
    case 'ollama':
      return new OllamaProvider(config.ollamaBaseUrl);
    default:
      throw new Error(`Unknown LLM provider: ${config.llmProvider}`);
  }
}
