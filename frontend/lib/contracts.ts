// FLIP v4 Contract Addresses (Coston2 Testnet - Bidirectional FLIP)
export const CONTRACTS = {
  coston2: {
    FLIPCore: '0xCb04Fa844Fa9C39eD90ed4b2F16263D2A58790ED',
    EscrowVault: '0x9e052815577D0c8b373EA1e4b248f3fB330439CF',
    SettlementReceipt: '0x990446817710a70b2F7D406fa9B1C0E7D58b5573',
    LiquidityProviderRegistry: '0x14F5176FD5FCaEA3C9fcba8eA959d254F015810A',
    OperatorRegistry: '0xB256BdBB165d1221127eEE540C77Cc5AE441F1Bb',
    PriceHedgePool: '0x5ac1Fa65f1eB888710324C42A800810a551C62fB',
    OracleRelay: '0x838FD570D3249435Cd66cE50026bb61482133ec2',
    FtsoV2Adapter: '0xea2c368772cDF6430cC9F6DD77C74c832C3a4B59',
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

