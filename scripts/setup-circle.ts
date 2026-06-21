/**
 * One-shot setup for Circle Developer-Controlled Wallets.
 *
 * - Reads CIRCLE_API_KEY from .env.local.
 * - If ENTITY_SECRET is missing, generates a fresh 32-byte hex, registers it
 *   with Circle, writes the returned recovery file to `circle-recovery.dat`,
 *   and appends ENTITY_SECRET to .env.local.
 * - If CIRCLE_WALLET_SET_ID is missing, creates a wallet set named
 *   "the-gaffer" and appends its ID to .env.local.
 * - Idempotent: re-running once everything is set up is a no-op.
 *
 * Usage:  npm run setup:circle
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  initiateDeveloperControlledWalletsClient,
  registerEntitySecretCiphertext,
} from '@circle-fin/developer-controlled-wallets'
import { env } from '../lib/env'

const ROOT = process.cwd()
const ENV_PATH = join(ROOT, '.env.local')
const RECOVERY_PATH = join(ROOT, 'circle-recovery.dat')

function readEnvFile(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {}
  const map: Record<string, string> = {}
  for (const raw of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    map[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return map
}

function writeEnvFile(values: Record<string, string>): void {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : ''
  const lines = existing.split('\n')
  const seen = new Set<string>()

  const out = lines.map((raw) => {
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) return raw
    const eq = trimmed.indexOf('=')
    if (eq === -1) return raw
    const key = trimmed.slice(0, eq).trim()
    if (values[key] !== undefined) {
      seen.add(key)
      return `${key}=${values[key]}`
    }
    return raw
  })

  // Append any new keys not already in the file
  for (const [k, v] of Object.entries(values)) {
    if (!seen.has(k)) out.push(`${k}=${v}`)
  }

  writeFileSync(ENV_PATH, out.join('\n'))
}

function generateEntitySecretHex(): string {
  return randomBytes(32).toString('hex')
}

async function main(): Promise<void> {
  const apiKey = env.optionalCircleApiKey()
  if (!apiKey) {
    console.error('✗ CIRCLE_API_KEY missing in .env.local. Add it and rerun.')
    process.exit(1)
  }
  console.log(`✓ CIRCLE_API_KEY loaded (${apiKey.slice(0, 16)}…)`)

  const envFile = readEnvFile()
  const updates: Record<string, string> = {}

  // --- Entity secret ---
  let entitySecret = envFile.ENTITY_SECRET
  if (entitySecret && entitySecret.length === 64) {
    console.log(`✓ ENTITY_SECRET already set (${entitySecret.slice(0, 8)}…), skipping registration`)
  } else {
    entitySecret = generateEntitySecretHex()
    console.log(`→ Generated new entity secret (${entitySecret.slice(0, 8)}…)`)
    console.log('→ Registering with Circle…')
    try {
      const reg = await registerEntitySecretCiphertext({ apiKey, entitySecret })
      const recoveryFile = reg.data?.recoveryFile
      if (!recoveryFile) {
        throw new Error('Circle response did not include a recoveryFile')
      }
      writeFileSync(RECOVERY_PATH, recoveryFile)
      console.log(`✓ Entity secret registered. Recovery file written to ${RECOVERY_PATH}`)
      console.log('  ⚠  KEEP THIS FILE SAFE — it is the only way to recover access if ENTITY_SECRET is lost.')
      updates.ENTITY_SECRET = entitySecret
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      // Circle responds with 400 / specific code when an entity secret is already registered
      if (msg.includes('155706') || /already.*registered|entity.*secret.*exist/i.test(msg)) {
        console.error('✗ This Circle account already has an entity secret registered.')
        console.error('  You must use the original entity secret (you have no way to recover it from this script).')
        console.error('  Options: (1) recover via Circle Console → Developer-Controlled Wallets → Entity Secret,')
        console.error('           (2) use the recovery file that was downloaded at original registration,')
        console.error('           (3) create a fresh Circle test account and new API key.')
        process.exit(2)
      }
      throw err
    }
  }

  // --- Wallet set ---
  let walletSetId = envFile.CIRCLE_WALLET_SET_ID
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
  if (walletSetId && walletSetId.length > 0) {
    console.log(`✓ CIRCLE_WALLET_SET_ID already set (${walletSetId})`)
  } else {
    console.log('→ Creating wallet set "the-gaffer"…')
    const set = await client.createWalletSet({ name: 'the-gaffer' })
    const id = set.data?.walletSet?.id
    if (!id) throw new Error('Circle did not return a wallet set ID')
    console.log(`✓ Wallet set created: ${id}`)
    walletSetId = id
    updates.CIRCLE_WALLET_SET_ID = id
  }

  // --- Treasury wallet (funds every participant wallet) ---
  let treasuryAddress = envFile.TREASURY_ADDRESS
  let treasuryWalletId = envFile.TREASURY_WALLET_ID
  if (treasuryWalletId && treasuryAddress) {
    console.log(`✓ Treasury wallet already set (${treasuryAddress})`)
  } else {
    console.log('→ Creating treasury wallet on Arc Testnet…')
    const w = await client.createWallets({
      blockchains: ['ARC-TESTNET'],
      count: 1,
      walletSetId,
    })
    const wallet = w.data?.wallets?.[0]
    if (!wallet?.id || !wallet?.address) throw new Error('Circle did not return treasury wallet id+address')
    treasuryWalletId = wallet.id
    treasuryAddress = wallet.address
    updates.TREASURY_WALLET_ID = treasuryWalletId
    updates.TREASURY_ADDRESS = treasuryAddress
    console.log(`✓ Treasury wallet created: ${treasuryWalletId} @ ${treasuryAddress}`)
  }

  if (Object.keys(updates).length > 0) {
    writeEnvFile(updates)
    console.log('✓ .env.local updated')
  } else {
    console.log('✓ Nothing to do — setup already complete.')
  }

  console.log('')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('NEXT — fund the treasury (one-time, ~30 seconds):')
  console.log('  1. Open https://faucet.circle.com/')
  console.log('  2. Network: Arc Testnet')
  console.log(`  3. Paste address: ${treasuryAddress}`)
  console.log('  4. Request USDC')
  console.log('Then verify with:')
  console.log(`  npm run verify:wallet -- ${treasuryAddress}`)
  console.log('Refill the treasury the same way when it depletes.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch((err) => {
  console.error('✗ Setup failed:', err instanceof Error ? err.stack ?? err.message : err)
  process.exit(1)
})
