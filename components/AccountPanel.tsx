'use client'

import { useEffect, useState } from 'react'
import {
  clearProfileIdentity,
  readProfileIdentity,
  readProfileIdentityByEmail,
  saveProfileIdentity,
  shortAddress,
  type ProfileIdentity,
} from '@/lib/client-profile'

interface WalletCreateResponse {
  walletId?: string
  address?: string
  balance?: string
  balanceRaw?: string
  chainId?: number
  asset?: string
  fundingRequired?: boolean
  message?: string
  stage?: string
  details?: unknown
}

export default function AccountPanel() {
  const [identity, setIdentity] = useState<ProfileIdentity | null>(() =>
    readProfileIdentity(),
  )
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawDestination, setWithdrawDestination] = useState('')
  const [walletAction, setWalletAction] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function refreshIdentity() {
      setIdentity(readProfileIdentity())
    }
    window.addEventListener('gaffer-auth-changed', refreshIdentity)
    return () => window.removeEventListener('gaffer-auth-changed', refreshIdentity)
  }, [])

  async function login() {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || busy) return
    setBusy(true)
    setError(null)

    try {
      const existing = readProfileIdentityByEmail(trimmedEmail)
      if (existing) {
        saveProfileIdentity(existing)
        setIdentity(existing)
        setEmail('')
        window.dispatchEvent(new Event('gaffer-auth-changed'))
        return
      }

      const res = await fetch('/api/wallet/create', { method: 'POST' })
      const data = (await res.json()) as WalletCreateResponse
      if (!res.ok || !data.walletId || !data.address) {
        throw new Error(
          data.message ||
            (data.stage ? `Wallet creation failed at ${data.stage}` : 'Wallet creation failed'),
        )
      }

      const nextIdentity: ProfileIdentity = {
        email: trimmedEmail,
        walletId: data.walletId,
        address: data.address,
        balance: data.balance,
        balanceRaw: data.balanceRaw,
        chainId: data.chainId,
        asset: data.asset,
        fundingRequired: data.fundingRequired,
        createdAt: Date.now(),
      }
      saveProfileIdentity(nextIdentity)
      setIdentity(nextIdentity)
      setEmail('')
      window.dispatchEvent(new Event('gaffer-auth-changed'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create wallet')
    } finally {
      setBusy(false)
    }
  }

  function signOut() {
    clearProfileIdentity()
    setIdentity(null)
    setError(null)
    window.dispatchEvent(new Event('gaffer-auth-changed'))
  }

  async function copyAddress(label: string) {
    if (!identity?.address) return
    await navigator.clipboard.writeText(identity.address)
    setCopied(true)
    setWalletAction(label)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function withdrawGateway() {
    if (!identity || !withdrawAmount || withdrawing) return
    setWithdrawing(true)
    setWalletAction(null)
    setError(null)
    try {
      const res = await fetch('/api/wallet/gateway/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: identity.walletId,
          address: identity.address,
          amountUsdc: withdrawAmount,
          destinationAddress: withdrawDestination || identity.address,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Gateway withdrawal failed')
      }
      setWalletAction(`Withdrawal submitted: ${data.transactionId}`)
      setWithdrawAmount('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gateway withdrawal failed')
    } finally {
      setWithdrawing(false)
    }
  }

  return (
    <section className="match-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-950">
          Email login
        </h2>
        <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-600">
          {identity ? 'Signed in' : 'Signed out'}
        </span>
      </div>

      {identity ? (
        <div>
          <div className="text-lg font-semibold text-zinc-950">{identity.email}</div>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            A real Circle wallet was created for this local profile. Fund it
            with Arc Testnet USDC before streaming.
          </p>
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Wallet address
            </div>
            <button
              onClick={() => void copyAddress('Address copied')}
              className="mt-1 w-full break-all text-left font-mono text-xs text-[var(--pitch-green)] underline decoration-zinc-300 underline-offset-4"
              title="Copy wallet address"
            >
              {identity.address}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-500">
            <span>{identity.asset ?? 'Arc Testnet wallet'}</span>
            <span className="text-right">{identity.balance ?? '0'} USDC</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => void copyAddress('Deposit address copied')}
              className="rounded-lg bg-[var(--pitch-green)] px-3 py-2 text-xs font-semibold text-white"
            >
              {copied ? 'Copied' : 'Deposit'}
            </button>
            <button
              onClick={() => setWithdrawDestination(identity.address)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-[var(--pitch-green)]/60"
            >
              Withdraw
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            <input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Gateway withdraw amount"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-950 outline-none focus:border-[var(--pitch-green)]"
            />
            <input
              value={withdrawDestination}
              onChange={(e) => setWithdrawDestination(e.target.value)}
              placeholder={shortAddress(identity.address)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-950 outline-none focus:border-[var(--pitch-green)]"
            />
            <button
              onClick={() => void withdrawGateway()}
              disabled={!withdrawAmount || withdrawing}
              className="rounded-lg border border-[var(--pitch-dim)] px-3 py-2 text-xs font-semibold text-[var(--pitch-green)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {withdrawing ? 'Withdrawing...' : 'Withdraw Gateway balance'}
            </button>
          </div>
          {walletAction && (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700">
              {walletAction}
            </div>
          )}
          <button
            onClick={signOut}
            className="mt-3 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-700 hover:border-[var(--pitch-green)]/60"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm leading-6 text-zinc-600">
            Enter your email to create a local Gaffer profile and generate a
            Circle Arc Testnet wallet.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void login()}
              placeholder="you@example.com"
              className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-[var(--pitch-green)]"
            />
            <button
              onClick={() => void login()}
              disabled={!email.trim() || busy}
              className="rounded-lg bg-[var(--pitch-green)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? 'Creating wallet...' : 'Login'}
            </button>
          </div>
          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
