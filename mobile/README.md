# SWARMS Mobile

React Native (Expo) mobile app for the SWARMS marketplace. AI-powered Butler chat for job posting and lifecycle management, gasless transactions via Circle Modular Wallets, real-time SSE streaming.

## Current State (March 2026)

### What's Working
- **Butler tab** — Full LLM-powered conversational interface with streaming text + GenUI blocks
- **Job posting flow** — Describe job → analysis → criteria selection → on-chain posting (all via Butler chat)
- **Job lifecycle** — View your jobs as cards, view bids, accept bids, check delivery, approve — all through Butler
- **SSE streaming** — Text tokens stream with blinking cursor, blocks appear with fade+slide animations after text finishes
- **Circle wallet** — Passkey auth (Face ID), gasless tx signing via ERC-4337 paymaster
- **Home feed** — Job cards with status, budget, deadline, bid count
- **Job detail** — Full job view with bids list, status timeline

### What Needs Work
- Pre-existing TS error in `agents.tsx` (references `systemGray` color that doesn't exist in theme)
- Agent directory screen (WIP)

## Butler Chat — GenUI Block System

The Butler tab renders structured UI blocks from the backend. Each block type has a dedicated React Native component:

```
Backend tool result → mapToolResultToBlocks() → SSE → useButlerChat hook → BlockRenderer → Component
```

### Block Components

| Component | Block Type | Description |
|-----------|-----------|-------------|
| `TextBlock` | `text` | Streaming LLM text with animated blinking cursor (`▌`) |
| `CardBlock` | `card` | Job status cards — status badge, description, tags, bid count, "View Bids" button |
| `TableBlock` | `table` | Data tables with column flex weights (analysis, cost, bids, delivery status) |
| `FormBlock` | `form` | Input forms with text/number/select/textarea fields |
| `CriteriaBlock` | `criteria` | Success criteria checklist with add custom |
| `TagsBlock` | `tags` | Tag pills with add/remove + custom input |
| `ActionBlock` | `action` | Buttons (horizontal/vertical) that trigger tool calls |
| `TransactionBlock` | `transaction` | Sign & broadcast on-chain tx via Circle wallet |
| `AnimatedBlock` | (wrapper) | Fade-in + slide-up animation for non-text blocks |

### Streaming Architecture

```
SSE Connection (GET /v1/chat/:sessionId/stream)
  → block_start (type: text)     → create empty text block, show cursor
  → block_delta                  → append token to text block
  → block_complete (type: text)  → finalize text, hide cursor
  → block_complete (type: card)  → queue if text still streaming
  → block_complete (type: table) → queue if text still streaming
  → done                         → flush queued blocks with 150ms stagger + animations
```

Key implementation: `useButlerChat.ts` queues non-text blocks during text streaming and flushes them with staggered delays after the `done` event, so blocks appear one by one with smooth entrance animations.

### Card Block (job_status variant)

Each job renders as a card with:
- Color-coded status badge (green = open, orange = in_progress, purple = delivered, etc.)
- Chain ID reference (#1, #2, ...)
- Job description (up to 3 lines)
- Tag pills (up to 4, with "+N" overflow)
- Bid count + "View Bids" button (triggers `get_job_bids` tool call)

### Action Flow

When user clicks a button (e.g., "View Bids", "Accept Bid"):
```
CardBlock/ActionBlock → onAction(actionId, toolCall, toolArgs)
  → useButlerChat.handleAction()
  → POST /v1/chat/message { actionResponse: { actionId, toolCall, toolArgs } }
  → Backend converts to user text for LLM ("Show me bids on job X")
  → LLM calls appropriate tool → new blocks stream back
```

## Setup

```bash
npm install
```

### Prerequisites

- Node.js >= 18
- Expo CLI (`npx expo` — included via deps)
- iOS Simulator (Xcode) or Android Emulator, or Expo Go on a physical device

## Run

```bash
npx expo start         # launch Expo dev server
```

Then press:
- `i` — open in iOS Simulator
- `a` — open in Android Emulator
- Scan the QR code with **Expo Go** on your phone

## Screens

| Screen | Tab | Description |
|--------|-----|-------------|
| Home | Tab 1 | Active jobs dashboard, pull-to-refresh |
| Post Job | Tab 2 | Job posting (legacy flow, mostly superseded by Butler) |
| Butler | Tab 3 | LLM-powered chat — job posting + lifecycle management |
| Agents | - | Agent directory (WIP) |
| Job Detail | - | Full job view with bids, status timeline, actions |

## Wallet Integration

Uses [Circle Modular Wallets](https://developers.circle.com/w3s/modular-wallets) for:

- **Passkey authentication** — Face ID / fingerprint via WebAuthn
- **Smart accounts** — ERC-4337 account abstraction
- **Gasless transactions** — Circle Gas Station paymaster covers gas fees
- **ARC Testnet** — Chain ID 5042002

See `src/wallet/circle.ts` for the full implementation.

## Configuration

### Backend URL

Edit `src/api/client.ts`:

```typescript
const API_BASE = 'http://localhost:3000';          // development
const API_BASE = 'https://your-railway-url.up';    // production
```

### Chain Config

ARC Testnet chain definition is in `src/config/chains.ts`:

```typescript
{ id: 5042002, name: 'ARC Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 } }
```

## Directory Structure

```
mobile/
├── app/                          # Expo Router screens (file-based routing)
│   ├── (tabs)/
│   │   ├── index.tsx             # Home — jobs dashboard
│   │   ├── post.tsx              # Post Job (legacy flow)
│   │   └── butler.tsx            # Butler Chat — main conversational UI
│   ├── job/[id].tsx              # Job detail
│   └── agents.tsx                # Agent directory (WIP)
├── src/
│   ├── components/
│   │   ├── genui/                # GenUI block renderers
│   │   │   ├── BlockRenderer.tsx # Switch on block.type → component
│   │   │   ├── TextBlock.tsx     # Streaming text + blinking cursor
│   │   │   ├── CardBlock.tsx     # Job status cards (new)
│   │   │   ├── TableBlock.tsx    # Data tables with flex column weights
│   │   │   ├── FormBlock.tsx     # Input forms
│   │   │   ├── CriteriaBlock.tsx # Criteria checklist
│   │   │   ├── TagsBlock.tsx     # Tag pills
│   │   │   ├── ActionBlock.tsx   # Action buttons
│   │   │   ├── TransactionBlock.tsx # On-chain tx signing
│   │   │   └── AnimatedBlock.tsx # Fade+slide entrance animation wrapper
│   │   ├── JobCard.tsx           # Job summary card (feed)
│   │   └── BidCard.tsx           # Bid summary card (job detail)
│   ├── hooks/
│   │   └── useButlerChat.ts      # Butler chat state, SSE, block streaming, action handlers
│   ├── api/
│   │   └── client.ts             # Backend API client
│   ├── wallet/
│   │   └── circle.ts             # Circle Modular Wallet setup
│   ├── theme/
│   │   ├── colors.ts             # Light/dark color tokens
│   │   ├── useTheme.ts           # Theme hook
│   │   ├── typography.ts         # Font scales
│   │   └── spacing.ts            # Spacing scale
│   ├── config/
│   │   ├── chains.ts             # ARC testnet chain definition
│   │   └── mock.ts               # Mock data for development
│   └── contexts/
│       └── NotificationContext.tsx # Push notification setup
├── app.json                       # Expo config
├── tsconfig.json
└── package.json
```

## Tech Stack

| Library | Purpose |
|---------|---------|
| Expo ~52 | React Native framework |
| React Native 0.76 | Mobile UI |
| Expo Router | File-based navigation |
| `viem` | Ethereum interactions |
| `@circle-fin/modular-wallets-core` | Passkey wallets + gasless |
| `react-native-sse` | Server-Sent Events client |
| `react-native-reanimated` | Animations |
