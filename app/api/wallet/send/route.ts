import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { ARC_TESTNET_USDC_ADDRESS } from '@/lib/chain'
import { ARC_TESTNET, getCircleClient } from '@/lib/circle'
import type { ProfileIdentity } from '@/lib/client-profile'

export const dynamic = 'force-dynamic'

interface Body {
  amount?: string
  destinationAddress?: string
}

function parseProfileIdentityCookie(value?: string): ProfileIdentity | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ProfileIdentity>
    if (!parsed.email || !parsed.walletId || !parsed.address) return null
    return parsed as ProfileIdentity
  } catch {
    return null
  }
}

function parseAmount(value?: string): string | null {
  const amount = value?.trim()
  if (!amount || !/^\d+(\.\d{1,6})?$/.test(amount)) return null
  if (Number(amount) <= 0) return null
  return amount
}

function errorMessage(err: unknown): string {
  const anyErr = err as {
    message?: string
    response?: { data?: { message?: string; errors?: unknown } }
  }
  return (
    anyErr.response?.data?.message ||
    anyErr.message ||
    'Unable to send USDC from this wallet'
  )
}

export async function POST(req: Request): Promise<NextResponse> {
  const contentType = req.headers.get('content-type') ?? ''
  const wantsJson = contentType.includes('application/json')
  const respond = (message: string, status = 400) => {
    if (wantsJson) return NextResponse.json({ message }, { status })
    const url = new URL('/studio', req.headers.get('referer') ?? req.url)
    url.searchParams.set('login', '1')
    url.searchParams.set('section', 'wallet')
    url.searchParams.set('wallet', 'send')
    url.searchParams.set('sendMessage', message)
    return NextResponse.redirect(url, 303)
  }

  try {
    const cookieStore = await cookies()
    const identity = parseProfileIdentityCookie(
      cookieStore.get('gaffer_profile_identity')?.value,
    )
    if (!identity) {
      return respond('Login required', 401)
    }

    const body = contentType.includes('application/json')
      ? ((await req.json().catch(() => ({}))) as Body)
      : await req.formData().then((formData) => ({
          amount: String(formData.get('amount') ?? ''),
          destinationAddress: String(formData.get('destinationAddress') ?? ''),
        }))
    const destinationAddress = body.destinationAddress?.trim()
    const amount = parseAmount(body.amount)

    if (!destinationAddress || !isAddress(destinationAddress)) {
      return respond('Enter a valid EVM wallet address')
    }
    if (!amount) {
      return respond('Enter a valid USDC amount up to 6 decimals')
    }

    const client = getCircleClient()
    const response = await client.createTransaction({
      walletId: identity.walletId,
      destinationAddress,
      amount: [amount],
      tokenAddress: ARC_TESTNET_USDC_ADDRESS,
      blockchain: ARC_TESTNET,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    } as unknown as Parameters<typeof client.createTransaction>[0])

    const transactionId = response.data?.id
    if (!transactionId) {
      throw new Error('Circle did not return a transaction id')
    }

    if (!wantsJson) {
      return respond(`Sent. Circle transaction ${transactionId}`, 200)
    }

    return NextResponse.json({
      amount,
      asset: 'USDC',
      blockchain: ARC_TESTNET,
      destinationAddress,
      transactionId,
      walletAddress: identity.address,
    })
  } catch (err) {
    const message = errorMessage(err)
    console.error('[wallet/send] failed:', message)
    return respond(message, 500)
  }
}
