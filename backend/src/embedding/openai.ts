import OpenAI from 'openai';
import { EmbeddingProvider } from './types';

const MODEL = 'text-embedding-3-small';
const DIMENSION = 1536;

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: MODEL,
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: MODEL,
      input: texts,
    });
    return response.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);
  }

  getDimension(): number {
    return DIMENSION;
  }
}
