import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Address } from 'viem'

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

function ensureLoaded(): void {
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

function saveAll(): void {
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

export function getUserWallet(email: string): StoredUserWallet | undefined {
  ensureLoaded()
  return walletsByEmail.get(normalizeEmail(email))
}

export function upsertUserWallet(
  wallet: Omit<StoredUserWallet, 'email' | 'createdAt' | 'updatedAt'> & {
    email: string
    createdAt?: number
    updatedAt?: number
  },
): StoredUserWallet {
  ensureLoaded()
  const email = normalizeEmail(wallet.email)
  const current = walletsByEmail.get(email)
  const now = Date.now()
  const next: StoredUserWallet = {
    ...current,
    ...wallet,
    email,
    createdAt: wallet.createdAt ?? current?.createdAt ?? now,
    updatedAt: wallet.updatedAt ?? now,
  }
  walletsByEmail.set(email, next)
  saveAll()
  return next
}
