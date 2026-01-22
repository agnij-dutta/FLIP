// FLIP v4 Contract Addresses (Coston2 Testnet - Bidirectional FLIP)
export const CONTRACTS = {
  coston2: {
    FLIPCore: '0x06A84C4e441eDF8B8E1895d3166d140760FF2a39',
    EscrowVault: '0xa51FA950a5a7176D8a2fFfB26bf180fCd97102d5',
    SettlementReceipt: '0x1842f9FB8C06fC3db65D2f163080833300766205',
    LiquidityProviderRegistry: '0xC868026c361F3865100b685A8Efaf62Ff4250F1A',
    OperatorRegistry: '0xF206fb41b4a6a6729248d457EE3E62E17483A047',
    PriceHedgePool: '0xdbe6ca758Ec74cA5EA44A48568Bb51Fd3154993A',
    OracleRelay: '0xc9508412aEa096B3a9540ff148d992dB6dE6db6D',
    FtsoV2Adapter: '0xd3Cf81a38Dd815d31E31429b95A45eDc80D2ea6c',
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
  // Redemption functions
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
  // Minting functions
  {
    inputs: [
      { name: '_collateralReservationId', type: 'uint256' },
      { name: '_xrplTxHash', type: 'string' },
      { name: '_xrpAmount', type: 'uint256' },
      { name: '_asset', type: 'address' },
      { name: '_authorizeFlipExecution', type: 'bool' },
    ],
    name: 'requestMinting',
    outputs: [{ name: 'mintingId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: '_mintingId', type: 'uint256' }],
    name: 'mintingRequests',
    outputs: [
      { name: 'user', type: 'address' },
      { name: 'asset', type: 'address' },
      { name: 'collateralReservationId', type: 'uint256' },
      { name: 'xrplTxHash', type: 'string' },
      { name: 'xrpAmount', type: 'uint256' },
      { name: 'fxrpAmount', type: 'uint256' },
      { name: 'requestedAt', type: 'uint256' },
      { name: 'priceLocked', type: 'uint256' },
      { name: 'hedgeId', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'fdcRequestId', type: 'uint256' },
      { name: 'matchedLP', type: 'address' },
      { name: 'haircutRate', type: 'uint256' },
      { name: 'userAuthorizedFlip', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextMintingId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Common functions
  {
    inputs: [],
    name: 'paused',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'mintingId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'collateralReservationId', type: 'uint256' },
      { indexed: false, name: 'xrplTxHash', type: 'string' },
      { indexed: false, name: 'xrpAmount', type: 'uint256' },
    ],
    name: 'MintingRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'mintingId', type: 'uint256' },
      { indexed: true, name: 'lp', type: 'address' },
      { indexed: false, name: 'fxrpAmount', type: 'uint256' },
      { indexed: false, name: 'haircutRate', type: 'uint256' },
    ],
    name: 'MintingProvisionalSettled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'mintingId', type: 'uint256' },
      { indexed: false, name: 'success', type: 'bool' },
    ],
    name: 'MintingFinalized',
    type: 'event',
  },
  // Owner/Operator functions for processing
  {
    inputs: [
      { name: '_redemptionId', type: 'uint256' },
      { name: '_priceVolatility', type: 'uint256' },
      { name: '_agentSuccessRate', type: 'uint256' },
      { name: '_agentStake', type: 'uint256' },
    ],
    name: 'ownerProcessRedemption',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events for redemption flow
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'redemptionId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: true, name: 'asset', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'xrplAddress', type: 'string' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'RedemptionRequested',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'redemptionId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'receiptId', type: 'uint256' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'EscrowCreated',
    type: 'event',
  },
] as const;

