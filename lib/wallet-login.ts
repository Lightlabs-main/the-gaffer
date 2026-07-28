import {
  createUserWallet,
  readWalletUsdcBalance,
  transferUsdcFromTreasury,
  waitForUsdcBalance,
} from '@/lib/circle'
import { getUserWallet, upsertUserWallet } from '@/lib/user-wallet-store'

const LOGIN_SEED_USDC = '0.05'

export interface WalletLoginResult {
  walletId: string
  address: string
  balance?: string
  balanceRaw?: string
  fundingTransactionId?: string
  fundingWarning?: string
  chainId?: number
  asset?: string
  reused: boolean
}

export async function createOrGetWalletForEmail(
  emailInput: string,
): Promise<WalletLoginResult> {
  const email = emailInput.trim().toLowerCase()
  if (!email) {
    throw new Error('email is required')
  }

  const stored = await getUserWallet(email)
  if (stored) {
    let balance = {
      formatted: stored.balance ?? '0',
      raw: BigInt(stored.balanceRaw ?? '0'),
    }
    try {
      balance = await readWalletUsdcBalance({
        walletId: stored.walletId,
        address: stored.address,
      })
    } catch (err) {
      console.warn('[wallet/login] could not refresh stored wallet balance', {
        email,
        address: stored.address,
        message: err instanceof Error ? err.message : String(err),
      })
    }
    const updated = await upsertUserWallet({
      ...stored,
      balance: balance.formatted,
      balanceRaw: balance.raw.toString(),
      fundingWarning: balance.raw > 0n ? undefined : stored.fundingWarning,
    })
    return {
      walletId: updated.walletId,
      address: updated.address,
      balance: updated.balance ?? '0',
      balanceRaw: updated.balanceRaw ?? '0',
      fundingTransactionId: updated.fundingTransactionId,
      fundingWarning: updated.fundingWarning,
      chainId: updated.chainId ?? 5042002,
      asset: updated.asset ?? 'USDC (Arc Testnet)',
      reused: true,
    }
  }

  const { walletId, address } = await createUserWallet()
  console.log('[wallet/login] created', { walletId, address })

  let transactionId: string | undefined
  let fundingWarning: string | undefined
  try {
    const transfer = await transferUsdcFromTreasury(address, LOGIN_SEED_USDC)
    transactionId = transfer.transactionId
    console.log('[wallet/login] treasury transfer initiated', {
      transactionId,
      to: address,
    })
  } catch (fundErr: unknown) {
    const message = fundErr instanceof Error ? fundErr.message : String(fundErr)
    fundingWarning =
      'Signed in, but the project treasury could not fund this wallet. Add Arc Testnet USDC to the treasury for real payment settlement.'
    console.warn('[wallet/login] funding skipped', { walletId, address, message })
  }

  const balance = transactionId
    ? await waitForUsdcBalance(address, { walletId })
    : { formatted: '0', raw: 0n, source: 'circle-wallets' as const }

  const saved = await upsertUserWallet({
    email,
    walletId,
    address,
    balance: balance.formatted,
    balanceRaw: balance.raw.toString(),
    fundingTransactionId: transactionId,
    fundingWarning,
    chainId: 5042002,
    asset: 'USDC (Arc Testnet)',
  })

  return {
    walletId: saved.walletId,
    address: saved.address,
    balance: saved.balance,
    balanceRaw: saved.balanceRaw,
    fundingTransactionId: saved.fundingTransactionId,
    fundingWarning: saved.fundingWarning,
    chainId: saved.chainId,
    asset: saved.asset,
    reused: false,
  }
}
