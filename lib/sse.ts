/**
 * Server-Sent Events helpers for The Gaffer.
 *
 * Each `Session` owns a `Set<ReadableStreamDefaultController>` of connected
 * clients. `addSseClient` / `removeSseClient` manage the set; `broadcast`
 * encodes a JSON payload as one SSE `data:` frame and pushes it to every
 * controller in the set. Dead controllers (those whose stream has already
 * been closed by the client) are pruned silently.
 *
 * Wire format: `data: {…JSON…}\n\n` — the canonical SSE event terminator.
 */
import type { Session } from './types'

const encoder = new TextEncoder()

function encodeFrame(payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
}

export function addSseClient(
  session: Session,
  controller: ReadableStreamDefaultController,
): void {
  session.sseClients.add(controller)
}

export function removeSseClient(
  session: Session,
  controller: ReadableStreamDefaultController,
): void {
  session.sseClients.delete(controller)
}

export function broadcast(session: Session, payload: unknown): number {
  const frame = encodeFrame(payload)
  let delivered = 0
  for (const ctrl of session.sseClients) {
    try {
      ctrl.enqueue(frame)
      delivered++
    } catch {
      // Stream already closed on the client side — remove the dead controller
      session.sseClients.delete(ctrl)
    }
  }
  return delivered
}

/**
 * Send an SSE comment line (`:\n\n`). Comments are ignored by the EventSource
 * spec but keep proxies and load-balancers from idling the connection out.
 */
export function heartbeat(session: Session): void {
  const beat = encoder.encode(`: keep-alive ${Date.now()}\n\n`)
  for (const ctrl of session.sseClients) {
    try {
      ctrl.enqueue(beat)
    } catch {
      session.sseClients.delete(ctrl)
    }
  }
}
