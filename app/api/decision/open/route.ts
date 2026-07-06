/**
 * POST /api/decision/open
 *
 * Body: { sessionId: string, type?: DecisionWindowType, windowIndex?: number,
 *         durationMs?: number }
 *
 * Opens a fresh decision window on the session. Used directly by the Phase 7
 * match engine (which schedules windows at the spec'd match minutes); also
 * exposed here so the Phase 4 self-audit can open a window on demand and
 * watch it auto-close 30s later.
 *
 * `type` overrides catalog selection; `windowIndex` (0..7) picks from the
 * rotation; `durationMs` lets tests run faster than the spec'd 30s.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session-store'
import { openDecisionWindow } from '@/lib/decision-lifecycle'
import {
  buildDecisionWindow,
  windowTypeForIndex,
  WINDOW_OPEN_DURATION_MS,
} from '@/lib/window-catalog'
import type { DecisionWindow } from '@/lib/types'

export const dynamic = 'force-dynamic'

const VALID_TYPES: DecisionWindow['type'][] = [
  'formation',
  'mentality',
  'pressing',
  'substitution',
  'set-piece',
  'crisis',
  'push-or-hold',
]

interface Body {
  sessionId?: string
  type?: DecisionWindow['type']
  windowIndex?: number
  durationMs?: number
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Body
  if (!body.sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }
  const session = await getSession(body.sessionId)
  if (!session) {
    return NextResponse.json({ error: 'session not found', sessionId: body.sessionId }, { status: 404 })
  }
  let type: DecisionWindow['type']
  if (body.type) {
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: 'invalid type', valid: VALID_TYPES }, { status: 400 })
    }
    type = body.type
  } else if (typeof body.windowIndex === 'number') {
    type = windowTypeForIndex(body.windowIndex)
  } else {
    type = 'formation'
  }

  const opensAt = Date.now()
  const window = buildDecisionWindow(type, opensAt)
  if (body.durationMs && body.durationMs > 0) {
    window.closesAt = opensAt + body.durationMs
  }
  const opened = openDecisionWindow(session, window)
  return NextResponse.json({
    sessionId: session.id,
    window: opened,
    autoClosesAt: opened.closesAt,
    autoClosesInMs: opened.closesAt - Date.now(),
    specDurationMs: WINDOW_OPEN_DURATION_MS,
  })
}
