/**
 * GET /api/match/events?sessionId=<id>
 *
 * Real Server-Sent Events stream for a single session. Behavior:
 *   - On connect: registers this connection's ReadableStreamDefaultController
 *     in `session.sseClients`, immediately sends a `hello` frame containing
 *     the current MatchState (so a late joiner sees the world).
 *   - On any broadcast (see lib/sse.ts): the same `data: {…}\n\n` frame is
 *     enqueued to every controller in the set.
 *   - On client disconnect (request abort): the controller is removed.
 *   - A keep-alive comment is sent every 25s to keep intermediary proxies
 *     from idling the connection out.
 *
 * No polling, no WebSockets — text/event-stream over HTTP.
 */
import { getSession } from '@/lib/session-store'
import { addSseClient, removeSseClient, heartbeat } from '@/lib/sse'

export const dynamic = 'force-dynamic'
// SSE must not be cached or aggregated by Next.
export const revalidate = 0

const HEARTBEAT_MS = 25_000

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId')
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'sessionId query param required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }
  const session = getSession(sessionId)
  if (!session) {
    return new Response(JSON.stringify({ error: 'session not found', sessionId }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let controllerRef: ReadableStreamDefaultController | null = null

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller
      addSseClient(session, controller)

      // Initial hello frame — current world state, so late joiners catch up.
      const hello = {
        kind: 'hello',
        sessionId: session.id,
        matchState: session.matchState,
        participants: session.participants,
        connectedClients: session.sseClients.size,
        provenanceEvents: session.provenanceEvents,
        serverTime: Date.now(),
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(hello)}\n\n`))

      heartbeatTimer = setInterval(() => heartbeat(session), HEARTBEAT_MS)

      req.signal.addEventListener('abort', () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        if (controllerRef) {
          removeSseClient(session, controllerRef)
          try {
            controller.close()
          } catch {
            // already closed
          }
        }
      })
    },
    cancel() {
      if (heartbeatTimer) clearInterval(heartbeatTimer)
      if (controllerRef) removeSseClient(session, controllerRef)
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}
