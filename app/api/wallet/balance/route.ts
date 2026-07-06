import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { readUsdcBalance } from '@/lib/chain'
import type { ProfileIdentity } from '@/lib/client-profile'
import { upsertUserWallet } from '@/lib/user-wallet-store'

export const dynamic = 'force-dynamic'

function parseProfileIdentityCookie(value?: string): ProfileIdentity | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ProfileIdentity>
    if (!parsed.email || !parsed.walletId || !parsed.address) return null
    if (parsed.loginProvider !== 'email') return null
    if (!isAddress(parsed.address)) return null
    return parsed as ProfileIdentity
  } catch {
    return null
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const cookieStore = await cookies()
    const identity = parseProfileIdentityCookie(
      cookieStore.get('gaffer_profile_identity')?.value,
    )
    if (!identity) {
      return NextResponse.json({ message: 'Login required' }, { status: 401 })
    }

    const balance = await readUsdcBalance(identity.address as `0x${string}`)
    const fundingWarning =
      balance.raw > 0n ? undefined : identity.fundingWarning
    await upsertUserWallet({
      email: identity.email,
      walletId: identity.walletId,
      address: identity.address as `0x${string}`,
      balance: balance.formatted,
      balanceRaw: balance.raw.toString(),
      fundingTransactionId: identity.fundingTransactionId,
      fundingWarning,
      chainId: identity.chainId ?? 5042002,
      asset: identity.asset ?? 'USDC (Arc Testnet)',
    })

    return NextResponse.json({
      address: identity.address,
      balance: balance.formatted,
      balanceRaw: balance.raw.toString(),
      fundingWarning: fundingWarning ?? null,
      asset: identity.asset ?? 'USDC (Arc Testnet)',
      chainId: identity.chainId ?? 5042002,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not refresh balance'
    console.error('[wallet/balance] failed:', message)
    return NextResponse.json({ message }, { status: 500 })
  }
}
