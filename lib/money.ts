export function addUsdc(current: number, amount: number | string): number {
  const currentAtomic = Math.round(current * 1_000_000)
  const amountAtomic = Math.round(Number(amount) * 1_000_000)
  return (currentAtomic + amountAtomic) / 1_000_000
}

export function normalizeUsdc(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}
