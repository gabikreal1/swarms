import Anthropic from '@anthropic-ai/sdk';
import type { JobSlots, SimilarJob } from '../types/job-slots';
import type { LLMProvider, SlotExtractionResult, CompletenessAssessment, CriteriaSuggestion } from './types';
import {
  SLOT_EXTRACTION_SYSTEM,
  slotExtractionUser,
  COMPLETENESS_ASSESSMENT_SYSTEM,
  completenessAssessmentUser,
  CRITERIA_SUGGESTION_SYSTEM,
  criteriaSuggestionUser,
} from './prompts';

const MODEL = 'claude-sonnet-4-20250514';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async extractSlots(query: string): Promise<SlotExtractionResult> {
    const todayISO = new Date().toISOString().split('T')[0];

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: SLOT_EXTRACTION_SYSTEM,
        messages: [{ role: 'user', content: slotExtractionUser(query, todayISO) }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return JSON.parse(text) as SlotExtractionResult;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Anthropic slot extraction returned invalid JSON: ${error.message}`);
      }
      throw new Error(`Anthropic slot extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async assessCompleteness(slots: JobSlots): Promise<CompletenessAssessment> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: COMPLETENESS_ASSESSMENT_SYSTEM,
        messages: [{ role: 'user', content: completenessAssessmentUser(slots) }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return JSON.parse(text) as CompletenessAssessment;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Anthropic completeness assessment returned invalid JSON: ${error.message}`);
      }
      throw new Error(
        `Anthropic completeness assessment failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async suggestCriteria(slots: JobSlots, similarJobs: SimilarJob[]): Promise<CriteriaSuggestion> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: CRITERIA_SUGGESTION_SYSTEM,
        messages: [{ role: 'user', content: criteriaSuggestionUser(slots, similarJobs) }],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return JSON.parse(text) as CriteriaSuggestion;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Anthropic criteria suggestion returned invalid JSON: ${error.message}`);
      }
      throw new Error(
        `Anthropic criteria suggestion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
