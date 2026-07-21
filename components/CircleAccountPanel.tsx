'use client'

import { useEffect, useState } from 'react'
import {
  clearProfileIdentity,
  readProfileIdentity,
  refreshProfileIdentityFromServer,
  saveProfileIdentity,
  shortAddress,
  type ProfileIdentity,
} from '@/lib/client-profile'
import { publicErrorMessage } from '@/lib/public-error'

export default function CircleAccountPanel({
  initialIdentity = null,
}: {
  initialIdentity?: ProfileIdentity | null
}) {
  const [identity, setIdentity] = useState<ProfileIdentity | null>(
    initialIdentity?.loginProvider === 'email' ? initialIdentity : null,
  )
  const [email, setEmail] = useState(initialIdentity?.email ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balanceBusy, setBalanceBusy] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [walletMode, setWalletMode] = useState<'receive' | 'send'>('receive')
  const [destinationAddress, setDestinationAddress] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendBusy, setSendBusy] = useState(false)
  const [sendResult, setSendResult] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )

  useEffect(() => {
    let cancelled = false
    function refreshIdentity() {
      const current = readProfileIdentity()
      setIdentity(current?.loginProvider === 'email' ? current : null)
      if (current?.email) setEmail(current.email)
    }
    async function refreshCanonicalIdentity() {
      const current = readProfileIdentity()
      if (current?.loginProvider !== 'email') return
      try {
        const canonical = await refreshProfileIdentityFromServer(current)
        if (!cancelled && canonical?.loginProvider === 'email') {
          setIdentity(canonical)
          setEmail(canonical.email)
        }
      } catch {
        // Keep the local identity visible; explicit login will surface errors.
      }
    }
    refreshIdentity()
    void refreshCanonicalIdentity()
    window.addEventListener('gaffer-auth-changed', refreshIdentity)
    return () => {
      cancelled = true
      window.removeEventListener('gaffer-auth-changed', refreshIdentity)
    }
  }, [])

  async function login() {
    if (!email.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/wallet/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Wallet login failed')
      }
      const nextIdentity: ProfileIdentity = {
        email: email.trim().toLowerCase(),
        loginLabel: email.trim().toLowerCase(),
        loginProvider: 'email',
        walletId: data.walletId,
        address: data.address,
        balance: data.balance ?? '0',
        balanceRaw: data.balanceRaw ?? '0',
        fundingTransactionId: data.fundingTransactionId,
        fundingWarning: data.fundingWarning,
        chainId: data.chainId ?? 5042002,
        asset: data.asset ?? 'USDC (Arc Testnet)',
        createdAt: Date.now(),
      }
      saveProfileIdentity(nextIdentity)
      setIdentity(nextIdentity)
      window.dispatchEvent(new Event('gaffer-auth-changed'))
    } catch (err) {
      setError(publicErrorMessage(err, 'Wallet login failed. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function copyAddress() {
    if (!identity?.address) return
    setCopyStatus('idle')
    try {
      await navigator.clipboard.writeText(identity.address)
      setCopyStatus('copied')
      window.setTimeout(() => setCopyStatus('idle'), 1800)
    } catch {
      setCopyStatus('failed')
    }
  }

  async function refreshBalance() {
    if (!identity || balanceBusy) return
    setBalanceBusy(true)
    setBalanceError(null)
    try {
      const res = await fetch('/api/wallet/balance', {
        method: 'GET',
        cache: 'no-store',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Balance refresh failed')
      }
      const nextIdentity: ProfileIdentity = {
        ...identity,
        balance: data.balance ?? identity.balance ?? '0',
        balanceRaw: data.balanceRaw ?? identity.balanceRaw ?? '0',
        asset: data.asset ?? identity.asset ?? 'USDC (Arc Testnet)',
        chainId: data.chainId ?? identity.chainId ?? 5042002,
        fundingWarning: data.fundingWarning ?? undefined,
      }
      saveProfileIdentity(nextIdentity)
      setIdentity(nextIdentity)
      window.dispatchEvent(new Event('gaffer-auth-changed'))
    } catch (err) {
      setBalanceError(
        err instanceof Error ? err.message : 'Balance refresh failed',
      )
    } finally {
      setBalanceBusy(false)
    }
  }

  function signOut() {
    clearProfileIdentity()
    setIdentity(null)
    setSendResult(null)
    setSendError(null)
    window.dispatchEvent(new Event('gaffer-auth-changed'))
  }

  async function sendUsdc() {
    if (!identity || !destinationAddress.trim() || !sendAmount.trim() || sendBusy) {
      return
    }
    setSendBusy(true)
    setSendError(null)
    setSendResult(null)
    try {
      const res = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationAddress,
          amount: sendAmount,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Send failed')
      }
      setSendResult(`Circle transaction ${data.transactionId}`)
      setDestinationAddress('')
      setSendAmount('')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSendBusy(false)
    }
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-sm border border-rule bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink">
          Account
        </h2>
        <span className="rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink-muted">
          {identity ? 'Signed in' : 'Signed out'}
        </span>
      </div>

      {identity ? (
        <div>
          <div className="text-lg font-semibold text-ink">{identity.email}</div>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            This Circle Arc wallet is used for unlocks, steers, room settlement,
            and payouts. No browser wallet popup is required for Circle wallet
            actions.
          </p>

          <div className="mt-3 rounded-sm border border-rule bg-secondary p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-muted">
              Circle Arc wallet
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                aria-label="Circle Arc wallet address"
                readOnly
                value={identity.address}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-xs text-accent outline-none"
              />
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="shrink-0 rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:bg-card"
              >
                {copyStatus === 'copied' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
              <span>{identity.asset ?? 'USDC (Arc Testnet)'}</span>
              <span>{identity.balance ?? '0'} USDC</span>
            </div>
            <button
              type="button"
              onClick={() => void refreshBalance()}
              disabled={balanceBusy}
              className="mt-3 w-full rounded-sm border border-rule px-3 py-2 text-xs font-semibold text-ink hover:bg-card disabled:cursor-not-allowed disabled:opacity-45"
            >
              {balanceBusy ? 'Refreshing balance...' : 'Refresh balance'}
            </button>
            {balanceError && (
              <div className="mt-2 max-w-full overflow-hidden break-words rounded-sm border border-red-500/30 bg-red-500/10 p-2 text-xs leading-5 text-red-600">
                {publicErrorMessage(balanceError, 'Balance refresh failed. Please try again.')}
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['receive', 'send'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWalletMode(mode)}
                className={`rounded-sm border px-3 py-2 text-xs font-semibold capitalize ${
                  walletMode === mode
                    ? 'border-ink bg-ink text-paper'
                    : 'border-rule text-ink hover:bg-secondary'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {walletMode === 'receive' ? (
            <div className="mt-3 rounded-sm border border-rule bg-secondary p-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                Receive USDC on Arc Testnet
              </div>
              <p className="mt-2 text-xs leading-5 text-ink-muted">
                Send Arc Testnet USDC to this exact address. This is the same
                wallet used for room unlocks, paid steers, and creator payouts.
              </p>
              <button
                type="button"
                onClick={() => void copyAddress()}
                className="mt-3 w-full rounded-sm bg-ink px-4 py-3 text-xs font-semibold text-paper"
              >
                {copyStatus === 'copied' ? 'Address copied' : 'Copy receive address'}
              </button>
            </div>
          ) : (
            <div className="mt-3 rounded-sm border border-rule bg-secondary p-3">
              <div className="font-mono text-[10px] uppercase tracking-widest text-ink-muted">
                Send Arc Testnet USDC
              </div>
              <div className="mt-3 grid gap-2">
                <input
                  value={destinationAddress}
                  onChange={(event) => setDestinationAddress(event.target.value)}
                  placeholder="Recipient wallet address"
                  className="gaffer-input"
                />
                <input
                  value={sendAmount}
                  onChange={(event) => setSendAmount(event.target.value)}
                  placeholder="Amount USDC"
                  className="gaffer-input"
                />
                <button
                  type="button"
                  onClick={() => void sendUsdc()}
                  disabled={sendBusy || !destinationAddress.trim() || !sendAmount.trim()}
                  className="rounded-sm bg-ink px-4 py-3 text-xs font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {sendBusy ? 'Sending...' : 'Send USDC'}
                </button>
              </div>
              {sendResult && (
                <div className="mt-3 rounded-sm border border-rule bg-card p-3 font-mono text-[10px] text-ink-muted">
                  {sendResult}
                </div>
              )}
              {sendError && (
                <div className="mt-3 max-w-full overflow-hidden break-words rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-600">
                  {publicErrorMessage(sendError, 'The transfer could not be sent. Please try again.')}
                </div>
              )}
            </div>
          )}

          {identity.fundingWarning && (
            <div className="mt-3 rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700">
              {publicErrorMessage(identity.fundingWarning, 'Wallet funding needs attention.')}
            </div>
          )}
          {copyStatus === 'failed' && (
            <p className="mt-2 text-xs text-amber-600">
              Copy failed. Select the address and copy manually.
            </p>
          )}
          <button
            type="button"
            onClick={signOut}
            className="mt-3 rounded-full border border-rule px-3 py-1 text-xs font-semibold text-ink hover:bg-secondary"
          >
            Sign out
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm leading-6 text-ink-muted">
            Log in or sign up with email. Gaffer creates a Circle Arc Testnet
            wallet for USDC unlocks, steers, and creator settlement.
          </p>
          <div className="mt-4 grid gap-2">
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void login()
              }}
              placeholder="you@example.com"
              className="gaffer-input"
            />
            <button
              type="button"
              onClick={() => void login()}
              disabled={busy || !email.trim()}
              className="w-full rounded-sm bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? 'Creating Circle wallet...' : 'Login or sign up'}
            </button>
          </div>
          {error && (
            <div className="mt-3 max-w-full overflow-hidden break-words rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-600">
              {publicErrorMessage(error, 'Wallet login failed. Please try again.')}
            </div>
          )}
        </div>
      )}
      {identity?.address && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-ink-muted">
          Active wallet {shortAddress(identity.address)}
        </p>
      )}
    </section>
  )
}
