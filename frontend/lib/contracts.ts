// FLIP v3 Contract Addresses (Coston2 Testnet - Real Fund Transfers)
export const CONTRACTS = {
  coston2: {
    FLIPCore: '0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15',
    EscrowVault: '0x414319C341F9f63e92652ee5e2B1231E675F455e',
    SettlementReceipt: '0x2FDd4bb68F88449A9Ce48689a55D442b9B247C73',
    LiquidityProviderRegistry: '0x611054f7428B6C92AAacbDe41D62877FFEd12F84',
    OperatorRegistry: '0x944Eaa134707bA703F11562ee39727acdF7842Fc',
    PriceHedgePool: '0xD9DFB051c432F830BB02F9CE8eE3abBB0378a589',
    OracleRelay: '0x4FeC52DD1b0448a946d2147d5F91A925a5C6C8BA',
    FtsoV2Adapter: '0xbb1cBE0a82B0D71D40F0339e7a05baf424aE1392',
    // FAssets (Coston2 Testnet)
    FXRP: '0x0b6A3645c240605887a5532109323A3E12273dc7', // FXRP Token from Asset Manager
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
      { name: '_xrplAddress', type: 'string' },
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
      { name: 'requestedAt', type: 'uint256' },
      { name: 'priceLocked', type: 'uint256' },
      { name: 'hedgeId', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'fdcRequestId', type: 'uint256' },
      { name: 'provisionalSettled', type: 'bool' },
      { name: 'xrplAddress', type: 'string' },
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

