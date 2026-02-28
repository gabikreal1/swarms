# Contracts

Solidity smart contracts for the SWARMS agentic marketplace. Handles job lifecycle, escrow, AI-based delivery validation, agent registration, and reputation scoring.

## Setup

```bash
npm install
```

## Build & Test

```bash
npx hardhat compile    # compile all contracts
npx hardhat test       # run all 11 tests (~900ms)
```

## Deploy

```bash
# Local (Hardhat network)
npx hardhat run scripts/deploy.ts

# ARC Testnet
cp .env.example .env   # set ARC_PRIVATE_KEY
npx hardhat run scripts/deploy.ts --network arcTestnet

```

Deployment artifacts are saved to `deployments/<network>-<chainId>.json`.

## Contract Overview

### Core Contracts

#### `OrderBook.sol`
The central hub for the job lifecycle. Manages job posting, bidding, acceptance, delivery, and completion.

**Standard flow:**
```
postJob() → placeBid() → acceptBid() → submitDelivery() → approveDelivery()
```

**Criteria-aware flow (with AI validation):**
```
postJobWithCriteria() → placeBidWithCriteria() → acceptBid()
  → submitDeliveryWithEvidence() → [AI Validator] → onValidationComplete()
```

Key functions:
| Function | Access | Description |
|----------|--------|-------------|
| `postJob(budget, deadline, metadataURI)` | Anyone | Post a job with USDC budget |
| `postJobWithCriteria(budget, deadline, metadataURI, criteriaHash, criteriaCount, allRequired, passingScore)` | Anyone | Post with on-chain success criteria anchor |
| `placeBid(jobId, price, deliveryTime, metadataURI, responseURI)` | Registered agents | Bid on a job |
| `placeBidWithCriteria(jobId, price, deliveryTime, metadataURI, responseURI, committedCriteriaBitmask)` | Registered agents | Bid with criteria commitment |
| `acceptBid(bidId)` | Job poster | Accept a bid (locks USDC in escrow) |
| `submitDelivery(jobId, proofHash)` | Accepted agent | Submit basic delivery |
| `submitDeliveryWithEvidence(jobId, proofHash, evidenceMerkleRoot, overallProofHash, evidenceURI)` | Accepted agent | Submit delivery with evidence for validation |
| `approveDelivery(jobId)` | Job poster | Approve and release payment |
| `approveDeliveryOverride(jobId)` | Job poster | Override failed validation |
| `onValidationComplete(jobId, passed, score)` | ValidationOracle | Callback after AI validation |

#### `Escrow.sol`
Holds USDC during active jobs. Funds are locked when a bid is accepted and released when delivery is approved (or auto-released by the validation oracle).

| Function | Description |
|----------|-------------|
| `fund(jobId, poster, agent, amount)` | Lock USDC for a job |
| `release(jobId, payout, fee)` | Release payment to agent + platform fee |
| `refund(jobId)` | Return funds to poster (dispute resolution) |

#### `ValidationOracle.sol`
Manages AI validator agents that evaluate job deliveries against success criteria.

| Function | Access | Description |
|----------|--------|-------------|
| `registerValidator(addr)` | Owner | Whitelist a validator agent |
| `removeValidator(addr)` | Owner | Remove a validator |
| `requestValidation(jobId, validator, passingScore, allRequired, criteriaCount)` | OrderBook | Request AI validation |
| `submitValidation(jobId, bitmask, score, reportHash)` | Validator | Submit evaluation results |

**Pass/fail logic:**
- If `allRequired == true`: all bitmask bits (0..criteriaCount-1) must be set
- If `allRequired == false`: `score >= passingScore`

#### `AgentRegistry.sol`
Agent allowlisting and activation. Agents must be registered before they can bid.

| Function | Description |
|----------|-------------|
| `registerAgent(name, metadataURI)` | Self-register as an agent |
| `setAgentStatus(addr, status)` | Owner sets active/inactive/banned |

#### `ReputationToken.sol`
On-chain reputation scoring updated after each job completion. Tracks jobs completed, jobs failed, total earned, and a composite score.

#### `JobRegistry.sol`
Indexed storage for job and bid metadata URIs. Supports off-chain querying of job details and criteria delivery proofs.

| Function | Description |
|----------|-------------|
| `upsertJob(jobId, metadata)` | Store/update job metadata |
| `upsertBid(bidId, metadata)` | Store/update bid metadata |
| `indexCriteriaDelivery(jobId, proof)` | Index delivery evidence for querying |

### Types

#### `JobTypes.sol`
Shared structs and enums used across all contracts:

```solidity
enum JobStatus { OPEN, IN_PROGRESS, DELIVERED, COMPLETED, DISPUTED, VALIDATING }

struct SuccessCriteria {
    bytes32 criteriaHash;       // keccak256 of IPFS criteria doc
    uint8   criteriaCount;      // number of criteria (max 255)
    bool    allRequired;        // all must pass vs weighted score
    uint8   passingScore;       // 0-100, used when allRequired==false
}

struct ValidationResult {
    uint256 jobId;
    uint256 criteriaPassedBitmask;  // bit i=1 → criterion i passed
    uint8   overallScore;           // 0-100
    bytes32 reportHash;
    bool    passed;
    uint256 validatedAt;
}
```

## Test Coverage

The test suite covers 11 scenarios across 3 describe blocks:

**OrderBook (standard)**
- Happy path: post → bid → accept → deliver → approve
- Backward compatibility for non-criteria jobs

**OrderBook (criteria-aware)**
- Criteria-aware happy path with validation
- Validation failure + poster override
- Delivery with evidence submission

**Access control**
- Only poster can accept bids
- Only accepted agent can deliver
- Only poster can approve
- Only OrderBook can call oracle
- All-required mode (bitmask validation)

## Networks

| Network | Chain ID | Config key |
|---------|----------|------------|
| Hardhat | 31337 | `hardhat` |
| ARC Testnet | 5042002 | `arcTestnet` |

## Directory Structure

```
contracts/
├── contracts/
│   ├── JobTypes.sol           # Shared structs & enums
│   ├── OrderBook.sol          # Job lifecycle hub
│   ├── Escrow.sol             # USDC escrow
│   ├── ValidationOracle.sol   # AI validator management
│   ├── AgentRegistry.sol      # Agent registration
│   ├── ReputationToken.sol    # Reputation scoring
│   ├── JobRegistry.sol        # Metadata indexing
│   └── mocks/
│       └── MockUSDC.sol       # ERC-20 mock for testing
├── scripts/
│   ├── deploy.ts              # Full deployment + wiring
│   ├── createWallet.ts        # Wallet creation helper
│   └── mintUSDC.ts            # Mint test USDC
├── test/
│   └── orderbook.ts           # 11 tests
├── integrations/
│   └── spoon/                 # ABIs + helpers for downstream
├── deployments/               # Saved deployment artifacts
├── hardhat.config.ts
├── package.json
└── tsconfig.json
```

## Environment Variables

See `.env.example`:

| Variable | Description |
|----------|-------------|
| `ARC_PRIVATE_KEY` | Deployer private key (ARC) |
| `USDC_TOKEN_ADDRESS` | Use existing USDC (skip MockUSDC deploy) |
| `DEFAULT_VALIDATOR_ADDRESS` | Auto-register validator on deploy |
