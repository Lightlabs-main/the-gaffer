/**
 * Per-session participant wallet registry — in-memory, server-only.
 *
 * When a viewer joins a match session they get their own developer-controlled
 * wallet (created on demand via /api/wallet/participant). That wallet is the
 * one whose signed EIP-3009 authorizations get settled through Circle
 * Gateway when the participant taps to stream USDC during a decision window.
 *
 * We keep this side-store separate from `Session` because:
 *   - it's an implementation detail of Phase 5 payments;
 *   - the shared `Session` shape is broadcast over SSE to the UI and we
 *     don't want to leak walletIds into client-facing payloads.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Address } from 'viem'

export interface ParticipantWallet {
  walletId: string
  address: Address
  /** Decimal USDC the treasury sent to this wallet on create. */
  treasuryFundedUsdc: string
  /** Decimal USDC deposited into the Circle GatewayWallet contract. */
  gatewayDepositedUsdc: string
  approveTransactionId: string
  depositTransactionId: string
  createdAt: number
}

const participantsBySession = new Map<string, Map<string, ParticipantWallet>>()

const STORE_DIR = join(process.cwd(), '.gaffer-store')
const STORE_FILE = join(STORE_DIR, 'participants.json')
let loadedFromDisk = false

function ensureLoaded(): void {
  if (loadedFromDisk) return
  loadedFromDisk = true
  if (!existsSync(STORE_FILE)) return

  try {
    const raw = readFileSync(STORE_FILE, 'utf8')
    const persisted = JSON.parse(raw) as Record<string, ParticipantWallet[]>
    for (const [sessionId, participants] of Object.entries(persisted)) {
      participantsBySession.set(
        sessionId,
        new Map(
          participants.map((participant) => [participant.walletId, participant]),
        ),
      )
    }
  } catch (err) {
    console.warn('[participant-store] could not load persisted participants', err)
  }
}

function saveAll(): void {
  try {
    mkdirSync(STORE_DIR, { recursive: true })
    const persisted: Record<string, ParticipantWallet[]> = {}
    for (const [sessionId, participants] of participantsBySession.entries()) {
      persisted[sessionId] = Array.from(participants.values())
    }
    writeFileSync(STORE_FILE, JSON.stringify(persisted, null, 2))
  } catch (err) {
    console.warn('[participant-store] could not persist participants', err)
  }
}

export function addParticipant(sessionId: string, p: ParticipantWallet): void {
  ensureLoaded()
  let bucket = participantsBySession.get(sessionId)
  if (!bucket) {
    bucket = new Map()
    participantsBySession.set(sessionId, bucket)
  }
  bucket.set(p.walletId, p)
  saveAll()
}

export function getParticipant(
  sessionId: string,
  walletId: string,
): ParticipantWallet | undefined {
  ensureLoaded()
  return participantsBySession.get(sessionId)?.get(walletId)
}

export function listParticipants(sessionId: string): ParticipantWallet[] {
  ensureLoaded()
  return Array.from(participantsBySession.get(sessionId)?.values() ?? [])
}
