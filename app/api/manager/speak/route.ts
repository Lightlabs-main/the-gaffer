/**
 * POST /api/manager/speak
 *
 * Standalone endpoint to get an AI Manager speech for a closed decision.
 * Body: { sessionId: string }
 *
 * The match engine calls the manager automatically on window close,
 * but this route lets callers trigger it independently for testing.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import { produceManagerVerdict } from '@/lib/manager'
import { decide } from '@/lib/decision-engine'
import { getTaps } from '@/lib/decision-lifecycle'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }
    const session = getSession(body.sessionId)
    if (!session) {
      return NextResponse.json({ error: 'session not found' }, { status: 404 })
    }
    const decision = session.matchState.currentDecision
    if (!decision) {
      return NextResponse.json(
        { error: 'no decision window on this session' },
        { status: 409 },
      )
    }

    // Run the engine on recorded taps to get the verdict
    const taps = getTaps(session.id)
    const engine = decide({
      options: decision.options.map((o) => ({ id: o.id, label: o.label })),
      taps,
      windowClosesAt: decision.closesAt,
    })

    const verdict = await produceManagerVerdict({
      matchState: session.matchState,
      decision,
      engine,
    })

    return NextResponse.json({
      speech: verdict.speech,
      model: verdict.model,
      requestId: verdict.requestId,
      latencyMs: verdict.latencyMs,
      confidence: engine.confidence,
      winnerLabel: engine.winnerLabel,
      signal: engine.signal,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[manager/speak] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
