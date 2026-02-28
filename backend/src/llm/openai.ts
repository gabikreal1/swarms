import OpenAI from 'openai';
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

const MODEL = 'gpt-4o';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async extractSlots(query: string): Promise<SlotExtractionResult> {
    const todayISO = new Date().toISOString().split('T')[0];

    try {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SLOT_EXTRACTION_SYSTEM },
          { role: 'user', content: slotExtractionUser(query, todayISO) },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error('OpenAI returned an empty response');
      }

      return JSON.parse(text) as SlotExtractionResult;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`OpenAI slot extraction returned invalid JSON: ${error.message}`);
      }
      throw new Error(`OpenAI slot extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async assessCompleteness(slots: JobSlots): Promise<CompletenessAssessment> {
    try {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: COMPLETENESS_ASSESSMENT_SYSTEM },
          { role: 'user', content: completenessAssessmentUser(slots) },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error('OpenAI returned an empty response');
      }

      return JSON.parse(text) as CompletenessAssessment;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`OpenAI completeness assessment returned invalid JSON: ${error.message}`);
      }
      throw new Error(
        `OpenAI completeness assessment failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async suggestCriteria(slots: JobSlots, similarJobs: SimilarJob[]): Promise<CriteriaSuggestion> {
    try {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: CRITERIA_SUGGESTION_SYSTEM },
          { role: 'user', content: criteriaSuggestionUser(slots, similarJobs) },
        ],
      });

      const text = response.choices[0]?.message?.content;
      if (!text) {
        throw new Error('OpenAI returned an empty response');
      }

      return JSON.parse(text) as CriteriaSuggestion;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`OpenAI criteria suggestion returned invalid JSON: ${error.message}`);
      }
      throw new Error(
        `OpenAI criteria suggestion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
