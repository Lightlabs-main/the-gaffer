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
