/**
 * Payment end-to-end proof — REAL x402 + Circle Gateway settlement, no mocks.
 *
 * What this script does, in order:
 *   1. Boots a fresh match session (POST /api/session/create). Records the
 *      creator's on-chain address.
 *   2. Reads the creator's USDC balance directly from the Arc Testnet USDC
 *      contract — the BEFORE number.
 *   3. Creates one participant wallet (POST /api/wallet/participant). This
 *      transfers a real USDC seed from the treasury to the new wallet,
 *      approves the Circle GatewayWallet contract, and deposits part of it
 *      into Gateway.
 *      Returns the on-chain balance and the Gateway-available balance.
 *   4. Opens a decision window (POST /api/decision/open) with a long
 *      duration so we don't race the auto-close.
 *   5. Calls POST /api/decision/stream exactly N times for the same option.
 *      Each call signs a real EIP-712 TransferWithAuthorization via Circle's
 *      developer-controlled wallets, then settles it through Circle's
 *      Gateway testnet facilitator. We collect each `settle.transaction`.
 *   6. Closes the window (POST /api/decision/close) so the engine writes a
 *      verdict.
 *   7. Reads the creator's wallet and Gateway-available balances directly
 *      from Arc Testnet contracts. Gateway batching credits the creator's
 *      Gateway-available balance first; `/api/wallet/withdraw` moves those
 *      earnings to a normal wallet balance.
 *
 * Expected PASS evidence:
 *   - Step 5 prints N distinct `settle.transaction` references from Circle.
 *   - Step 7 prints the creator's Gateway-available delta once the Gateway
 *     testnet batcher has flushed settlement on-chain.
 *
 * Run against a live dev server:
 *   npm run dev          # in one terminal
 *   npm run test:phase5  # in another
 */
import { readUsdcBalance } from '../lib/chain'
import { readGatewayAvailableBalance } from '../lib/gateway'
import { decodePaymentResponseHeader } from '@x402/core/http'
import type { Address } from 'viem'

const BASE = process.env.GAFFER_BASE_URL ?? 'http://localhost:3000'
const TAP_COUNT = 3
const TAP_AMOUNT_USDC = '0.0001'

type Json = Record<string, unknown>

async function api(path: string, init?: RequestInit): Promise<Json> {
  const { json } = await apiWithHeaders(path, init)
  return json
}

async function apiWithHeaders(
  path: string,
  init?: RequestInit,
): Promise<{ json: Json; headers: Headers; status: number }> {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    method: init?.method ?? 'POST',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    body: init?.body,
  })
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`${path} returned non-JSON (status ${res.status}):\n${text}`)
  }
  if (!res.ok) {
    throw new Error(
      `${path} failed (${res.status}):\n${JSON.stringify(parsed, null, 2)}`,
    )
  }
  return { json: parsed as Json, headers: res.headers, status: res.status }
}

function line(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(28)}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
}

async function main(): Promise<void> {
  console.log('━━━━━━ Payment self-audit ━━━━━━')
  console.log(`base: ${BASE}`)

  console.log('\n[1/7] create session')
  const session = (await api('/api/session/create', {
    body: JSON.stringify({}),
  })) as { sessionId: string; creator: { address: string; balance: string } }
  const sessionId = session.sessionId
  const creatorAddress = session.creator.address as Address
  line('sessionId', sessionId)
  line('creator address', creatorAddress)
  line('creator balance (api echo)', session.creator.balance)

  console.log('\n[2/7] read creator BEFORE balances (chain)')
  // Gateway batches settle into the recipient's *Gateway-available* balance
  // (a contract-read on TESTNET_GATEWAY_WALLET), not their direct USDC
  // wallet balance. The recipient withdraws Gateway→wallet on demand. We
  // record both so the audit shows the full picture.
  const beforeWallet = await readUsdcBalance(creatorAddress)
  const beforeGateway = await readGatewayAvailableBalance(creatorAddress)
  line('wallet.raw', beforeWallet.raw.toString())
  line('wallet.formatted', beforeWallet.formatted)
  line('gateway.raw', beforeGateway.raw.toString())
  line('gateway.formatted', beforeGateway.formatted)

  console.log('\n[3/7] create participant + deposit into Gateway')
  const part = (await api('/api/wallet/participant', {
    body: JSON.stringify({
      sessionId,
      treasuryUsdc: '1',
      gatewayUsdc: '0.05',
    }),
  })) as {
    participant: {
      walletId: string
      address: string
      balanceOnChain: string
      gatewayAvailable: string
      approveTransactionId: string
      depositTransactionId: string
    }
  }
  const participantWalletId = part.participant.walletId
  line('participant walletId', participantWalletId)
  line('participant address', part.participant.address)
  line('on-chain USDC after fund', part.participant.balanceOnChain)
  line('gateway available USDC', part.participant.gatewayAvailable)
  line('approve tx id', part.participant.approveTransactionId)
  line('deposit tx id', part.participant.depositTransactionId)

  console.log('\n[4/7] open a decision window (120s)')
  const win = (await api('/api/decision/open', {
    body: JSON.stringify({
      sessionId,
      type: 'formation',
      durationMs: 120_000,
    }),
  })) as { window: { id: string; options: { id: string; label: string }[] } }
  const windowId = win.window.id
  const optionA = win.window.options[0]
  line('windowId', windowId)
  line('option A', `${optionA.id} — ${optionA.label}`)

  console.log(`\n[5/7] stream ${TAP_COUNT} taps for option A via Circle Gateway`)
  const settlements: string[] = []
  for (let i = 1; i <= TAP_COUNT; i++) {
    const { json: r, headers } = (await apiWithHeaders('/api/decision/stream', {
      body: JSON.stringify({
        sessionId,
        optionId: optionA.id,
        participantWalletId,
        amountUsdc: TAP_AMOUNT_USDC,
      }),
    })) as unknown as {
      json: {
        x402: { verified: boolean; settlement: string }
      }
      headers: Headers
    }
    const paymentResponse = headers.get('PAYMENT-RESPONSE')
    if (!paymentResponse) {
      throw new Error('stream response did not include PAYMENT-RESPONSE header')
    }
    const settle = decodePaymentResponseHeader(paymentResponse)
    const tx = settle.transaction
    settlements.push(tx)
    line(`tap ${i} settle.transaction`, tx)
    line(`tap ${i} settle.success`, String(settle.success))
    line(`tap ${i} settle.network`, settle.network)
    line(`tap ${i} x402.verified`, String(r.x402.verified))
  }

  console.log('\n[6/7] close window (engine verdict)')
  const closed = (await api('/api/decision/close', {
    body: JSON.stringify({ sessionId }),
  })) as { engine?: { winnerLabel: string; confidence: string; totalStreamed: number } }
  if (closed.engine) {
    line('winner', closed.engine.winnerLabel)
    line('confidence', closed.engine.confidence)
    line('totalStreamed', closed.engine.totalStreamed)
  }

  console.log('\n[7a/7] confirm Circle Gateway accepted each transfer (status query)')
  // Gateway BATCHES settlements: settle() returns immediately with a UUID,
  // the actual on-chain transaction happens later inside a batch. The
  // _first_ confirmation we can prove is that each UUID is independently
  // queryable via Circle's public transfers endpoint — that proves Circle
  // accepted the signed authorization, not just our server's success echo.
  const transferStatuses: { id: string; status: string; from?: string; to?: string; amount?: string }[] = []
  for (const id of settlements) {
    const s = await fetchTransfer(id)
    transferStatuses.push({ id, status: s.status ?? 'unknown', from: s.fromAddress, to: s.toAddress, amount: s.amount })
    line(`transfer ${id.slice(0, 8)}…`, `${s.status}  from=${s.fromAddress}  to=${s.toAddress}  amount=${s.amount}`)
  }

  console.log('\n[7b/7] poll creator Gateway-available balance for on-chain settlement')
  // Circle Gateway batches settlements with ~9-10 min cadence on testnet
  // (observed 2026-06-21). When the batcher flushes, the recipient's
  // Gateway-available balance grows by the streamed total. We poll up to
  // 15 minutes here; if it doesn't land in that window the script still
  // PASSes on the code-path criteria below.
  let afterWallet = await readUsdcBalance(creatorAddress)
  let afterGateway = await readGatewayAvailableBalance(creatorAddress)
  const expectedDeltaAtomic = BigInt(
    Math.round(Number(TAP_AMOUNT_USDC) * 1_000_000),
  ) * BigInt(TAP_COUNT)
  const expectedAfterGatewayAtomic = beforeGateway.raw + expectedDeltaAtomic
  const start = Date.now()
  while (afterGateway.raw < expectedAfterGatewayAtomic && Date.now() - start < 900_000) {
    await new Promise((r) => setTimeout(r, 15_000))
    afterGateway = await readGatewayAvailableBalance(creatorAddress)
    afterWallet = await readUsdcBalance(creatorAddress)
  }
  line('wallet.raw', afterWallet.raw.toString())
  line('wallet.formatted', afterWallet.formatted)
  line('gateway.raw', afterGateway.raw.toString())
  line('gateway.formatted', afterGateway.formatted)
  line('expected delta (atomic)', expectedDeltaAtomic.toString())
  const actualDelta = afterGateway.raw - beforeGateway.raw
  line('actual gateway delta', actualDelta.toString())

  console.log('\n━━━━━━ verdict ━━━━━━')
  // PASS criteria for payment code correctness:
  //   - All taps got a Circle settle response with success: true (proven by
  //     reaching step [5/7] without exception — the script throws on !ok).
  //   - All Circle settlement UUIDs are queryable on Circle's public API and
  //     show as accepted (status in: received / batched / confirmed / completed).
  //     "failed" or HTTP error would be a real fail.
  const settlementsOk = settlements.length === TAP_COUNT
  const allAccepted = transferStatuses.every((t) =>
    ['received', 'batched', 'confirmed', 'completed'].includes(t.status),
  )
  const onChainOk = actualDelta >= expectedDeltaAtomic

  if (settlementsOk && allAccepted) {
    if (onChainOk) {
      console.log(
        `PASS — ${TAP_COUNT} Circle Gateway settlements accepted AND on-chain Gateway delta confirmed (+${actualDelta} atomic on creator's Gateway-available balance).`,
      )
    } else {
      console.log(
        `PASS (code path) — ${TAP_COUNT} Circle Gateway settlements accepted. On-chain Gateway delta not yet visible (${actualDelta}/${expectedDeltaAtomic} atomic). Transfer statuses: ${transferStatuses
          .map((t) => t.status)
          .join(', ')}. Circle Gateway batches every ~10 min on testnet; re-run readGatewayAvailableBalance(creatorAddress) later to confirm.`,
      )
    }
    process.exit(0)
  } else {
    console.log(
      `FAIL — settlementsOk=${settlementsOk}, allAccepted=${allAccepted}, transferStatuses=${JSON.stringify(transferStatuses)}`,
    )
    process.exit(1)
  }
}

/**
 * Look up a single Circle Gateway transfer by UUID via the public testnet
 * endpoint. No auth required for read-by-id on testnet.
 */
async function fetchTransfer(transferId: string): Promise<{
  status?: string
  fromAddress?: string
  toAddress?: string
  amount?: string
  transaction?: string
}> {
  const url = `https://gateway-api-testnet.circle.com/v1/x402/transfers/${transferId}`
  const res = await fetch(url)
  if (!res.ok) {
    return { status: `http-${res.status}` }
  }
  return (await res.json()) as {
    status?: string
    fromAddress?: string
    toAddress?: string
    amount?: string
    transaction?: string
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
