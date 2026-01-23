// FLIP v5 Contract Addresses (Coston2 Testnet - BlazeSwap Backstop)
export const CONTRACTS = {
  coston2: {
    FLIPCore: '0x5743737990221c92769D3eF641de7B633cd0E519',
    EscrowVault: '0xF3995d7766D807EFeE60769D45973FfC176E1b0c',
    SettlementReceipt: '0x159dCc41173bFA5924DdBbaAf14615E66aa7c6Ec',
    LiquidityProviderRegistry: '0xbc8423cd34653b1D64a8B54C4D597d90C4CEe100',
    OperatorRegistry: '0x1e6DDfcA83c483c79C82230Ea923C57c1ef1A626',
    PriceHedgePool: '0x4d4B47B0EA1Ca02Cc382Ace577A20580864a24e2',
    OracleRelay: '0x4FcF689B7E70ad80714cA7e977Eb9de85064759d',
    FtsoV2Adapter: '0x82B8723D957Eb2a2C214637552255Ded46e2664D',
    BlazeFLIPVault: '0x678D95C2d75289D4860cdA67758CB9BFdac88611',
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

// BlazeFLIPVault ABI
export const BLAZE_VAULT_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [{ name: 'sharesReceived', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: '_shares', type: 'uint256' }],
    name: 'withdraw',
    outputs: [{ name: 'amountReceived', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claimEarnings',
    outputs: [{ name: 'earned', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'rebalance',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'sharePrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_depositor', type: 'address' }],
    name: 'balanceOfUnderlying',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'shares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalShares',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'backstopEnabled',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'allocationRatio',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalHaircutsEarned',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_depositor', type: 'address' }],
    name: 'getPendingEarnings',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'depositTimestamp',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'minDepositDelay',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'deployedToFlip',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getVaultStats',
    outputs: [
      { name: 'totalAssetsOut', type: 'uint256' },
      { name: 'totalSharesOut', type: 'uint256' },
      { name: 'deployedToFlipOut', type: 'uint256' },
      { name: 'deployedToMintingOut', type: 'uint256' },
      { name: 'idleBalanceOut', type: 'uint256' },
      { name: 'targetDeploymentOut', type: 'uint256' },
      { name: 'needsRebalanceOut', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'depositor', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'sharesReceived', type: 'uint256' },
    ],
    name: 'Deposited',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'depositor', type: 'address' },
      { indexed: false, name: 'shares', type: 'uint256' },
      { indexed: false, name: 'amountReceived', type: 'uint256' },
    ],
    name: 'Withdrawn',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'depositor', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'EarningsClaimed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'deployedAfter', type: 'uint256' },
      { indexed: false, name: 'idleAfter', type: 'uint256' },
    ],
    name: 'Rebalanced',
    type: 'event',
  },
] as const;
