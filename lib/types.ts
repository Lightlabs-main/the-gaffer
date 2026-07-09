export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '5-3-2'
export type Mentality = 'attacking' | 'balanced' | 'defensive'
export type PressingStyle = 'high' | 'mid' | 'low'
export type { ExperienceType, RoomKind } from './experience-formats'

export interface DecisionOption {
  id: string
  label: string
  description: string
  totalStreamed: number
  streamingRate: number
  lastUpdated: number
}

export interface DecisionTap {
  optionId: string
  amount: number
  ts: number
  note?: string
}

export interface DecisionWindow {
  id: string
  type:
    | 'formation'
    | 'mentality'
    | 'pressing'
    | 'substitution'
    | 'set-piece'
    | 'crisis'
    | 'push-or-hold'
  prompt: string
  options: DecisionOption[]
  opensAt: number
  closesAt: number
  isOpen: boolean
  taps?: DecisionTap[]
  result?: string
  managerSpeech?: string
}

export interface MatchEvent {
  id: string
  minute: number
  type:
    | 'goal'
    | 'goal-conceded'
    | 'chance'
    | 'card'
    | 'injury'
    | 'substitution'
    | 'commentary'
  text: string
  isGoal?: boolean
}

export interface CrowdChoiceMemory {
  windowId: string
  minute: number
  type: DecisionWindow['type']
  winnerLabel: string
  confidence: string
  winnerShare: number
  totalStreamed: number
  risk: string
  executed: string
}

export interface OpponentCoachState {
  tendency: 'wide_attack' | 'central_control' | 'high_press' | 'protect_lead' | 'mixed'
  reaction: string
  tacticalShift: string
  updatedAtMinute: number
  wideAttackCount: number
  centralControlCount: number
  highPressCount: number
}

export interface MatchState {
  id: string
  experienceType: import('./experience-formats').ExperienceType
  roomKind: import('./experience-formats').RoomKind
  experienceLabel: string
  experienceSummary: string
  seedTitle?: string
  seedTopic?: string
  seedContent?: string
  dailyRoomUrl?: string
  accessPriceUsdc?: string
  steerPriceUsdc?: string
  unlockedWallets?: string[]
  branches?: MediaBranch[]
  creatorWalletId: string
  creatorAddress: string
  homeTeam: {
    name: string
    score: number
    formation: Formation
    mentality: Mentality
    pressing: PressingStyle
  }
  awayTeam: {
    name: string
    score: number
    formation: Formation
  }
  minute: number
  status: 'pre-match' | 'first-half' | 'half-time' | 'second-half' | 'full-time'
  events: MatchEvent[]
  currentDecision?: DecisionWindow
  totalEarned: number
  crowdChoices?: CrowdChoiceMemory[]
  opponentCoach?: OpponentCoachState
}

export interface MediaBranchScene {
  title: string
  visual: string
  caption: string
  sceneNumber?: number | string
  chapterTitle?: string
  narration?: string
  visualDescription?: string
  imagePrompt?: string
}

export interface MediaBranch {
  id: string
  walletId: string
  address: string
  prompt: string
  kind: 'article-branch' | 'video-director' | 'storyboard-video'
  title: string
  summary: string
  body: string
  scenes?: MediaBranchScene[]
  amountUsdc: string
  settlementId?: string
  createdAt: number
  model?: string
  requestId?: string | null
  latencyMs?: number
}

export type ProvenanceCategory =
  | 'session'
  | 'window'
  | 'stream'
  | 'signal'
  | 'manager'
  | 'simulation'
  | 'result'
  | 'wallet'
  | 'access'
  | 'branch'

export interface ProvenanceEvent {
  id: string
  ts: number
  minute: number
  category: ProvenanceCategory
  title: string
  detail: string
  data?: Record<string, unknown>
}

export interface UserWallet {
  walletId: string
  address: string
  balance: number
}

export interface Session {
  id: string
  matchState: MatchState
  participants: number
  createdAt: number
  provenanceEvents: ProvenanceEvent[]
  sseClients: Set<ReadableStreamDefaultController>
}
