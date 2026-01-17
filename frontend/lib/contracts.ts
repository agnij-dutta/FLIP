// FLIP v3 Contract Addresses (Coston2 Testnet - Real Fund Transfers)
export const CONTRACTS = {
  coston2: {
    FLIPCore: '0x192E107c9E1adAbf7d01624AFa158d10203F8DAB',
    EscrowVault: '0x62ACcaF2A09Ae5d6d8E4A92104d1Cd16430146B4',
    SettlementReceipt: '0xE87c033A9c4371B6192Ab213380fb30955b3Bf39',
    LiquidityProviderRegistry: '0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B',
    OperatorRegistry: '0xC067A34098fDa5Cd746494636Aaaa696EB07f66a',
    PriceHedgePool: '0x790167f780F1ae511A717445074FF988FD3656f4',
    OracleRelay: '0x5501773156a002B85b33C58c74e0Fc79FF97680f',
    FtsoV2Adapter: '0x8cEDF2770E670d601394851C51e3aBFe3AB3177c',
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

