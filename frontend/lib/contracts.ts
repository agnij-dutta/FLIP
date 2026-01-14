// FLIP v2 Contract Addresses (Coston2 Testnet)
export const CONTRACTS = {
  coston2: {
    FLIPCore: '0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387',
    EscrowVault: '0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC',
    SettlementReceipt: '0x0Ff7d4E7aF64059426F76d2236155ef1655C99D8',
    LiquidityProviderRegistry: '0x2CC077f1Da27e7e08A1832804B03b30A2990a61C',
    OperatorRegistry: '0x21b165aE60748410793e4c2ef248940dc31FE773',
    PriceHedgePool: '0xb9Df841a5b5f4a7f23F2294f3eecB5b2e2F53CFD',
    OracleRelay: '0x5Fd855d2592feba675E5E8284c830fE1Cefb014E',
    FtsoV2Adapter: '0x4D1E494CaB138D8c23B18c975b49C1Bec7902746',
  },
  networks: {
    coston2: {
      id: 114,
      name: 'Coston2',
      rpc: 'https://coston2-api.flare.network/ext/C/rpc',
      explorer: 'https://coston2-explorer.flare.network',
    },
  },
} as const;

// Common ABIs (simplified - use full ABIs from artifacts in production)
export const FLIP_CORE_ABI = [
  {
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_asset', type: 'address' },
    ],
    name: 'requestRedemption',
    outputs: [{ name: 'redemptionId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_redemptionId', type: 'uint256' }],
    name: 'redemptions',
    outputs: [
      { name: 'user', type: 'address' },
      { name: 'asset', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'receiptId', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextRedemptionId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

