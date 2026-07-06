/**
 * Direct Arc Testnet RPC reads. Used to verify on-chain state independently of
 * Circle's API — this is the "real evidence" half of the anti-fake doctrine.
 */
import { createPublicClient, http, defineChain, erc20Abi, formatUnits, type Address } from 'viem'
import { env } from './env'

export const ARC_TESTNET_RPC = env.arcTestnetRpcUrl()
export const ARC_TESTNET_CHAIN_ID = 5042002
export const ARC_TESTNET_USDC_ADDRESS: Address = '0x3600000000000000000000000000000000000000'

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [ARC_TESTNET_RPC] } },
})

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_TESTNET_RPC),
})

/**
 * Read a wallet's USDC balance directly from the Arc Testnet USDC contract.
 * Returns `{ raw, formatted }` where `raw` is atomic units (6-dec) and
 * `formatted` is a human string (e.g. "1.0000").
 */
export async function readUsdcBalance(address: Address): Promise<{
  raw: bigint
  formatted: string
}> {
  const raw = await publicClient.readContract({
    address: ARC_TESTNET_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address],
  })
  return { raw, formatted: formatUnits(raw, 6) }
}
