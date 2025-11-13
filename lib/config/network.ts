export type SupportedNetwork = 'base-mainnet' | 'base-testnet'

export interface NetworkConfig {
  key: SupportedNetwork
  name: string
  chainId: number
  rpcUrl: string
  fallbackRpcUrls: string[]
  nativeSymbol: string
  nativeDecimals: number
  usdcAddress: string
  usdcDecimals: number
  blockExplorer?: string
}

export interface TokenConfig {
  address: string
  symbol: string
  name: string
  decimals: number
  isNative?: boolean
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const DEFAULT_CONFIGS: Record<SupportedNetwork, Omit<NetworkConfig, 'rpcUrl'>> = {
  'base-mainnet': {
    key: 'base-mainnet',
    name: 'Base Mainnet',
    chainId: 8453,
    fallbackRpcUrls: [
      'https://mainnet.base.org',
      'https://developer-access-mainnet.base.org'
    ],
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    usdcDecimals: 6,
    blockExplorer: 'https://basescan.org'
  },
  'base-testnet': {
    key: 'base-testnet',
    name: 'Base Sepolia Testnet',
    chainId: 84532,
    fallbackRpcUrls: [
      'https://sepolia.base.org'
    ],
    nativeSymbol: 'ETH',
    nativeDecimals: 18,
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    usdcDecimals: 6,
    blockExplorer: 'https://sepolia.basescan.org'
  }
}

function resolveNetworkKey(): SupportedNetwork {
  const env =
    process.env.NEXT_PUBLIC_AVANTIS_NETWORK ||
    process.env.AVANTIS_NETWORK ||
    ''

  return env === 'base-testnet' ? 'base-testnet' : 'base-mainnet'
}

function resolveRpcUrl(
  network: SupportedNetwork,
  fallbacks: string[]
): string {
  if (network === 'base-mainnet') {
    return (
      process.env.NEXT_PUBLIC_BASE_RPC_URL ||
      process.env.BASE_RPC_URL ||
      fallbacks[0]
    )
  }

  return (
    process.env.NEXT_PUBLIC_BASE_TESTNET_RPC_URL ||
    process.env.BASE_TESTNET_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    process.env.BASE_RPC_URL ||
    fallbacks[0]
  )
}

export function getNetworkKey(): SupportedNetwork {
  return resolveNetworkKey()
}

export function getNetworkConfig(): NetworkConfig {
  const key = resolveNetworkKey()
  const defaults = DEFAULT_CONFIGS[key]

  return {
    ...defaults,
    rpcUrl: resolveRpcUrl(key, defaults.fallbackRpcUrls)
  }
}

export function getSupportedTokens(): TokenConfig[] {
  const network = getNetworkConfig()

  return [
    {
      address: ZERO_ADDRESS,
      symbol: network.nativeSymbol,
      name: network.nativeSymbol === 'ETH' ? 'Ethereum' : 'Native Token',
      decimals: network.nativeDecimals,
      isNative: true
    },
    {
      address: network.usdcAddress,
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: network.usdcDecimals
    }
  ]
}

export { ZERO_ADDRESS }

