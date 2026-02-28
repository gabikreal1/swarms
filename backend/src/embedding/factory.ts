import { EmbeddingProvider } from './types';
import { MiniLMProvider } from './minilm';
import { OpenAIEmbeddingProvider } from './openai';
import { config } from '../config';

export function createEmbeddingProvider(): EmbeddingProvider {
  switch (config.embeddingProvider) {
    case 'minilm':
      return new MiniLMProvider();
    case 'openai':
      return new OpenAIEmbeddingProvider(config.openaiApiKey!);
    default:
      throw new Error(`Unknown embedding provider: ${config.embeddingProvider}`);
  }
}
