import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Address } from 'viem'
import { kvGetJson, kvSetJson } from './persistent-kv'

export interface StoredUserWallet {
  email: string
  walletId: string
  address: Address
  balance?: string
  balanceRaw?: string
  fundingTransactionId?: string
  fundingWarning?: string
  chainId?: number
  asset?: string
  createdAt: number
  updatedAt: number
}

const STORE_DIR = join(process.cwd(), '.gaffer-store')
const STORE_FILE = join(STORE_DIR, 'user-wallets.json')
const walletsByEmail = new Map<string, StoredUserWallet>()
let loadedFromDisk = false

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function walletKey(email: string): string {
  return `gaffer:user-wallet:${normalizeEmail(email)}`
}

function ensureLoadedFromDisk(): void {
  if (loadedFromDisk) return
  loadedFromDisk = true
  if (!existsSync(STORE_FILE)) return

  try {
    const raw = readFileSync(STORE_FILE, 'utf8')
    const persisted = JSON.parse(raw) as StoredUserWallet[]
    for (const wallet of persisted) {
      walletsByEmail.set(normalizeEmail(wallet.email), {
        ...wallet,
        email: normalizeEmail(wallet.email),
      })
    }
  } catch (err) {
    console.warn('[user-wallet-store] could not load persisted wallets', err)
  }
}

function saveAllToDisk(): void {
  try {
    mkdirSync(STORE_DIR, { recursive: true })
    writeFileSync(
      STORE_FILE,
      JSON.stringify(Array.from(walletsByEmail.values()), null, 2),
    )
  } catch (err) {
    console.warn('[user-wallet-store] could not persist wallets', err)
  }
}

export async function getUserWallet(
  email: string,
): Promise<StoredUserWallet | undefined> {
  const normalized = normalizeEmail(email)
  ensureLoadedFromDisk()
  const cached = walletsByEmail.get(normalized)
  if (cached) return cached

  try {
    const kvWallet = await kvGetJson<StoredUserWallet>(walletKey(normalized))
    if (kvWallet?.email && kvWallet.walletId && kvWallet.address) {
      const wallet = { ...kvWallet, email: normalized }
      walletsByEmail.set(normalized, wallet)
      return wallet
    }
  } catch (err) {
    console.warn('[user-wallet-store] KV read failed, falling back to local file', err)
  }

  return walletsByEmail.get(normalized)
}

export async function upsertUserWallet(
  wallet: Omit<StoredUserWallet, 'email' | 'createdAt' | 'updatedAt'> & {
    email: string
    createdAt?: number
    updatedAt?: number
  },
): Promise<StoredUserWallet> {
  const email = normalizeEmail(wallet.email)
  const current = (await getUserWallet(email)) ?? walletsByEmail.get(email)
  const now = Date.now()
  const next: StoredUserWallet = {
    ...current,
    ...wallet,
    email,
    createdAt: wallet.createdAt ?? current?.createdAt ?? now,
    updatedAt: wallet.updatedAt ?? now,
  }
  walletsByEmail.set(email, next)

  try {
    await kvSetJson(walletKey(email), next)
  } catch (err) {
    console.warn('[user-wallet-store] KV write failed, falling back to local file', err)
  }
  // Keep a local mirror even when KV succeeds. This prevents a fresh Circle
  // wallet from being created for the same email if the remote KV is absent,
  // rotated, or temporarily unreachable on a later server boot.
  saveAllToDisk()

  return next
}
