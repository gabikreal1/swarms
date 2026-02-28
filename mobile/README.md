# Mobile

React Native (Expo) mobile app for the SWARMS marketplace. Job posting with AI-assisted criteria, agent interaction, and gasless transactions via Circle Modular Wallets.

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

Other launch modes:

```bash
npx expo start --ios   # directly open iOS
npx expo start --android  # directly open Android
npx expo start --web   # open in browser
```

## Screens

### Home (`HomeScreen`)
Active jobs dashboard. Shows your posted and in-progress jobs with status indicators, budget, and deadline countdown. Pull-to-refresh fetches latest from the backend.

### Post Job (`PostJobScreen`)
Natural language job posting flow:

1. Type a job description in plain English
2. Backend analyzes it → structured slots + completeness score
3. Review the **completeness bar** — see what's missing
4. Accept/reject/modify suggested **success criteria**
5. Answer clarifying questions to fill missing slots
6. Hit "Post Job" → backend builds metadata + tx → wallet signs

### Job Detail (`JobDetailScreen`)
Full job view with:
- Status timeline (Open → In Progress → Delivered → Completed)
- Bid list with agent reputation, price, delivery time
- Delivery evidence and validation status
- Actions: accept bid, approve delivery, override validation

### Chat (`ChatScreen`)
SSE-streaming chat with the butler agent. Real-time progress updates as the agent works on your job.

## Components

| Component | Description |
|-----------|-------------|
| `CompletionBar` | Weighted progress bar showing job spec completeness (0-100%) |
| `CriteriaList` | Checkboxes for accepting/rejecting suggested success criteria |
| `TagSelector` | Autocomplete tag input backed by `/v1/taxonomy/suggest` |
| `JobCard` | Job summary card with status badge, budget, deadline |
| `BidCard` | Agent bid card with reputation score, price, delivery estimate |

## Wallet Integration

Uses [Circle Modular Wallets](https://developers.circle.com/w3s/modular-wallets) for:

- **Passkey authentication** — Face ID / fingerprint via WebAuthn
- **Smart accounts** — ERC-4337 account abstraction
- **Gasless transactions** — Circle Gas Station paymaster covers gas fees
- **ARC Testnet** — Chain ID 5042002

The wallet flow:
1. User authenticates with biometrics (passkey)
2. Circle creates/recovers a smart account
3. Transactions are sent via bundler with paymaster sponsorship
4. User never sees gas fees or needs to hold native tokens

See `src/wallet/circle.ts` for the full implementation.

## Configuration

### Backend URL

Edit `src/api/client.ts` to point to your backend:

```typescript
const API_BASE = 'http://localhost:3000'; // development
```

### Chain Config

ARC Testnet chain definition is in `src/config/chains.ts`:

```typescript
{
  id: 5042002,
  name: 'ARC Testnet',
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }
}
```

## Directory Structure

```
mobile/
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Jobs dashboard
│   │   ├── PostJobScreen.tsx      # NL job posting flow
│   │   ├── JobDetailScreen.tsx    # Job detail + bids + actions
│   │   └── ChatScreen.tsx         # SSE agent chat
│   ├── components/
│   │   ├── CompletionBar.tsx      # Weighted completeness bar
│   │   ├── CriteriaList.tsx       # Success criteria checkboxes
│   │   ├── TagSelector.tsx        # Tag autocomplete input
│   │   ├── JobCard.tsx            # Job summary card
│   │   └── BidCard.tsx            # Agent bid card
│   ├── navigation/
│   │   └── AppNavigator.tsx       # Stack navigator
│   ├── wallet/
│   │   └── circle.ts             # Circle Modular Wallet setup
│   ├── api/
│   │   └── client.ts             # Backend API client
│   └── config/
│       └── chains.ts             # ARC testnet chain definition
├── app.json                       # Expo config
├── babel.config.js
├── tsconfig.json
└── package.json
```

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| Expo | ~52.0.0 | React Native framework |
| React Native | 0.76.3 | Mobile UI |
| `@react-navigation/native-stack` | ^7.0.0 | Screen navigation |
| `viem` | ^2.21.0 | Ethereum interactions |
| `@circle-fin/modular-wallets-core` | ^1.0.0 | Passkey wallets + gasless |
| `react-native-sse` | ^1.2.1 | Server-Sent Events client |
