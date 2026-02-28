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

interface OllamaChatResponse {
  message: { role: string; content: string };
}

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model = 'llama3.1') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  private async chat(system: string, user: string): Promise<string> {
    const url = `${this.baseUrl}/api/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: 'json',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama API returned ${response.status}: ${body}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message.content;
  }

  async extractSlots(query: string): Promise<SlotExtractionResult> {
    const todayISO = new Date().toISOString().split('T')[0];

    try {
      const text = await this.chat(SLOT_EXTRACTION_SYSTEM, slotExtractionUser(query, todayISO));
      return JSON.parse(text) as SlotExtractionResult;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Ollama slot extraction returned invalid JSON: ${error.message}`);
      }
      throw new Error(`Ollama slot extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async assessCompleteness(slots: JobSlots): Promise<CompletenessAssessment> {
    try {
      const text = await this.chat(COMPLETENESS_ASSESSMENT_SYSTEM, completenessAssessmentUser(slots));
      return JSON.parse(text) as CompletenessAssessment;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Ollama completeness assessment returned invalid JSON: ${error.message}`);
      }
      throw new Error(
        `Ollama completeness assessment failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async suggestCriteria(slots: JobSlots, similarJobs: SimilarJob[]): Promise<CriteriaSuggestion> {
    try {
      const text = await this.chat(CRITERIA_SUGGESTION_SYSTEM, criteriaSuggestionUser(slots, similarJobs));
      return JSON.parse(text) as CriteriaSuggestion;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Ollama criteria suggestion returned invalid JSON: ${error.message}`);
      }
      throw new Error(
        `Ollama criteria suggestion failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
