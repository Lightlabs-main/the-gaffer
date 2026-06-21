/**
 * POST /api/decision/stream
 *
 * Body: { sessionId: string, optionId: string, participantWalletId: string,
 *         amountUsdc?: string }
 *
 * This is The Gaffer's actual money endpoint. One call performs a real
 * Circle Gateway-batched x402 payment from a participant's custodial wallet
 * to the session creator's wallet, and only when Circle Gateway returns
 * `success: true` does the engine count the tap.
 *
 * Pipeline:
 *   1. Look up the session and the participant wallet in the in-memory
 *      registries; reject if either is missing or if the requested decision
 *      option is not part of the currently-open window.
 *   2. Build `PaymentRequirements` for Circle batching on Arc Testnet —
 *      payTo is the *session creator's* on-chain address; amount defaults
 *      to 0.0001 USDC (100 atomic units, the per-tap spec amount).
 *   3. Construct a `BatchEvmScheme` backed by `DcwBatchSigner`, which is
 *      our adapter that signs EIP-712 TransferWithAuthorization via Circle's
 *      `signTypedData` API instead of an in-process private key.
 *   4. `createPaymentPayload(...)` produces the signed payload.
 *   5. `BatchFacilitatorClient.settle(...)` posts that payload to Circle
 *      Gateway's testnet facilitator. The response includes the on-chain
 *      transaction string used in the batch settlement.
 *   6. Only on success do we `recordTap()`, which broadcasts the SSE `tap`
 *      event the UI listens for.
 *
 * Anti-fake notes:
 *   - There is NO branch that calls recordTap without a successful settle.
 *   - The returned `settlement.transaction` is the actual reference the
 *     Gateway facilitator returns — caller can independently verify it.
 *   - If anything in the pipeline throws (invalid signature, insufficient
 *     gateway balance, network) the caller sees the real error string from
 *     Circle, not a synthesized success.
 */
import { NextResponse } from 'next/server'
import { BatchEvmScheme } from '@circle-fin/x402-batching/client'
import { parseUnits } from 'viem'
import { getSession } from '@/lib/session-store'
import { getParticipant } from '@/lib/participant-store'
import { recordTap } from '@/lib/decision-lifecycle'
import {
  buildBatchingPaymentRequirements,
  getBatchFacilitatorClient,
} from '@/lib/gateway'
import { DcwBatchSigner } from '@/lib/dcw-batch-signer'

export const dynamic = 'force-dynamic'

interface Body {
  sessionId?: string
  optionId?: string
  participantWalletId?: string
  amountUsdc?: string // decimal, default "0.0001"
}

const X402_VERSION = 1

export async function POST(req: Request): Promise<NextResponse> {
  let stage = 'parse'
  try {
    const body = (await req.json().catch(() => ({}))) as Body
    if (!body.sessionId || !body.optionId || !body.participantWalletId) {
      return NextResponse.json(
        {
          error:
            'sessionId, optionId and participantWalletId are required',
        },
        { status: 400 },
      )
    }
    const session = getSession(body.sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'session not found', sessionId: body.sessionId },
        { status: 404 },
      )
    }
    const decision = session.matchState.currentDecision
    if (!decision || !decision.isOpen) {
      return NextResponse.json(
        { error: 'no open decision window for this session' },
        { status: 409 },
      )
    }
    if (!decision.options.some((o) => o.id === body.optionId)) {
      return NextResponse.json(
        {
          error: 'optionId is not part of the current decision window',
          validOptions: decision.options.map((o) => o.id),
        },
        { status: 400 },
      )
    }
    const participant = getParticipant(
      session.id,
      body.participantWalletId,
    )
    if (!participant) {
      return NextResponse.json(
        {
          error:
            'participant wallet not registered for this session — call /api/wallet/participant first',
        },
        { status: 404 },
      )
    }

    stage = 'build-requirements'
    const amountDecimal = body.amountUsdc ?? '0.0001'
    const amountAtomic = parseUnits(amountDecimal, 6).toString()
    const requirements = buildBatchingPaymentRequirements({
      payTo: session.matchState.creatorAddress as `0x${string}`,
      amountAtomic,
    })

    stage = 'sign-payload'
    const signer = new DcwBatchSigner(
      participant.walletId,
      participant.address,
    )
    const scheme = new BatchEvmScheme(signer)
    const signed = await scheme.createPaymentPayload(
      X402_VERSION,
      requirements,
    )

    stage = 'settle'
    const facilitator = getBatchFacilitatorClient()
    // `BatchEvmScheme.createPaymentPayload` returns the minimal
    // `{x402Version, payload}` shape that an `x402Client` would post inside
    // an HTTP `X-Payment` header. Circle's Gateway facilitator additionally
    // requires `resource` and `accepted` on the settle body — fields that
    // the x402Client transport normally injects from the original 402
    // response. We are bypassing that transport (server-driven flow), so we
    // synthesize them here from the same requirements we just signed.
    const settlePayload = {
      x402Version: signed.x402Version,
      resource: {
        url: `${new URL(req.url).origin}/api/decision/stream`,
        description: `Tap for option ${body.optionId} in session ${session.id}`,
        mimeType: 'application/json',
      },
      accepted: requirements,
      payload: signed.payload as unknown as Record<string, unknown>,
    }
    const settle = await facilitator.settle(
      settlePayload,
      requirements,
    )
    if (!settle.success) {
      return NextResponse.json(
        {
          stage,
          settled: false,
          error: settle.errorReason ?? 'settlement failed',
          settle,
        },
        { status: 402 },
      )
    }

    stage = 'record-tap'
    const tap = recordTap(session, {
      optionId: body.optionId,
      amount: Number(amountDecimal),
    })
    if (!tap.accepted) {
      // Settlement succeeded but window closed mid-flight (race). Surface honestly.
      return NextResponse.json(
        {
          stage,
          settled: true,
          tapAccepted: false,
          reason: tap.reason,
          settle,
        },
        { status: 200 },
      )
    }

    return NextResponse.json({
      sessionId: session.id,
      optionId: body.optionId,
      amountUsdc: amountDecimal,
      amountAtomic,
      participantWalletId: participant.walletId,
      payTo: session.matchState.creatorAddress,
      settle: {
        success: settle.success,
        transaction: settle.transaction,
        network: settle.network,
        payer: settle.payer,
      },
      tap: {
        accepted: true,
        totalForOption: tap.totalForOption,
      },
    })
  } catch (err: unknown) {
    const anyErr = err as {
      message?: string
      code?: string | number
      status?: number
      response?: { status?: number; data?: unknown }
    }
    const info = {
      stage,
      message: anyErr.message ?? String(err),
      details: {
        code: anyErr.code ?? null,
        status: anyErr.status ?? anyErr.response?.status ?? null,
        responseData: anyErr.response?.data ?? null,
      },
    }
    console.error('[decision/stream] failed at stage', stage, info)
    return NextResponse.json(info, { status: 500 })
  }
}
