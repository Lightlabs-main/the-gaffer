/**
 * Probe a treasury → wallet USDC transfer and print Circle's full raw error
 * (the SDK wrapper hides response.data — call axios directly to see it).
 */
import axios from 'axios'
import { generateEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets'
import { env } from '../lib/env'
import { ARC_TESTNET_USDC_ADDRESS } from '../lib/chain'

const DEST = process.argv[2]
if (!DEST) {
  console.error('usage: tsx scripts/probe-transfer.ts <destinationAddress>')
  process.exit(1)
}

async function main() {
  const apiKey = env.circleApiKey()
  const entitySecret = env.entitySecret()
  const walletId = env.treasuryWalletId()

  const entitySecretCiphertext = await generateEntitySecretCiphertext({ apiKey, entitySecret })
  const idempotencyKey = crypto.randomUUID()

  const body = {
    idempotencyKey,
    entitySecretCiphertext,
    walletId,
    destinationAddress: DEST,
    amounts: ['1'],
    tokenAddress: ARC_TESTNET_USDC_ADDRESS,
    feeLevel: 'MEDIUM',
  }

  console.log('POST body:', JSON.stringify(body, null, 2))

  try {
    const r = await axios.post('https://api.circle.com/v1/w3s/developer/transactions/transfer', body, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })
    console.log('OK', r.status, JSON.stringify(r.data, null, 2))
  } catch (e: unknown) {
    const a = e as { response?: { status?: number; data?: unknown }; message?: string }
    console.error('FAIL status', a.response?.status)
    console.error('body:', JSON.stringify(a.response?.data, null, 2))
    console.error('msg:', a.message)
  }
}

main()
