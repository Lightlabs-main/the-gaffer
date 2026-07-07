/**
 * Per-session participant wallet registry — in-memory, server-only.
 *
 * When a viewer joins a match session, their Circle developer-controlled
 * wallet is registered here. If they later fund and deposit it into Gateway,
 * that same wallet signs the x402 steering authorizations.
 *
 * We keep this side-store separate from `Session` because:
 *   - it's an implementation detail of payment routing;
 *   - the shared `Session` shape is broadcast over SSE to the UI and we
 *     don't want to leak walletIds into client-facing payloads.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Address } from 'viem'

export interface ParticipantWallet {
  walletId: string
  address: Address
  /** Decimal USDC deposited into the Circle GatewayWallet contract, if ready. */
  gatewayDepositedUsdc?: string
  approveTransactionId?: string
  depositTransactionId?: string
  createdAt: number
}

const STORE_DIR = join(process.cwd(), '.gaffer-store')
const STORE_FILE = join(STORE_DIR, 'participants.json')
const participantsBySession = new Map<string, Map<string, ParticipantWallet>>()
let loadedFromDisk = false

interface PersistedParticipantBucket {
  sessionId: string
  participants: ParticipantWallet[]
}

function ensureLoadedFromDisk(): void {
  if (loadedFromDisk) return
  loadedFromDisk = true
  if (!existsSync(STORE_FILE)) return

  try {
    const raw = readFileSync(STORE_FILE, 'utf8')
    const persisted = JSON.parse(raw) as PersistedParticipantBucket[]
    for (const bucket of persisted) {
      const sessionBucket = new Map<string, ParticipantWallet>()
      for (const participant of bucket.participants ?? []) {
        if (participant.walletId && participant.address) {
          sessionBucket.set(participant.walletId, participant)
        }
      }
      if (sessionBucket.size) participantsBySession.set(bucket.sessionId, sessionBucket)
    }
  } catch (err) {
    console.warn('[participant-store] could not load persisted participants', err)
  }
}

function saveAllToDisk(): void {
  try {
    mkdirSync(STORE_DIR, { recursive: true })
    const persisted = Array.from(participantsBySession.entries()).map(
      ([sessionId, bucket]) => ({
        sessionId,
        participants: Array.from(bucket.values()),
      }),
    )
    writeFileSync(STORE_FILE, JSON.stringify(persisted, null, 2))
  } catch (err) {
    console.warn('[participant-store] could not persist participants', err)
  }
}

export function addParticipant(sessionId: string, p: ParticipantWallet): void {
  ensureLoadedFromDisk()
  let bucket = participantsBySession.get(sessionId)
  if (!bucket) {
    bucket = new Map()
    participantsBySession.set(sessionId, bucket)
  }
  bucket.set(p.walletId, p)
  saveAllToDisk()
}

export function getParticipant(
  sessionId: string,
  walletId: string,
): ParticipantWallet | undefined {
  ensureLoadedFromDisk()
  return participantsBySession.get(sessionId)?.get(walletId)
}

export function listParticipants(sessionId: string): ParticipantWallet[] {
  ensureLoadedFromDisk()
  return Array.from(participantsBySession.get(sessionId)?.values() ?? [])
}
