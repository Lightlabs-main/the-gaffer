/**
 * Independent chain-side verification of a wallet's USDC balance.
 * Bypasses Circle entirely — reads straight from the Arc Testnet USDC contract.
 *
 * Usage:  npm run verify:wallet -- 0xWalletAddress
 */
import type { Address } from 'viem'
import { readUsdcBalance, ARC_TESTNET_USDC_ADDRESS, ARC_TESTNET_CHAIN_ID, ARC_TESTNET_RPC } from '../lib/chain'

async function main(): Promise<void> {
  const arg = process.argv[2]
  if (!arg || !/^0x[0-9a-fA-F]{40}$/.test(arg)) {
    console.error('Usage: npm run verify:wallet -- 0xWalletAddress')
    process.exit(1)
  }
  const address = arg as Address

  console.log(`Chain:      Arc Testnet (id ${ARC_TESTNET_CHAIN_ID}, ${ARC_TESTNET_RPC})`)
  console.log(`USDC token: ${ARC_TESTNET_USDC_ADDRESS}`)
  console.log(`Wallet:     ${address}`)

  const bal = await readUsdcBalance(address)
  console.log(`Balance:    ${bal.formatted} USDC  (raw ${bal.raw.toString()} atomic units)`)
}

main().catch((err) => {
  console.error('✗ Verify failed:', err)
  process.exit(1)
})
