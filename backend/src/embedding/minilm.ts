import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { EmbeddingProvider } from './types';

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const DIMENSION = 384;
const BATCH_SIZE = 32;

export class MiniLMProvider implements EmbeddingProvider {
  private extractor: FeatureExtractionPipeline | null = null;

  private async getExtractor(): Promise<FeatureExtractionPipeline> {
    if (!this.extractor) {
      this.extractor = await pipeline('feature-extraction', MODEL_NAME, {
        dtype: 'fp32',
      });
    }
    return this.extractor;
  }

  async embed(text: string): Promise<number[]> {
    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array).slice(0, DIMENSION);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const extractor = await this.getExtractor();
      const output = await extractor(batch, { pooling: 'mean', normalize: true });
      const flat = Array.from(output.data as Float32Array);
      for (let j = 0; j < batch.length; j++) {
        results.push(flat.slice(j * DIMENSION, (j + 1) * DIMENSION));
      }
    }
    return results;
  }

  getDimension(): number {
    return DIMENSION;
  }
}
