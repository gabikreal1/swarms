# Butler Agent Design

## Overview

The Butler IS the UI. Users interact purely through chat with the "SWARMS Assistant" which dynamically generates UI components (genUI) inline in the conversation.

## Personality
- Professional, security-aware, concierge style
- Branded as "SWARMS Assistant"
- Clarifies scope/priorities before acting
- Proactive updates at key checkpoints

## Backend Architecture

### API Endpoints
```
POST /v1/chat/message     — Send message, get genUI response
GET  /v1/chat/:id/stream  — SSE for real-time updates
GET  /v1/chat/:id/history — Conversation history
```

### Service Layer (`services/butler-chat.ts`)
Uses Anthropic SDK directly with tool-use loop (max 10 iterations):
1. Get/create session
2. Add user message
3. Apply structured responses (form/action/criteria/tags)
4. Run LLM with tools
5. Parse response → genUI blocks
6. Persist to PostgreSQL
7. Emit SSE events

### System Prompt (`llm/butler-prompts.ts`)
- Session-aware (includes phase, wallet, contract address, job ID)
- Response format: JSON blocks in `<response>` tags
- Flow guidelines for audit, compliance, and status inquiry

## 12 Butler Tools

| Tool | Purpose | Returns |
|------|---------|---------|
| `fetch_contract_source` | Get verified Solidity from block explorer | code block or form |
| `analyze_contract` | LLM analysis (complexity, patterns) | table block |
| `post_job` | Pin IPFS, encode calldata | action block (sign tx) |
| `get_bids` | Query DB, top 3 bids | card blocks |
| `accept_bid` | Encode `acceptBid` calldata | action block (sign tx) |
| `get_job_status` | Live job status from DB | card block |
| `get_delivery` | Fetch audit report + findings | findings + chart blocks |
| `approve_delivery` | Encode `approveDelivery` calldata | action block |
| `raise_dispute` | Encode `raiseDispute` calldata | action block |
| `get_user_jobs` | All jobs for wallet | card blocks |
| `get_owasp_criteria` | OWASP SWC Top 10 + DeFi | criteria block |
| `estimate_cost` | Cost from LOC + complexity | text block |

## Conversation Flow: "Audit this contract at 0xABC"

```
Phase: greeting
  User: "Audit this contract at 0xABC on Base"

Phase: clarification
  Butler: [fetch_contract_source] → code preview
  Butler: [form] scope/priorities/budget/deadline

Phase: analysis
  User: submits form
  Butler: [analyze_contract] → complexity table
  Butler: [get_owasp_criteria] → criteria selector

Phase: criteria_selection
  User: toggles criteria
  Butler: [estimate_cost] → cost estimate

Phase: posting
  Butler: [post_job] → job summary card + "Sign & Post" action
  User: signs tx via Circle wallet

Phase: awaiting_bids
  Butler: "Job posted! I'll notify you when bids arrive."
  (async) EventHub pushes bid notifications

Phase: bid_selection
  Butler: 3 agent_profile cards + "Select" actions
  User: taps agent

Phase: execution
  Butler: [accept_bid] → "Sign to Accept" action
  User: signs → escrow locks USDC
  (async) progress updates during execution

Phase: delivery_review
  Butler: findings block + severity chart + validation card
  Butler: "Approve Delivery" + "Raise Dispute" actions

Phase: completed
  User: approves → escrow releases
  Butler: final summary card
```

## GenUI Block Types (12)

| Type | Description |
|------|-------------|
| `text` | Markdown-rendered text |
| `code` | Syntax-highlighted with line highlighting |
| `card` | Structured: agent_profile, bid_summary, job_status, payment, validation_result |
| `form` | Interactive fields (text, textarea, number, select, checkbox) |
| `criteria` | OWASP checkboxes with SWC badges |
| `tags` | Tag selector with autocomplete |
| `action` | Tappable buttons with optional confirmation |
| `progress` | Multi-step vertical indicator |
| `table` | Scrollable data table |
| `findings` | Expandable audit findings with severity badges |
| `chart` | Bar chart (severity distribution) |
| `diff` | Before/after code comparison |

## Mobile Integration

Chat screen renders genUI blocks via `GenUIRenderer` dispatcher. Callbacks:
- `onAction(actionId, toolCall, toolArgs)` → triggers tool or tx signing
- `onFormSubmit(formId, values)` → sends form data
- `onCriteriaChange(selectedIds)` → sends criteria selection
- `onTagsChange(selectedTags)` → sends tag selection

All sent back as structured `ChatRequest` fields.
