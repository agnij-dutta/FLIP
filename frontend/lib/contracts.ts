// FLIP v2 Contract Addresses (Coston2 Testnet)
export const CONTRACTS = {
  coston2: {
    FLIPCore: '0x1151473d15F012d0Dd54f8e707dB6708BD25981F',
    EscrowVault: '0x96f78a441cd5F495BdE362685B200c285e445073',
    SettlementReceipt: '0x17A223eB9D0d74265da99Ccbb994B6Ea75E4Ecb7',
    LiquidityProviderRegistry: '0x3A6aEa499Df3e330E9BBFfeF9Fe5393FA6227E36',
    OperatorRegistry: '0x98E12876aB1b38f1B6ac6ceA745f8BA703Ff2DEB',
    PriceHedgePool: '0xb8d9efA7348b7E89d308F8f6284Fbc14D2C4d3Ef',
    OracleRelay: '0xa9feC29134294e5Cb18e8125F700a1d8C354891f',
    FtsoV2Adapter: '0x05108Aa7A166B1f9A32B9bbCb0D335cd1441Ad67',
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

