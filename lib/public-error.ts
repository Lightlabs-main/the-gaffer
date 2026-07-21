export function publicErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback
  const normalized = message.toLowerCase()

  if (
    normalized.includes('insufficient funds') ||
    normalized.includes('insufficient balance') ||
    normalized.includes('asset amount owned')
  ) {
    return 'This wallet needs Arc Testnet USDC before it can unlock or steer.'
  }

  if (
    normalized.includes('rpc request failed') ||
    normalized.includes('no url was provided to the transport') ||
    normalized.includes('contract call') ||
    normalized.includes('request body:') ||
    normalized.includes('viem@')
  ) {
    return 'Arc could not verify this wallet right now. Refresh the balance and try again.'
  }

  if (normalized.includes('x402 payment required')) {
    return 'Payment preparation is incomplete. Refresh the wallet, then try the paid action again.'
  }

  const firstLine = message.split(/\r?\n/, 1)[0]?.trim()
  if (!firstLine) return fallback
  return firstLine.length > 180 ? `${firstLine.slice(0, 177)}...` : firstLine
}
