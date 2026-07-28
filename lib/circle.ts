/**
 * Circle Developer-Controlled Wallets — server-only helpers.
 *
 * createUserWallet:   creates one EVM wallet on Arc Testnet and returns its
 *                     real Circle walletId + on-chain address.
 * fundWalletUSDC:     requests test USDC from Circle's Arc Testnet faucet.
 * waitForUsdcBalance: polls Arc, with Circle's indexed wallet balance as a
 *                     fallback when the public RPC is throttled.
 */
import {
  initiateDeveloperControlledWalletsClient,
  type CircleDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets'

// The Circle SDK exports `Blockchain` and `TestnetBlockchain` as `const`
// objects in its .d.ts, but only `Blockchain` is present in the runtime ESM
// bundle (`TestnetBlockchain` is types-only at the moment). Using the literal
// strings directly is safer and structurally type-equivalent.
export const ARC_TESTNET = 'ARC-TESTNET' as const
import { formatUnits, parseUnits, type Address } from 'viem'
import { env } from './env'
import { readUsdcBalance, ARC_TESTNET_USDC_ADDRESS } from './chain'

let _client: CircleDeveloperControlledWalletsClient | null = null
let arcRpcUnavailableUntil = 0

export function getCircleClient(): CircleDeveloperControlledWalletsClient {
  if (_client) return _client
  _client = initiateDeveloperControlledWalletsClient({
    apiKey: env.circleApiKey(),
    entitySecret: env.entitySecret(),
  })
  return _client
}

export interface CreatedWallet {
  walletId: string
  address: Address
}

export interface WalletUsdcBalance {
  raw: bigint
  formatted: string
  source: 'arc-rpc' | 'circle-wallets'
}

function isArcRpcThrottle(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /request limit|rate.?limit|too many requests|\b429\b/i.test(message)
}

async function readCircleWalletUsdcBalance(
  walletId: string,
): Promise<WalletUsdcBalance> {
  const response = await getCircleClient().getWalletTokenBalance({
    id: walletId,
    tokenAddresses: [ARC_TESTNET_USDC_ADDRESS],
  })
  const balances = response.data?.tokenBalances ?? []
  const usdc = balances.find((balance) => {
    const tokenAddress = balance.token.tokenAddress?.toLowerCase()
    return (
      tokenAddress === ARC_TESTNET_USDC_ADDRESS.toLowerCase() ||
      (balance.token.blockchain === ARC_TESTNET &&
        balance.token.symbol?.toUpperCase() === 'USDC')
    )
  })
  const raw = parseUnits(usdc?.amount ?? '0', 6)
  return {
    raw,
    formatted: formatUnits(raw, 6),
    source: 'circle-wallets',
  }
}

/**
 * Reads a Circle-managed Arc wallet's USDC balance. Direct RPC remains the
 * primary proof source, but a short circuit breaker prevents a shared public
 * RPC quota outage from disabling every user. Circle's indexed wallet balance
 * is still derived from the same Arc wallet and is used only as the fallback.
 */
export async function readWalletUsdcBalance(opts: {
  walletId: string
  address: Address
}): Promise<WalletUsdcBalance> {
  let rpcError: unknown
  if (Date.now() >= arcRpcUnavailableUntil) {
    try {
      const balance = await readUsdcBalance(opts.address)
      return { ...balance, source: 'arc-rpc' }
    } catch (error) {
      rpcError = error
      if (isArcRpcThrottle(error)) {
        arcRpcUnavailableUntil = Date.now() + 60_000
      }
      console.warn('[wallet/balance] Arc RPC read failed; using Circle index', {
        address: opts.address,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    return await readCircleWalletUsdcBalance(opts.walletId)
  } catch (circleError) {
    const rpcMessage =
      rpcError instanceof Error ? rpcError.message : String(rpcError ?? '')
    const circleMessage =
      circleError instanceof Error ? circleError.message : String(circleError)
    throw new Error(
      `Wallet balance verification failed. Arc RPC: ${rpcMessage || 'temporarily throttled'}. Circle: ${circleMessage}`,
    )
  }
}

/**
 * Creates one Externally-Owned Account wallet on Arc Testnet inside the
 * configured wallet set.
 */
export async function createUserWallet(): Promise<CreatedWallet> {
  const client = getCircleClient()
  const response = await client.createWallets({
    blockchains: [ARC_TESTNET],
    count: 1,
    walletSetId: env.walletSetId(),
  })
  const wallet = response.data?.wallets?.[0]
  if (!wallet?.id || !wallet?.address) {
    throw new Error('Circle did not return a wallet with id+address')
  }
  return { walletId: wallet.id, address: wallet.address as Address }
}

/**
 * Asks Circle's Arc Testnet faucet to send USDC to the wallet.
 * Faucet drop is asynchronous — call waitForUsdcBalance() afterward to confirm.
 *
 * NOTE: The test API key issued for this project does not have faucet API
 * permissions (Circle returns 403). Prefer transferUsdcFromTreasury() for the
 * end-to-end flow. This is kept for completeness / accounts that have it.
 */
export async function fundWalletUSDC(address: Address): Promise<void> {
  const client = getCircleClient()
  await client.requestTestnetTokens({
    address,
    blockchain: ARC_TESTNET,
    usdc: true,
  })
}

/**
 * Transfers `amount` USDC from the configured treasury wallet to `toAddress`
 * on Arc Testnet. Returns the Circle transaction id (caller can poll the chain
 * for the resulting balance change).
 */
export async function transferUsdcFromTreasury(
  toAddress: Address,
  amount: string = '1',
): Promise<{ transactionId: string }> {
  const client = getCircleClient()
  // The SDK type says `blockchain` must be `never` when `walletId` is set, but
  // Circle's API actually rejects the request with code 2 ("'blockchain' field
  // may not be empty when 'TokenID' field is not set") if we omit it. Verified
  // against POST /v1/w3s/developer/transactions/transfer on 2026-06-21. The
  // cast bypasses the stale type so we send what the server requires.
  const res = await client.createTransaction({
    walletId: env.treasuryWalletId(),
    destinationAddress: toAddress,
    amount: [amount],
    tokenAddress: ARC_TESTNET_USDC_ADDRESS,
    blockchain: ARC_TESTNET,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  } as unknown as Parameters<typeof client.createTransaction>[0])
  const id = res.data?.id
  if (!id) throw new Error('Circle did not return a transaction id')
  return { transactionId: id }
}

export async function transferUsdcFromWallet(opts: {
  walletId: string
  toAddress: Address
  amount: string
}): Promise<{
  transactionId: string
  txHash?: string
  state?: string
  sourceAddress?: string
  destinationAddress?: string
}> {
  const client = getCircleClient()
  const response = await client.createTransaction({
    walletId: opts.walletId,
    destinationAddress: opts.toAddress,
    amount: [opts.amount],
    tokenAddress: ARC_TESTNET_USDC_ADDRESS,
    blockchain: ARC_TESTNET,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  } as unknown as Parameters<typeof client.createTransaction>[0])
  const transactionId = response.data?.id
  if (!transactionId) throw new Error('Circle did not return a transaction id')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90_000)
  try {
    const txResponse = await client.getTransaction({
      id: transactionId,
      waitForState: 'SENT',
      pollingInterval: 2_000,
      signal: controller.signal,
    })
    const tx = txResponse.data?.transaction
    return {
      transactionId,
      txHash: tx?.txHash,
      state: tx?.state,
      sourceAddress: tx?.sourceAddress,
      destinationAddress: tx?.destinationAddress,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Polls the Arc Testnet USDC contract directly until `address` has a positive
 * balance, or `timeoutMs` elapses. Returns the final balance.
 *
 * Reading from chain (not from Circle's API) is intentional — per the
 * anti-fake doctrine, "the balance" must be observable on-chain, not a value
 * Circle's API echoes back.
 */
export async function waitForUsdcBalance(
  address: Address,
  opts: {
    walletId?: string
    timeoutMs?: number
    intervalMs?: number
  } = {},
): Promise<WalletUsdcBalance> {
  const timeoutMs = opts.timeoutMs ?? 90_000
  const intervalMs = opts.intervalMs ?? 3_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const bal = opts.walletId
      ? await readWalletUsdcBalance({ walletId: opts.walletId, address })
      : { ...(await readUsdcBalance(address)), source: 'arc-rpc' as const }
    if (bal.raw > 0n) return bal
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return opts.walletId
    ? readWalletUsdcBalance({ walletId: opts.walletId, address })
    : readUsdcBalance(address).then((balance) => ({
        ...balance,
        source: 'arc-rpc' as const,
      }))
}
