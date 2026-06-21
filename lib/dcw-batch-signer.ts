/**
 * DcwBatchSigner — bridges Circle's developer-controlled wallets (DCW) into
 * the `BatchEvmSigner` shape that `@circle-fin/x402-batching`'s
 * `BatchEvmScheme` expects.
 *
 * Why this exists:
 *   The standard x402 buyer signs payment authorizations from a wallet whose
 *   private key the buyer holds locally (browser MetaMask, or a viem
 *   `LocalAccount`). The Gaffer's wallets are custodial — the keys live on
 *   Circle's HSM and we sign by calling Circle's REST API
 *   (`client.signTypedData({walletId, data})`).
 *
 *   `BatchEvmSigner` is just a duck-typed interface (see
 *   `node_modules/@circle-fin/x402-batching/dist/hooks-DIYNWsEd.d.ts`):
 *     interface BatchEvmSigner {
 *       address: Address
 *       signTypedData(p: {domain, types, primaryType, message}) => Promise<Hex>
 *     }
 *   So any object with that shape works. This adapter is that object.
 *
 * Translation details:
 *   1. `BatchEvmScheme` passes BigInt values inside `message`. JSON.stringify
 *      can't serialize BigInts (it throws). We replace them with decimal
 *      strings before sending to Circle.
 *   2. Circle's `signTypedData` requires EIP-712 standard JSON — that means
 *      the `EIP712Domain` type must be declared explicitly inside `types`.
 *      Viem (and BatchEvmScheme) omit it because viem injects it
 *      automatically; Circle does not.
 *   3. We checksum the verifyingContract address with viem's `getAddress`
 *      to avoid case-sensitivity rejections at the Gateway.
 */
import { getAddress, type Address, type Hex } from 'viem'
import { getCircleClient } from './circle'

const EIP712_DOMAIN_TYPE = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
] as const

interface TypedDataParams {
  domain: {
    name?: string
    version?: string
    chainId?: number
    verifyingContract?: Address
  }
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, unknown>
}

/**
 * Serialize a value to a JSON-safe form: BigInts become decimal strings,
 * everything else passes through (handled by the default JSON.stringify
 * replacer signature).
 */
function jsonSafe(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString()
  return value
}

export class DcwBatchSigner {
  readonly address: Address

  /**
   * @param walletId   Circle developer-controlled wallet ID (UUID)
   * @param address    The on-chain address of that wallet (must match what
   *                   the GatewayWallet has Gateway-deposited funds for)
   */
  constructor(
    private readonly walletId: string,
    address: Address,
  ) {
    this.address = getAddress(address)
  }

  async signTypedData(params: TypedDataParams): Promise<Hex> {
    const client = getCircleClient()

    // Build a fully-self-describing EIP-712 envelope that Circle accepts.
    const eip712 = {
      types: {
        EIP712Domain: EIP712_DOMAIN_TYPE,
        ...params.types,
      },
      domain: {
        ...params.domain,
        ...(params.domain.verifyingContract
          ? { verifyingContract: getAddress(params.domain.verifyingContract) }
          : {}),
      },
      primaryType: params.primaryType,
      message: params.message,
    }

    const data = JSON.stringify(eip712, jsonSafe)

    const res = await client.signTypedData({
      walletId: this.walletId,
      data,
    })
    const sig = res.data?.signature
    if (!sig) {
      throw new Error('Circle signTypedData returned no signature')
    }
    return sig as Hex
  }
}
