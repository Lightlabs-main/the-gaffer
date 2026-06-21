/**
 * Circle Gateway batching primitives — server-only.
 *
 * What lives here:
 *  - The on-chain constants Circle Gateway requires on Arc Testnet
 *    (GatewayWallet contract address, USDC token address, network strings,
 *    EIP-712 domain name/version).
 *  - A singleton `BatchFacilitatorClient` pointed at the testnet facilitator,
 *    which is what actually settles a signed payment payload on-chain.
 *  - `depositForParticipant`, the one-shot setup call that approves the
 *    GatewayWallet contract to spend a participant's USDC and then deposits
 *    that USDC into Gateway — without those funds in Gateway, the
 *    `BatchEvmScheme` signatures we produce later are unspendable.
 *  - `buildBatchingPaymentRequirements`, which builds the exact
 *    `PaymentRequirements` shape `BatchEvmScheme.createPaymentPayload`
 *    expects (with the right `extra.name/version/verifyingContract`).
 *
 * Why so much in one file:
 *  - Phase 5 is the *bridge* between Circle's custodial DCW model and the
 *    standard x402 buyer model. Keeping the bridge in one place makes the
 *    "this is the surface area" review tractable for the non-coder owner.
 */
import { BatchFacilitatorClient } from '@circle-fin/x402-batching/server'
import type { Address } from 'viem'
import { getAddress, parseUnits, formatUnits } from 'viem'
import { getCircleClient } from './circle'
import { ARC_TESTNET_USDC_ADDRESS, publicClient, ARC_TESTNET_CHAIN_ID } from './chain'

/**
 * GatewayWallet contract on every Circle Gateway testnet (including Arc).
 * Sourced from `@circle-fin/x402-batching/dist/server/index.js` (line 449,
 * confirmed 2026-06-21).
 */
export const TESTNET_GATEWAY_WALLET: Address = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9'

/**
 * EIP-712 domain identifiers that BatchEvmScheme uses when signing
 * TransferWithAuthorization against the GatewayWallet contract.
 * Hardcoded in `@circle-fin/x402-batching/dist/client/index.js` (lines 49-50).
 */
export const CIRCLE_BATCHING_NAME = 'GatewayWalletBatched'
export const CIRCLE_BATCHING_VERSION = '1'

/** CAIP-2 network string for Arc Testnet — what the facilitator keys settle by. */
export const ARC_TESTNET_NETWORK = `eip155:${ARC_TESTNET_CHAIN_ID}` // 'eip155:5042002'

/**
 * Circle Gateway facilitator endpoints. The mainnet one is the SDK default;
 * for Arc Testnet (and every other testnet) we must explicitly use the
 * testnet host or settlement will silently target the wrong environment.
 */
export const GATEWAY_TESTNET_URL = 'https://gateway-api-testnet.circle.com'

let _facilitator: BatchFacilitatorClient | null = null

export function getBatchFacilitatorClient(): BatchFacilitatorClient {
  if (_facilitator) return _facilitator
  _facilitator = new BatchFacilitatorClient({ url: GATEWAY_TESTNET_URL })
  return _facilitator
}

/**
 * GatewayWallet ABI snippets we actually call. Sourced from
 * `@circle-fin/x402-batching/dist/client/index.js` (GATEWAY_WALLET_ABI, ~line 401).
 * We only need `depositFor` — `approve` happens against the USDC token contract.
 */
export const GATEWAY_WALLET_DEPOSIT_FOR_SIGNATURE =
  'depositFor(address,address,uint256)'

/**
 * Standard ERC-20 approve, against the USDC contract.
 */
export const USDC_APPROVE_SIGNATURE = 'approve(address,uint256)'

/**
 * Approve the GatewayWallet contract to spend `amountUsdc` of the
 * participant's USDC, then call `depositFor(usdc, depositor, amount)` on the
 * GatewayWallet — both signed by the participant's developer-controlled
 * wallet via Circle's DCW API.
 *
 * Without this step the EIP-3009 authorization the participant later signs
 * is unsatisfiable: Gateway only releases funds it already holds for that
 * depositor.
 *
 * Returns the two Circle transaction IDs (approve, deposit). The caller is
 * responsible for polling either Circle's API or the chain until the deposit
 * lands before signing payment payloads.
 */
export async function depositForParticipant(opts: {
  walletId: string
  walletAddress: Address
  amountUsdc: string // decimal, e.g. "0.3"
}): Promise<{
  approveTransactionId: string
  depositTransactionId: string
  amountAtomic: string
}> {
  const client = getCircleClient()
  const amountAtomic = parseUnits(opts.amountUsdc, 6).toString()

  // Step 1: USDC.approve(gatewayWallet, amount)
  // Use a unique idempotencyKey for each call so re-runs don't collide.
  const approveRes = await client.createContractExecutionTransaction({
    walletId: opts.walletId,
    contractAddress: ARC_TESTNET_USDC_ADDRESS,
    abiFunctionSignature: USDC_APPROVE_SIGNATURE,
    abiParameters: [TESTNET_GATEWAY_WALLET, amountAtomic],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  } as unknown as Parameters<typeof client.createContractExecutionTransaction>[0])
  const approveId = approveRes.data?.id
  if (!approveId) throw new Error('Circle did not return an approve tx id')

  // Wait until the approve transaction is on-chain by polling the USDC
  // allowance directly. We can't sign a depositFor until the allowance is
  // visible to the GatewayWallet contract or it will revert.
  await waitForAllowance({
    owner: opts.walletAddress,
    spender: TESTNET_GATEWAY_WALLET,
    atLeast: BigInt(amountAtomic),
  })

  // Step 2: GatewayWallet.depositFor(usdc, depositor, amount)
  // `depositor` is the participant themselves — the balance is credited to them.
  const depositRes = await client.createContractExecutionTransaction({
    walletId: opts.walletId,
    contractAddress: TESTNET_GATEWAY_WALLET,
    abiFunctionSignature: GATEWAY_WALLET_DEPOSIT_FOR_SIGNATURE,
    abiParameters: [
      ARC_TESTNET_USDC_ADDRESS,
      opts.walletAddress,
      amountAtomic,
    ],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  } as unknown as Parameters<typeof client.createContractExecutionTransaction>[0])
  const depositId = depositRes.data?.id
  if (!depositId) throw new Error('Circle did not return a deposit tx id')

  return {
    approveTransactionId: approveId,
    depositTransactionId: depositId,
    amountAtomic,
  }
}

/**
 * Poll the on-chain ERC-20 allowance for an owner→spender pair until it
 * reaches at least `atLeast` atomic units, or `timeoutMs` elapses. We read
 * from the USDC contract directly (not Circle's API) so this proves the
 * approve transaction has actually been mined.
 */
export async function waitForAllowance(opts: {
  owner: Address
  spender: Address
  atLeast: bigint
  timeoutMs?: number
  intervalMs?: number
}): Promise<bigint> {
  const timeoutMs = opts.timeoutMs ?? 90_000
  const intervalMs = opts.intervalMs ?? 3_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const allowance = await publicClient.readContract({
      address: ARC_TESTNET_USDC_ADDRESS,
      abi: [
        {
          type: 'function',
          name: 'allowance',
          stateMutability: 'view',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
          ],
          outputs: [{ name: '', type: 'uint256' }],
        },
      ] as const,
      functionName: 'allowance',
      args: [opts.owner, opts.spender],
    })
    if (allowance >= opts.atLeast) return allowance
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(
    `Allowance did not reach ${opts.atLeast} on USDC for ${opts.owner}→${opts.spender} within ${timeoutMs}ms`,
  )
}

/**
 * Read a depositor's Gateway-held balance (the funds the facilitator can
 * actually release on settle). Independent of Circle's API.
 */
export async function readGatewayAvailableBalance(
  depositor: Address,
): Promise<{ raw: bigint; formatted: string }> {
  const raw = await publicClient.readContract({
    address: TESTNET_GATEWAY_WALLET,
    abi: [
      {
        type: 'function',
        name: 'availableBalance',
        stateMutability: 'view',
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'depositor', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
      },
    ] as const,
    functionName: 'availableBalance',
    args: [ARC_TESTNET_USDC_ADDRESS, depositor],
  })
  return { raw, formatted: formatUnits(raw, 6) }
}

/**
 * Build the exact `PaymentRequirements` shape `BatchEvmScheme.createPaymentPayload`
 * expects for an Arc Testnet Circle Gateway payment.
 *
 *  - `scheme`           : "exact" (Circle batching uses the exact-evm scheme)
 *  - `network`          : "eip155:5042002"
 *  - `asset`            : Arc Testnet USDC contract address
 *  - `amount`           : atomic units (string)
 *  - `payTo`            : checksummed recipient address
 *  - `maxTimeoutSeconds`: how long the signed auth stays valid;
 *                         BatchEvmScheme clamps to >= GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS
 *  - `extra`            : MUST include name=GatewayWalletBatched, version=1,
 *                         verifyingContract=GatewayWallet — without this
 *                         BatchEvmScheme throws.
 */
export function buildBatchingPaymentRequirements(opts: {
  payTo: Address
  amountAtomic: string
}): {
  scheme: 'exact'
  network: string
  asset: string
  amount: string
  payTo: string
  maxTimeoutSeconds: number
  extra: { name: string; version: string; verifyingContract: string }
} {
  return {
    scheme: 'exact',
    network: ARC_TESTNET_NETWORK,
    asset: ARC_TESTNET_USDC_ADDRESS,
    amount: opts.amountAtomic,
    payTo: getAddress(opts.payTo),
    maxTimeoutSeconds: 60,
    extra: {
      name: CIRCLE_BATCHING_NAME,
      version: CIRCLE_BATCHING_VERSION,
      verifyingContract: getAddress(TESTNET_GATEWAY_WALLET),
    },
  }
}
