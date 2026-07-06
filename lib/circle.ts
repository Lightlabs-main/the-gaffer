/**
 * Circle Developer-Controlled Wallets — server-only helpers.
 *
 * createUserWallet:   creates one EVM wallet on Arc Testnet and returns its
 *                     real Circle walletId + on-chain address.
 * fundWalletUSDC:     requests test USDC from Circle's Arc Testnet faucet.
 * waitForUsdcBalance: polls the chain (not Circle's API) until the wallet has
 *                     a positive USDC balance, or the timeout elapses.
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
import type { Address } from 'viem'
import { env } from './env'
import { readUsdcBalance, ARC_TESTNET_USDC_ADDRESS } from './chain'

let _client: CircleDeveloperControlledWalletsClient | null = null

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
  opts: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<{ raw: bigint; formatted: string }> {
  const timeoutMs = opts.timeoutMs ?? 90_000
  const intervalMs = opts.intervalMs ?? 3_000
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const bal = await readUsdcBalance(address)
    if (bal.raw > 0n) return bal
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return readUsdcBalance(address)
}
