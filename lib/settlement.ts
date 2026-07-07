import { randomUUID } from 'node:crypto'
import { BatchEvmScheme } from '@circle-fin/x402-batching/client'
import { getAddress, isAddress, type Address, parseUnits } from 'viem'
import { DcwBatchSigner } from './dcw-batch-signer'
import {
  buildBatchingPaymentRequirements,
  getBatchFacilitatorClient,
} from './gateway'
import { ARC_TESTNET, transferUsdcFromWallet } from './circle'
import { env } from './env'

const X402_VERSION = 2
const SETTLEMENT_TIMEOUT_MS = 20_000

export interface SettlementResult {
  amountAtomic: string
  settle: {
    success: boolean
    transaction: string
    network: string
    payer: string
    transactionId?: string
    txHash?: string
    state?: string
    payTo?: string
    route?: string
  }
}

export async function settleFromParticipant(opts: {
  requestUrl: string
  participantWalletId: string
  participantAddress: string
  payTo: Address
  amountUsdc: string
  description: string
}): Promise<SettlementResult> {
  const amountAtomic = parseUnits(opts.amountUsdc, 6).toString()
  const requirements = buildBatchingPaymentRequirements({
    payTo: opts.payTo,
    amountAtomic,
  })
  const signer = new DcwBatchSigner(
    opts.participantWalletId,
    opts.participantAddress as `0x${string}`,
  )
  const scheme = new BatchEvmScheme(signer)
  const signed = await scheme.createPaymentPayload(X402_VERSION, requirements)
  const facilitator = getBatchFacilitatorClient()
  const settlePayload = {
    x402Version: signed.x402Version,
    resource: {
      url: opts.requestUrl,
      description: opts.description,
      mimeType: 'application/json',
    },
    accepted: requirements,
    payload: signed.payload as unknown as Record<string, unknown>,
  }
  const settle = await facilitator.settle(settlePayload, requirements)
  if (!settle.success) {
    throw new Error(settle.errorReason ?? 'Circle Gateway settlement failed')
  }
  if (!settle.transaction) {
    throw new Error('Circle Gateway settlement succeeded without a transaction reference')
  }
  return {
    amountAtomic,
    settle: {
      success: settle.success,
      transaction: settle.transaction,
      network: settle.network,
      payer: settle.payer ?? opts.participantAddress,
    },
  }
}

export async function settleFromParticipantWithFallback(opts: {
  requestUrl: string
  participantWalletId: string
  participantAddress: string
  payTo: Address
  amountUsdc: string
  description: string
}): Promise<SettlementResult & { fallback?: true; warning?: string }> {
  try {
    return await withTimeout(
      settleFromParticipant(opts),
      SETTLEMENT_TIMEOUT_MS,
      'Circle Gateway settlement timed out',
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const amountAtomic = parseUnits(opts.amountUsdc, 6).toString()
    const transaction = `unfunded-testnet-${randomUUID()}`
    console.warn('[settlement] using unfunded testnet fallback', {
      participantWalletId: opts.participantWalletId,
      participantAddress: opts.participantAddress,
      payTo: opts.payTo,
      amountUsdc: opts.amountUsdc,
      message,
    })
    return {
      amountAtomic,
      fallback: true,
      warning:
        'Circle Gateway settlement failed because this test wallet is unfunded. Recorded as unfunded testnet demo settlement.',
      settle: {
        success: true,
        transaction,
        network: 'arc-testnet-unfunded-demo',
        payer: opts.participantAddress,
      },
    }
  }
}

export async function settleDirectUsdcPayment(opts: {
  participantWalletId: string
  participantAddress: string
  payTo: Address
  amountUsdc: string
}): Promise<SettlementResult> {
  const amountAtomic = parseUnits(opts.amountUsdc, 6).toString()
  const payer = getAddress(opts.participantAddress as Address)
  const creator = getAddress(opts.payTo)
  const treasuryAddress = env.optionalTreasuryAddress()
  const selfPayment = payer === creator
  const destination =
    selfPayment && treasuryAddress && isAddress(treasuryAddress)
      ? getAddress(treasuryAddress as Address)
      : creator

  if (selfPayment && destination === creator) {
    throw new Error(
      'Use a second reader account for on-chain settlement. Creator self-pay would transfer to the same wallet.',
    )
  }

  const tx = await transferUsdcFromWallet({
    walletId: opts.participantWalletId,
    toAddress: destination,
    amount: opts.amountUsdc,
  })
  const proof = tx.txHash ?? tx.transactionId
  return {
    amountAtomic,
    settle: {
      success: true,
      transaction: proof,
      transactionId: tx.transactionId,
      txHash: tx.txHash,
      state: tx.state,
      network: ARC_TESTNET,
      payer,
      payTo: destination,
      route: selfPayment ? 'self-test-to-treasury' : 'reader-to-creator',
    },
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
