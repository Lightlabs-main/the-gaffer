# The Gaffer

**The crowd decides. Money is the steering wheel.**

The Gaffer is a live virtual football match manager where spectators collectively control one team's tactics through USDC micropayments. Players hold a button to stream money toward their preferred tactical option — formation changes, pressing triggers, mentality shifts — and the option that attracts the most money wins. An AI manager (Claude) reads the crowd's financial signal, announces the decision in a football-manager voice, then simulates what happens next on the pitch. The simulation genuinely changes based on the tactic chosen.

Built for the **Lepton Agents Hackathon** (Canteen x Circle x Arc, June 2026).

---

## How It Works

### The Match

A 90-minute virtual football match compressed into ~30 real-world minutes (1 match minute = 20 seconds). The home team is crowd-controlled; the away team plays autonomously.

### Decision Windows

Eight decision windows open during the match at minutes 10, 20, 30, 40, 55, 65, 75, and 85 — each lasting 30 seconds of real time. Window types rotate through:

| Window | Type | Example Prompt |
|--------|------|----------------|
| 1 | Formation | "Switch shape?" — 4-3-3 vs 4-4-2 |
| 2 | Mentality | "How do we play this spell?" — Attacking vs Defensive |
| 3 | Pressing | "Pressing trigger?" — High press vs Sit off |
| 4 | Substitution | "Make a change?" — Bring on striker vs Stick with XI |
| 5 | Set-Piece | "Free-kick on the edge" — Shoot direct vs Whip it in |
| 6 | Crisis | "We just conceded — react?" — All-out attack vs Steady the ship |
| 7 | Push-or-Hold | "Late on, do we go again?" — Push for another vs Hold |
| 8 | Formation | Back to formation decisions |

### Streaming Payments

Each participant gets a custodial wallet pre-funded with test USDC — no MetaMask, no seed phrases, no Web3 knowledge required. During a decision window, holding a button streams **$0.0001 USDC per 500ms** toward your chosen option via Circle's x402 payment protocol. Taps are only recorded after successful on-chain settlement. The option that accumulates the most money wins.

### Crowd Confidence

The decision engine calculates how the crowd felt about the outcome:

| Confidence | Condition | Manager Tone |
|------------|-----------|--------------|
| **Decisive** | Winner > 65% of volume | Absolute conviction |
| **Narrow** | Winner 50–65% | Hesitant, cautious |
| **Divided** | Top two within 10 points | Frustrated at the split crowd |
| **Reversal** | Leader flipped in final 10s | Dramatic acknowledgment |

### AI Manager

Claude reads the money signal — not just who won, but *how clearly* the crowd spoke — and delivers a 2–4 sentence football-manager monologue. A decisive 80/20 split gets a confident team talk. A 52/48 split gets a frustrated manager questioning his players. A last-second reversal gets dramatic commentary about the crowd changing its mind.

### Match Simulation

After each decision, Claude simulates the next stretch of the match. The simulation is genuinely influenced by the current tactical state: an attacking mentality with a high press produces more chances and goals; a defensive setup with low pressing produces more blocks and clearances. Events (goals, chances, cards, injuries) are generated as structured data and broadcast to all connected clients.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Next.js App Router                          │
│                                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────────────────┐    │
│  │  Home    │   │  Match Room  │   │    API Routes            │    │
│  │ page.tsx │   │ match-room   │   │                          │    │
│  │          │   │   .tsx       │   │  /session/create  POST   │    │
│  │ Create / │   │              │   │  /session/[id]    GET    │    │
│  │  Join    │   │  Scoreboard  │   │  /wallet/create   POST   │    │
│  │          │   │  Manager     │   │  /wallet/participant POST│    │
│  │          │   │  Decision    │   │  /match/start     POST   │    │
│  │          │   │  Commentary  │   │  /match/events    GET←SSE│    │
│  │          │   │  Wallet      │   │  /decision/stream POST   │    │
│  └──────────┘   └──────┬───────┘   │  /decision/close  POST   │    │
│                        │           │  /manager/speak   POST   │    │
│                        │ SSE       │  /match/simulate  POST   │    │
│                        ▼           └──────────┬───────────────┘    │
│               EventSource ←───────── broadcast()                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
          ▼                 ▼                  ▼
   ┌─────────────┐  ┌─────────────┐   ┌──────────────┐
   │  Anthropic   │  │   Circle    │   │  Arc Testnet │
   │  Claude API  │  │   DCW API   │   │   (viem)     │
   │              │  │             │   │              │
   │  Manager     │  │  Wallets    │   │  chainId     │
   │  speech      │  │  Signing    │   │  5042002     │
   │              │  │  x402 batch │   │              │
   │  Match       │  │  Gateway    │   │  USDC reads  │
   │  simulation  │  │  settlement │   │  balance     │
   └─────────────┘  └─────────────┘   └──────────────┘
```

### Core Modules

| Module | Path | Responsibility |
|--------|------|---------------|
| **Match Engine** | `lib/match-engine.ts` | Orchestrates the 90-minute lifecycle — clock ticks, status transitions (first-half → half-time → second-half → full-time), decision window scheduling, simulation triggers |
| **Decision Engine** | `lib/decision-engine.ts` | Pure function that reads tap history and outputs winner + confidence level. No side effects, fully testable |
| **Decision Lifecycle** | `lib/decision-lifecycle.ts` | Opens/closes windows, records taps, manages auto-close timers |
| **Match Simulator** | `lib/match-simulator.ts` | Calls Claude to generate 2–4 match events per segment, biased by current formation/mentality/pressing |
| **AI Manager** | `lib/manager.ts` | Generates football-manager monologues via Claude, tone-matched to crowd confidence |
| **Tactic Mapping** | `lib/tactic-mapping.ts` | Deterministic lookup table: decision result → match state mutation. No LLM in the loop |
| **Window Catalog** | `lib/window-catalog.ts` | Decision templates, schedule (minutes 10–85), type rotation |
| **Circle Integration** | `lib/circle.ts` | Developer-controlled wallet creation, treasury transfers, typed data signing |
| **Gateway** | `lib/gateway.ts` | Circle Gateway deposits, x402 batching, EIP-712 authorization signing |
| **Batch Signer** | `lib/dcw-batch-signer.ts` | Signs `TransferWithAuthorization` payloads via Circle's signTypedData API |
| **Chain Client** | `lib/chain.ts` | Viem public client for Arc Testnet — balance reads, allowance checks, tx confirmations |
| **SSE** | `lib/sse.ts` | Server-sent event helpers — client registration, heartbeats, typed broadcasts |
| **Session Store** | `lib/session-store.ts` | In-memory `Map<sessionId, Session>` — no database |
| **Participant Store** | `lib/participant-store.ts` | In-memory per-session wallet registry |
| **Types** | `lib/types.ts` | Shared TypeScript interfaces for match state, events, decisions, wallets |

### UI Components

| Component | Responsibility |
|-----------|---------------|
| `Scoreboard` | Live score, match minute, status indicator (HALF TIME, FULL TIME) |
| `DecisionWindow` | Countdown timer, two streaming bars, hold-to-stream interaction |
| `StreamingBar` | Per-option progress bar with USDC totals, percentage fill, hold interaction |
| `ManagerSpeech` | Fading speech bubble for the AI manager's monologue (8s auto-fade) |
| `MatchCommentary` | Scrollable event feed with icons for goals, chances, cards, injuries |
| `WalletStatus` | Connection indicator (green/yellow/red), truncated address, earnings display |

---

## Data Flow

### Payment Pipeline (per tap)

```
User holds button (500ms interval)
  → POST /api/decision/stream { sessionId, optionId, participantWalletId }
    → Build PaymentRequirements (scheme: "exact", network: "eip155:5042002")
    → DcwBatchSigner signs EIP-712 TransferWithAuthorization via Circle API
    → BatchEvmScheme creates signed payload
    → BatchFacilitatorClient.settle() → Circle Gateway testnet
    → Settlement succeeds?
      → Yes: recordTap() → broadcast 'tap' SSE event
      → No:  tap rejected, nothing recorded
```

### Decision Resolution

```
Window opens (30s timer starts)
  → Taps accumulate (only settled payments count)
  → Timer expires → closeDecisionWindow()
    → decide() runs on tap history
      → Output: winnerId, confidence, signal, breakdown
    → Broadcast 'decision-closed' SSE event
    → produceManagerVerdict() → Claude generates speech
      → Broadcast 'manager-spoke' SSE event
    → applyTactic() → deterministic state mutation
    → simulateMatchSegment() → Claude generates match events
      → Broadcast 'simulation' SSE event
```

### Real-Time Communication

All client updates flow through Server-Sent Events (SSE). No WebSockets.

| Event | Payload |
|-------|---------|
| `hello` | Full match state on connect |
| `match-started` | Match state at kick-off |
| `clock-tick` | Current minute + status |
| `status-change` | Half-time, second-half, full-time transitions |
| `decision-opened` | Window type, prompt, options |
| `tap` | Updated option total after successful payment |
| `decision-closed` | Engine result with winner + confidence |
| `manager-spoke` | Speech text + applied tactic mutation |
| `simulation` | Array of match events + updated score |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Fonts | Geist Sans + Geist Mono |
| AI | Anthropic Claude Sonnet 4.6 (`@anthropic-ai/sdk`) |
| Wallets | Circle Developer-Controlled Wallets (`@circle-fin/developer-controlled-wallets`) |
| Payments | Circle x402 batching (`@circle-fin/x402-batching`, `@x402/core`, `@x402/evm`, `@x402/next`) |
| Chain | Arc Testnet (chainId `5042002`, RPC `https://arc-testnet.drpc.org`) |
| USDC Contract | `0x3600000000000000000000000000000000000000` |
| On-chain reads | viem |
| Animations | Framer Motion |
| IDs | uuid v14 |
| Persistence | In-memory (no database) |
| Real-time | Server-Sent Events (no WebSockets) |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Circle developer account with API key
- An Anthropic API key

### Environment Variables

Create `.env.local` in the project root:

```env
CIRCLE_API_KEY=TEST_API_KEY:your-circle-api-key
ENTITY_SECRET=your-entity-secret
CIRCLE_WALLET_SET_ID=your-wallet-set-id
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
ANTHROPIC_MODEL=claude-opus-4-8
NEXT_PUBLIC_APP_URL=http://localhost:3000
TREASURY_WALLET_ID=your-treasury-wallet-id
TREASURY_ADDRESS=0xyour-treasury-address
```

### Setup

```bash
# Install dependencies
npm install

# Configure Circle wallets (creates wallet set, entity secret, treasury wallet)
npm run setup:circle

# Install the Canteen ARC CLI used by the Lepton hackathon context
npm run setup:arc-cli

# Verify wallet setup
npm run verify:wallet

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run setup:circle` | Configure Circle wallets and entity secret |
| `npm run setup:arc-cli` | Install the Canteen ARC CLI via `uv tool install git+https://github.com/the-canteen-dev/ARC-cli` |
| `npm run verify:wallet` | Verify wallet endpoints are working |
| `npm run test:decision-engine` | Run confidence-level test scenarios |
| `npm run test:phase5` | Test x402 payment pipeline |

---

## Type System

### Match State

```typescript
interface MatchState {
  id: string
  creatorWalletId: string
  creatorAddress: string
  homeTeam: {
    name: string
    score: number
    formation: '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '5-3-2'
    mentality: 'attacking' | 'balanced' | 'defensive'
    pressing: 'high' | 'mid' | 'low'
  }
  awayTeam: {
    name: string
    score: number
    formation: Formation
  }
  minute: number  // 0–90
  status: 'pre-match' | 'first-half' | 'half-time' | 'second-half' | 'full-time'
  events: MatchEvent[]
  currentDecision?: DecisionWindow
  totalEarned: number
}
```

### Decision Engine I/O

```typescript
// Input
interface EngineInput {
  options: { id: string; label: string }[]
  taps: { optionId: string; amount: number; ts: number }[]
  windowClosesAt: number
  surgeWindowMs?: number  // default 10,000ms
}

// Output
interface EngineResult {
  winnerId: string
  winnerLabel: string
  confidence: 'decisive' | 'narrow' | 'divided' | 'reversal'
  winnerShare: number    // 0..1
  totalStreamed: number
  signal: string         // plain-English summary
  breakdown: {
    id: string
    label: string
    total: number
    share: number
    finalSurge: number
  }[]
}
```

### Match Events

```typescript
interface MatchEvent {
  id: string
  minute: number
  type: 'goal' | 'goal-conceded' | 'chance' | 'card' | 'injury' | 'substitution' | 'commentary'
  text: string
  isGoal?: boolean
}
```

---

## API Reference

### Sessions

**`POST /api/session/create`**

Creates a new match session with a Circle custodial wallet for the creator.

Response:
```json
{
  "sessionId": "uuid",
  "walletAddress": "0x...",
  "matchState": { ... }
}
```

**`GET /api/session/[id]`**

Returns session metadata and current match state.

### Wallets

**`POST /api/wallet/participant`**

Creates a custodial wallet for a joining participant, funds it from treasury, and deposits into Circle Gateway.

Request: `{ "sessionId": "uuid" }`

Response:
```json
{
  "participant": {
    "walletId": "uuid",
    "address": "0x...",
    "treasuryFundedUsdc": "0.5",
    "gatewayDepositedUsdc": "0.3"
  }
}
```

### Match Control

**`POST /api/match/start`**

Boots the match engine. Starts the clock and begins the 90-minute lifecycle.

Request: `{ "sessionId": "uuid" }`

**`GET /api/match/events?sessionId=uuid`**

SSE stream. Returns a `text/event-stream` connection that broadcasts all match events in real time.

### Decisions

**`POST /api/decision/stream`**

Streams a micropayment toward a decision option. Settles via Circle Gateway x402 — tap is only recorded on successful settlement.

Request:
```json
{
  "sessionId": "uuid",
  "optionId": "uuid",
  "participantWalletId": "uuid",
  "amountUsdc": "0.0001"
}
```

**`POST /api/decision/close`**

Manually closes the current decision window (auto-closes after 30s).

---

## Design Decisions

**Why SSE over WebSockets?** SSE is simpler to deploy (no upgrade handshake), works behind proxies and CDNs out of the box, and auto-reconnects natively. The data flow is unidirectional (server → client), which is all we need — client actions use POST requests.

**Why in-memory stores?** This is a hackathon entry for live demos. A single match session runs for ~30 minutes. In-memory Maps are fast, zero-config, and sufficient for the scope. No ORM, no migrations, no connection pooling.

**Why custodial wallets?** The target audience is "anyone with a browser." MetaMask, seed phrases, and gas tokens are barriers to entry. Circle's developer-controlled wallets let users stream payments with zero Web3 setup.

**Why deterministic tactic mapping?** The LLM generates narrative (speech, events), but tactical state changes are a mechanical lookup table. This ensures the simulation input is predictable and auditable — you can read `tactic-mapping.ts` and know exactly what "Attacking wins" does to the match state.

**Why confidence levels?** A flat "Option A wins" ignores the drama. Was it a landslide? A coin flip? A last-second reversal? The confidence system gives the AI manager something to *react to*, producing more authentic football-manager speeches.

---

## Project Structure

```
gaffer/
├── app/
│   ├── api/
│   │   ├── decision/
│   │   │   ├── close/route.ts       # Close decision window
│   │   │   ├── current/route.ts     # Get current window
│   │   │   ├── open/route.ts        # Open window
│   │   │   ├── stream/route.ts      # x402 payment endpoint
│   │   ├── manager/
│   │   │   └── speak/route.ts       # Manual manager speech
│   │   ├── match/
│   │   │   ├── broadcast/route.ts   # Manual broadcast
│   │   │   ├── events/route.ts      # SSE stream
│   │   │   ├── simulate/route.ts    # Manual simulation
│   │   │   └── start/route.ts       # Boot match engine
│   │   ├── session/
│   │   │   ├── [id]/route.ts        # Get session
│   │   │   └── create/route.ts      # Create session
│   │   └── wallet/
│   │       ├── create/route.ts      # Standalone wallet
│   │       └── participant/route.ts # Participant wallet + deposit
│   ├── session/
│   │   └── [id]/
│   │       ├── page.tsx             # Server component wrapper
│   │       └── match-room.tsx       # Client-side match UI
│   ├── globals.css                  # Tailwind + CSS custom properties
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Home — create or join
├── components/
│   ├── DecisionWindow.tsx           # Hold-to-stream decision UI
│   ├── ManagerSpeech.tsx            # Fading AI manager bubble
│   ├── MatchCommentary.tsx          # Live event feed
│   ├── Scoreboard.tsx               # Score + minute display
│   ├── StreamingBar.tsx             # Per-option payment bar
│   └── WalletStatus.tsx             # Wallet indicator
├── lib/
│   ├── anthropic.ts                 # Claude SDK singleton
│   ├── chain.ts                     # Arc Testnet viem client
│   ├── circle.ts                    # Circle DCW operations
│   ├── dcw-batch-signer.ts          # EIP-712 batch signer
│   ├── decision-engine.ts           # Tap aggregation + confidence
│   ├── decision-lifecycle.ts        # Window open/close/tap
│   ├── env.ts                       # Environment variable loader
│   ├── gateway.ts                   # Circle Gateway deposits
│   ├── manager.ts                   # AI manager speech generation
│   ├── match-engine.ts              # 90-minute match orchestrator
│   ├── match-simulator.ts           # Claude event generation
│   ├── participant-store.ts         # Per-session wallet registry
│   ├── session-store.ts             # In-memory session store
│   ├── sse.ts                       # Server-sent event helpers
│   ├── tactic-mapping.ts            # Decision → state mutations
│   ├── types.ts                     # TypeScript interfaces
│   └── window-catalog.ts            # Decision templates + schedule
├── scripts/
│   ├── setup-circle.ts              # Circle wallet setup CLI
│   ├── verify-wallet.ts             # Wallet verification
│   ├── test-decision-engine.ts      # Decision engine tests
│   └── test-phase5.ts               # x402 payment tests
├── package.json
├── tsconfig.json
├── next.config.ts
└── postcss.config.mjs
```

---

## License

Hackathon project — Lepton Agents Hackathon (Canteen x Circle x Arc, June 2026).
