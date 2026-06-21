/**
 * Tiny .env.local loader (no `dotenv` dep) plus typed accessors.
 * Server-only — never import from client components.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

let loaded = false

function loadEnvFile(): void {
  if (loaded) return
  loaded = true
  const path = join(process.cwd(), '.env.local')
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // strip optional surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

function need(key: string): string {
  loadEnvFile()
  const v = process.env[key]
  if (!v) throw new Error(`Missing required env var: ${key}`)
  return v
}

function optional(key: string): string | undefined {
  loadEnvFile()
  const v = process.env[key]
  return v && v.length > 0 ? v : undefined
}

export const env = {
  circleApiKey: () => need('CIRCLE_API_KEY'),
  entitySecret: () => need('ENTITY_SECRET'),
  walletSetId: () => need('CIRCLE_WALLET_SET_ID'),
  treasuryWalletId: () => need('TREASURY_WALLET_ID'),
  treasuryAddress: () => need('TREASURY_ADDRESS'),
  anthropicKey: () => need('ANTHROPIC_API_KEY'),
  appUrl: () => optional('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',

  // Non-throwing accessors for setup scripts
  optionalCircleApiKey: () => optional('CIRCLE_API_KEY'),
  optionalEntitySecret: () => optional('ENTITY_SECRET'),
  optionalWalletSetId: () => optional('CIRCLE_WALLET_SET_ID'),
  optionalTreasuryWalletId: () => optional('TREASURY_WALLET_ID'),
  optionalTreasuryAddress: () => optional('TREASURY_ADDRESS'),
}
