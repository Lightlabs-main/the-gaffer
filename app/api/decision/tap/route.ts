/**
 * POST /api/decision/tap
 *
 * Body: { sessionId, optionId, amount?, ts? }
 *
 * Records a single "tap" against the currently-open decision window. This is
 * the primitive that lets Phase 4's self-audit construct scenarios for each
 * confidence level.
 *
 * Phase 5 will introduce `/api/decision/stream` protected by @x402/next.
 * That endpoint, on successful x402 settlement, calls the same `recordTap()`
 * helper this route uses — so the engine sees real money flow, not a
 * separate test path.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import { recordTap } from '@/lib/decision-lifecycle'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  optionId?: string
  amount?: number
  ts?: number
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Body
  if (!body.sessionId || !body.optionId) {
    return NextResponse.json({ error: 'sessionId and optionId required' }, { status: 400 })
  }
  const session = getSession(body.sessionId)
  if (!session) {
    return NextResponse.json({ error: 'session not found' }, { status: 404 })
  }
  const result = recordTap(session, {
    optionId: body.optionId,
    amount: body.amount ?? 0.0001,
    ts: body.ts,
  })
  if (!result.accepted) {
    return NextResponse.json({ accepted: false, reason: result.reason }, { status: 409 })
  }
  return NextResponse.json({ accepted: true, totalForOption: result.totalForOption })
}
