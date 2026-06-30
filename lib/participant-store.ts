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

const participantsBySession = new Map<string, Map<string, ParticipantWallet>>()

export function addParticipant(sessionId: string, p: ParticipantWallet): void {
  let bucket = participantsBySession.get(sessionId)
  if (!bucket) {
    bucket = new Map()
    participantsBySession.set(sessionId, bucket)
  }
  bucket.set(p.walletId, p)
}

export function getParticipant(
  sessionId: string,
  walletId: string,
): ParticipantWallet | undefined {
  return participantsBySession.get(sessionId)?.get(walletId)
}

export function listParticipants(sessionId: string): ParticipantWallet[] {
  return Array.from(participantsBySession.get(sessionId)?.values() ?? [])
}
