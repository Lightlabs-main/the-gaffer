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

function optionalAny(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = optional(key)
    if (value) return value
  }
  return undefined
}

function needAny(keys: string[]): string {
  const value = optionalAny(keys)
  if (!value) throw new Error(`Missing required env var: ${keys.join(' or ')}`)
  return value
}

export const env = {
  circleApiKey: () => need('CIRCLE_API_KEY'),
  entitySecret: () => needAny(['ENTITY_SECRET', 'CIRCLE_ENTITY_SECRET']),
  walletSetId: () => need('CIRCLE_WALLET_SET_ID'),
  treasuryWalletId: () => need('TREASURY_WALLET_ID'),
  treasuryAddress: () => need('TREASURY_ADDRESS'),
  anthropicKey: () => need('ANTHROPIC_API_KEY'),
  anthropicModel: () => optional('ANTHROPIC_MODEL') ?? 'claude-opus-4-8',
  arcTestnetRpcUrl: () =>
    optionalAny(['ARC_RPC_URL', 'ARC_TESTNET_RPC_URL']) ??
    'https://rpc.testnet.arc.network',
  dailyApiKey: () => optional('DAILY_API_KEY'),
  tavilyApiKey: () => optional('TAVILY_API_KEY'),
  appUrl: () => optional('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',

  // Non-throwing accessors for setup scripts
  optionalCircleApiKey: () => optional('CIRCLE_API_KEY'),
  optionalEntitySecret: () => optionalAny(['ENTITY_SECRET', 'CIRCLE_ENTITY_SECRET']),
  optionalWalletSetId: () => optional('CIRCLE_WALLET_SET_ID'),
  optionalTreasuryWalletId: () => optional('TREASURY_WALLET_ID'),
  optionalTreasuryAddress: () => optional('TREASURY_ADDRESS'),
  optionalAnthropicModel: () => optional('ANTHROPIC_MODEL'),
  optionalArcTestnetRpcUrl: () => optionalAny(['ARC_RPC_URL', 'ARC_TESTNET_RPC_URL']),
  optionalDailyApiKey: () => optional('DAILY_API_KEY'),
  optionalTavilyApiKey: () => optional('TAVILY_API_KEY'),
  optionalKvRestApiUrl: () =>
    optionalAny(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']),
  optionalKvRestApiToken: () =>
    optionalAny(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']),
  optionalBackendOrigin: () =>
    optionalAny(['GAFFER_BACKEND_ORIGIN', 'NEXT_PUBLIC_GAFFER_BACKEND_ORIGIN']),
}
