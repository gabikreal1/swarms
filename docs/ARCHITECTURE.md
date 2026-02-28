# SWARMS Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SWARMS Marketplace                        │
│         Smart Contract Auditing + DeFi Compliance           │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌─────────┐         ┌─────────┐          ┌──────────┐
    │ Mobile  │         │ Backend │          │ Contracts│
    │  (iOS)  │◄───────►│ (Railway)│◄────────►│  (ARC)   │
    └─────────┘  REST   └─────────┘  ethers  └──────────┘
         │        SSE        │                    │
    Circle Wallet      PostgreSQL           ARC Testnet
    (passkeys)         Qdrant (vectors)     Chain 5042002
```

## Backend (`/backend/src/`)

```
src/
├── api/
│   ├── routes.ts           # Job pipeline (/v1/jobs/*)
│   ├── chat.ts             # Butler chat API (NEW - Phase 2)
│   ├── market.ts           # Market analytics
│   ├── feed.ts             # Job & agent feeds
│   ├── stream.ts           # SSE streaming
│   ├── taxonomy.ts         # Tag taxonomy
│   ├── nanopayments.ts     # Circle nanopayment middleware
│   └── middleware.ts       # Validation + error handling
├── services/
│   ├── butler-chat.ts      # Chat orchestrator (NEW - Phase 2)
│   ├── butler-tools.ts     # 12 Butler tools (NEW - Phase 2)
│   ├── market.ts           # Market analytics queries
│   └── stream.ts           # SSE + webhook broadcaster
├── llm/
│   ├── anthropic.ts        # Claude provider
│   ├── butler-prompts.ts   # Butler system prompt (NEW - Phase 2)
│   ├── factory.ts          # Provider factory
│   ├── prompts.ts          # Extraction prompts
│   └── types.ts            # LLMProvider interface
├── validator/
│   ├── validator.ts        # Multi-layer validator (REWRITE - Phase 3)
│   ├── slither-runner.ts   # Slither integration (NEW - Phase 3)
│   └── owasp-criteria.ts   # OWASP SWC Top 10 + DeFi (DONE)
├── pipeline/
│   ├── analyze.ts          # Job analysis (LLM + embeddings)
│   └── finalize.ts         # Job posting (IPFS + tx encoding)
├── agent/
│   ├── butler.ts           # Autonomous butler (on-chain listener)
│   └── wallet.ts           # Agent wallet manager
├── types/
│   ├── chat.ts             # GenUI blocks + chat types (DONE)
│   ├── audit-report.ts     # Audit report structure (DONE)
│   └── job-slots.ts        # Job slots + criteria
├── db/
│   ├── schema.sql          # PostgreSQL schema (UPDATED)
│   ├── chat-queries.ts     # Chat CRUD (DONE)
│   ├── queries.ts          # Job/bid/agent queries
│   ├── pool.ts             # Connection pool
│   └── migrate.ts          # Auto-migration
├── config/
│   └── index.ts            # Zod-validated config
├── indexer/
│   └── event-listener.ts   # On-chain event indexer
├── events/
│   └── event-hub.ts        # Real-time event broadcaster
├── vector/
│   └── qdrant.ts           # Vector similarity search
└── index.ts                # Express app entry point
```

## Mobile (`/mobile/`)

```
mobile/
├── app/
│   ├── _layout.tsx         # Root stack + NotificationProvider
│   ├── (tabs)/
│   │   ├── _layout.tsx     # Bottom tab bar (Home, Post, Activity, Settings)
│   │   ├── index.tsx       # Home — wallet + job list
│   │   ├── post.tsx        # Post Job — analyze → criteria → post
│   │   ├── activity.tsx    # Notifications grouped by date
│   │   └── settings.tsx    # Account, preferences, about
│   ├── job/[id].tsx        # Job detail — timeline, bids, delivery
│   └── chat/[id].tsx       # Chat — Butler genUI (UPDATE - Phase 4)
├── src/
│   ├── components/
│   │   ├── ios/            # Section, SectionRow, Button
│   │   ├── genui/          # GenUI renderers (NEW - Phase 4)
│   │   ├── BidCard.tsx
│   │   ├── CompletionBar.tsx
│   │   ├── CriteriaList.tsx
│   │   ├── JobCard.tsx
│   │   ├── NotificationBanner.tsx
│   │   └── TagSelector.tsx
│   ├── theme/              # Colors, typography, spacing, useTheme
│   ├── contexts/           # NotificationContext
│   ├── api/client.ts       # API client (mock support)
│   ├── wallet/circle.ts    # Circle wallet (passkeys)
│   └── config/mock.ts      # Mock data (USE_MOCKS toggle)
```

## Contracts (`/contracts/`)

```
contracts/
├── contracts/
│   ├── OrderBook.sol       # Job lifecycle hub
│   ├── Escrow.sol          # USDC fund locking/release
│   ├── JobRegistry.sol     # Metadata indexing
│   ├── AgentRegistry.sol   # Agent allowlisting
│   ├── ReputationToken.sol # On-chain reputation
│   ├── ValidationOracle.sol# AI validator management
│   ├── JobTypes.sol        # Shared enums/structs
│   └── mocks/MockUSDC.sol  # Test token
├── scripts/
│   ├── deploy.ts           # Deploys all + wires together
│   ├── mintUSDC.ts         # Mint test USDC
│   └── createWallet.ts     # Generate wallets
├── deployments/
│   └── arc-testnet-5042002.json  # Deployed addresses
└── hardhat.config.ts       # ARC testnet network config
```

## Key Data Flows

### Job Posting Flow
1. User chats with Butler → Butler clarifies scope → presents OWASP criteria
2. Butler calls `post_job` tool → `FinalizePipeline` pins metadata to IPFS
3. Returns unsigned `postJobWithCriteria` tx → mobile signs via Circle wallet
4. OrderBook emits `JobPosted` → EventHub broadcasts via SSE
5. Auditor agents see job, evaluate, call `placeBid` on-chain

### Audit Validation Flow
1. Auditor submits delivery with evidence → `submitDeliveryWithEvidence`
2. OrderBook calls `ValidationOracle.requestValidation`
3. Validator agent receives `ValidationRequested` event
4. Runs Slither on contract source → gets ground truth findings
5. Multi-layer validation: completeness + spot-check + cross-reference
6. Submits `validationOracle.submitValidation(jobId, bitmask, score, reportHash)`
7. Oracle callbacks `OrderBook.onValidationComplete` → releases escrow if passed

### Payment Flow
1. Butler returns `action` block with unsigned tx data
2. Mobile calls `signAndSendTransaction()` via Circle passkey wallet
3. txHash sent back to Butler → confirms on-chain
4. Escrow locks USDC on bid acceptance
5. Escrow releases to agent on delivery approval
