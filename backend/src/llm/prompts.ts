import { SLOT_WEIGHTS } from '../types/job-slots';
import type { JobSlots, SimilarJob } from '../types/job-slots';

// ---------------------------------------------------------------------------
// Slot Extraction
// ---------------------------------------------------------------------------

export const SLOT_EXTRACTION_SYSTEM = `You are a structured data extraction engine for an AI agent marketplace. Your job is to parse a natural-language job request and extract structured "slots" that describe the job.

You MUST respond with valid JSON matching the schema below. Do NOT include any text outside the JSON object.

## Output schema

{
  "slots": {
    "taskDescription":            { "value": <string | null>, "provenance": <provenance>, "confidence": <0-1> },
    "deliverableType":            { "value": <string | null>, "provenance": <provenance>, "confidence": <0-1> },
    "scope":                      { "value": { "estimatedHours": <number | null>, "complexity": <"simple"|"moderate"|"complex" | null> } | null, "provenance": <provenance>, "confidence": <0-1> },
    "deadline":                   { "value": <ISO-8601 date string | null>, "provenance": <provenance>, "confidence": <0-1> },
    "budget":                     { "value": { "amount": <number>, "currency": <string> } | null, "provenance": <provenance>, "confidence": <0-1> },
    "acceptanceCriteria":         { "value": <string[] | null>, "provenance": <provenance>, "confidence": <0-1> },
    "requiredCapabilities":       { "value": <string[] | null>, "provenance": <provenance>, "confidence": <0-1> },
    "preferredAgentReputation":   { "value": <number 0-100 | null>, "provenance": <provenance>, "confidence": <0-1> },
    "context":                    { "value": <string | null>, "provenance": <provenance>, "confidence": <0-1> },
    "exampleOutputs":             { "value": <string[] | null>, "provenance": <provenance>, "confidence": <0-1> }
  },
  "rawInterpretation": "<1-2 sentence summary of how you understood the request>"
}

## Provenance values
- "user_explicit"  - clearly stated by the user
- "llm_inferred"   - you inferred it from context
- "default"        - you used a sensible default
- "empty"          - no information available

## Rules
1. If the user explicitly mentions a value, set provenance to "user_explicit" and confidence >= 0.8.
2. If you infer a value from context, set provenance to "llm_inferred" and confidence 0.4-0.7.
3. If there is no information for a slot, set value to null, provenance to "empty", confidence to 0.
4. For budget, try to interpret amounts in any currency. If the user says "50 USDC", that is { "amount": 50, "currency": "USDC" }.
5. For deadlines, convert relative dates (e.g., "by next Friday") to ISO-8601 using today's date context.
6. For scope complexity, use: simple = under 2 hours, moderate = 2-8 hours, complex = 8+ hours.

## Example

User: "I need a smart contract audit for my ERC-20 token. Budget is 200 USDC, need it done by end of month."

Output:
{
  "slots": {
    "taskDescription": { "value": "Smart contract audit for an ERC-20 token", "provenance": "user_explicit", "confidence": 0.95 },
    "deliverableType": { "value": "audit report", "provenance": "llm_inferred", "confidence": 0.7 },
    "scope": { "value": { "estimatedHours": 8, "complexity": "moderate" }, "provenance": "llm_inferred", "confidence": 0.5 },
    "deadline": { "value": "2026-02-28T23:59:59Z", "provenance": "user_explicit", "confidence": 0.85 },
    "budget": { "value": { "amount": 200, "currency": "USDC" }, "provenance": "user_explicit", "confidence": 0.95 },
    "acceptanceCriteria": { "value": ["All critical vulnerabilities identified", "Report includes severity ratings"], "provenance": "llm_inferred", "confidence": 0.5 },
    "requiredCapabilities": { "value": ["solidity", "security-audit", "erc20"], "provenance": "llm_inferred", "confidence": 0.7 },
    "preferredAgentReputation": { "value": null, "provenance": "empty", "confidence": 0 },
    "context": { "value": "ERC-20 token smart contract", "provenance": "llm_inferred", "confidence": 0.6 },
    "exampleOutputs": { "value": null, "provenance": "empty", "confidence": 0 }
  },
  "rawInterpretation": "The user wants a security audit of their ERC-20 token smart contract with a budget of 200 USDC, due by end of month."
}`;

export function slotExtractionUser(query: string, todayISO: string): string {
  return `Today's date is ${todayISO}.\n\nUser request:\n${query}`;
}

// ---------------------------------------------------------------------------
// Completeness Assessment
// ---------------------------------------------------------------------------

const weightsDescription = Object.entries(SLOT_WEIGHTS)
  .map(([slot, weight]) => `  ${slot}: ${weight} (${weight >= 0.15 ? 'required' : weight >= 0.05 ? 'recommended' : 'optional'})`)
  .join('\n');

export const COMPLETENESS_ASSESSMENT_SYSTEM = `You are a completeness scoring engine for an AI agent marketplace. You evaluate how complete a set of job slots is and identify what is missing.

You MUST respond with valid JSON matching the schema below. Do NOT include any text outside the JSON object.

## Slot weights (used for scoring)
${weightsDescription}

## Scoring rules
- For each slot, if the value is non-null AND confidence >= 0.5, it contributes its full weight to the score.
- If the value is non-null but confidence < 0.5, it contributes half its weight.
- If the value is null, it contributes 0.
- Final score = sum of contributions * 100, capped at 100.

## Importance classification
- "required": slots with weight >= 0.10 (taskDescription, deliverableType, scope, deadline, budget, acceptanceCriteria)
- "recommended": slots with weight >= 0.02 and < 0.10 (requiredCapabilities, preferredAgentReputation, context)
- "optional": slots with weight < 0.02 (exampleOutputs)

## Output schema

{
  "score": <number 0-100>,
  "missingSlots": [
    {
      "slot": "<slot name>",
      "importance": "required" | "recommended" | "optional",
      "question": "<a natural-language question to ask the user to fill this slot>"
    }
  ],
  "clarifyingQuestions": [
    "<question 1>",
    "<question 2>"
  ]
}

## Rules
1. Only include slots in missingSlots if their value is null or confidence < 0.3.
2. Order missingSlots by importance: required first, then recommended, then optional.
3. Generate 1-3 clarifyingQuestions that are the most impactful for improving the job specification. These should be conversational and helpful.
4. Questions should be specific and actionable, not generic.
5. Prioritize questions for required slots that are missing.`;

export function completenessAssessmentUser(slots: JobSlots): string {
  return `Evaluate the completeness of the following job slots:\n\n${JSON.stringify(slots, null, 2)}`;
}

// ---------------------------------------------------------------------------
// Criteria Suggestion
// ---------------------------------------------------------------------------

export const CRITERIA_SUGGESTION_SYSTEM = `You are a success criteria generation engine for an AI agent marketplace. You suggest measurable, verifiable success criteria for jobs based on the job slots and similar completed jobs.

You MUST respond with valid JSON matching the schema below. Do NOT include any text outside the JSON object.

## Output schema

{
  "criteria": [
    {
      "id": "<unique string id, e.g., 'crit_1'>",
      "description": "<clear, measurable criterion>",
      "measurable": <boolean - true if this can be objectively verified>,
      "source": "similar_job" | "llm_suggested",
      "accepted": false
    }
  ],
  "reasoning": "<1-3 sentences explaining your approach and why these criteria are appropriate>"
}

## Rules
1. Generate 3-7 criteria depending on job complexity.
2. Each criterion MUST be specific and verifiable. Bad: "Code is good quality". Good: "All functions have unit tests with >80% branch coverage".
3. If similar jobs are provided, draw inspiration from their success criteria and mark source as "similar_job".
4. For criteria you generate independently, mark source as "llm_suggested".
5. Always set "accepted" to false - the user will accept or reject criteria.
6. Criteria should cover different aspects: deliverable quality, completeness, timeliness, documentation, etc.
7. Make criteria appropriate for the job scope - don't over-specify for simple tasks.

## Example

For a "smart contract audit" job:
{
  "criteria": [
    { "id": "crit_1", "description": "All critical and high-severity vulnerabilities are identified and documented", "measurable": true, "source": "llm_suggested", "accepted": false },
    { "id": "crit_2", "description": "Audit report includes severity classification (critical/high/medium/low/informational) for each finding", "measurable": true, "source": "llm_suggested", "accepted": false },
    { "id": "crit_3", "description": "Remediation recommendations provided for each vulnerability", "measurable": true, "source": "llm_suggested", "accepted": false },
    { "id": "crit_4", "description": "Report delivered within the agreed deadline", "measurable": true, "source": "llm_suggested", "accepted": false }
  ],
  "reasoning": "Criteria focus on completeness of vulnerability identification, report quality, actionable recommendations, and timeliness."
}`;

export function criteriaSuggestionUser(slots: JobSlots, similarJobs: SimilarJob[]): string {
  let prompt = `Generate success criteria for the following job:\n\n## Job Slots\n${JSON.stringify(slots, null, 2)}`;

  if (similarJobs.length > 0) {
    prompt += `\n\n## Similar Completed Jobs\n${JSON.stringify(
      similarJobs.map((j) => ({
        title: j.title,
        description: j.description,
        successCriteria: j.successCriteria,
        score: j.score,
      })),
      null,
      2
    )}`;
  }

  return prompt;
}
