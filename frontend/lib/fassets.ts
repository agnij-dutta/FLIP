/**
 * Flare FAssets Integration Helpers
 * 
 * Provides functions for interacting with Flare's AssetManager
 * for minting FAssets (FXRP, FBTC, etc.)
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { coston2 } from 'viem/chains';

// Coston2 RPC
const COSTON2_RPC = 'https://coston2-api.flare.network/ext/C/rpc';

// AssetManager contract address on Coston2
// This should be fetched from ContractRegistry, but for now we'll use a known address
// In production, use: ContractRegistry.getAssetManagerFXRP()
const ASSET_MANAGER_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Get from ContractRegistry

// AssetManager ABI (simplified - use full ABI from @flarenetwork/flare-periphery-contracts)
export const ASSET_MANAGER_ABI = [
  {
    inputs: [
      { name: '_agentVault', type: 'address' },
      { name: '_lots', type: 'uint256' },
      { name: '_agentFeeBIPS', type: 'uint256' },
      { name: '_executor', type: 'address' },
    ],
    name: 'reserveCollateral',
    outputs: [{ name: '_collateralReservationId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'merkleProof', type: 'bytes32[]' },
          { name: 'data', type: 'bytes' },
        ],
        name: '_proof',
        type: 'tuple',
      },
      { name: '_collateralReservationId', type: 'uint256' },
    ],
    name: 'executeMinting',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: '_offset', type: 'uint256' },
      { name: '_limit', type: 'uint256' },
    ],
    name: 'getAvailableAgentsDetailedList',
    outputs: [
      {
        components: [
          { name: 'agentVault', type: 'address' },
          { name: 'feeBIPS', type: 'uint256' },
          { name: 'freeCollateralLots', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
        name: '_agents',
        type: 'tuple[]' },
      { name: '_totalCount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_collateralReservationId', type: 'uint256' }],
    name: 'collateralReservationInfo',
    outputs: [
      {
        components: [
          { name: 'minter', type: 'address' },
          { name: 'agentVault', type: 'address' },
          { name: 'lots', type: 'uint256' },
          { name: 'valueUBA', type: 'uint256' },
          { name: 'feeUBA', type: 'uint256' },
          { name: 'lastUnderlyingBlock', type: 'uint256' },
          { name: 'lastUnderlyingTimestamp', type: 'uint256' },
          { name: 'paymentReference', type: 'bytes32' },
        ],
        name: '_info',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: '_lots', type: 'uint256' }],
    name: 'collateralReservationFee',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'assetMintingDecimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'fAsset',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export interface AgentInfo {
  agentVault: Address;
  feeBIPS: bigint;
  freeCollateralLots: bigint;
  status: number; // 0 = NORMAL, others = various states
}

export interface CollateralReservationInfo {
  minter: Address;
  agentVault: Address;
  lots: bigint;
  valueUBA: bigint; // Underlying Base Amount
  feeUBA: bigint;
  lastUnderlyingBlock: bigint;
  lastUnderlyingTimestamp: bigint;
  paymentReference: string;
}

export interface FDCProof {
  merkleProof: string[];
  data: string;
}

/**
 * Get available agents for minting
 */
export async function getAvailableAgents(
  offset: number = 0,
  limit: number = 100
): Promise<AgentInfo[]> {
  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  const result = await publicClient.readContract({
    address: ASSET_MANAGER_ADDRESS as Address,
    abi: ASSET_MANAGER_ABI,
    functionName: 'getAvailableAgentsDetailedList',
    args: [BigInt(offset), BigInt(limit)],
  });

  return result[0] as AgentInfo[];
}

/**
 * Get collateral reservation fee
 */
export async function getCollateralReservationFee(lots: number): Promise<bigint> {
  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  return await publicClient.readContract({
    address: ASSET_MANAGER_ADDRESS as Address,
    abi: ASSET_MANAGER_ABI,
    functionName: 'collateralReservationFee',
    args: [BigInt(lots)],
  });
}

/**
 * Reserve collateral for minting
 */
export async function reserveCollateral(
  agentVault: Address,
  lots: number,
  agentFeeBIPS: bigint,
  executor: Address = '0x0000000000000000000000000000000000000000',
  crfAmount: bigint // Collateral Reservation Fee amount
): Promise<{ reservationId: bigint; reservationInfo: CollateralReservationInfo }> {
  // Note: This requires a wallet client with private key
  // In the frontend, this should be called via wagmi useWriteContract hook
  // This is a helper function for the structure
  
  // The actual implementation will be in the mint page component
  // using wagmi hooks
  
  throw new Error('Use wagmi useWriteContract hook in component instead');
}

/**
 * Get collateral reservation info
 */
export async function getCollateralReservationInfo(
  reservationId: bigint
): Promise<CollateralReservationInfo> {
  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  const result = await publicClient.readContract({
    address: ASSET_MANAGER_ADDRESS as Address,
    abi: ASSET_MANAGER_ABI,
    functionName: 'collateralReservationInfo',
    args: [reservationId],
  });

  return result[0] as CollateralReservationInfo;
}

/**
 * Get asset minting decimals (for XRP, typically 6)
 */
export async function getAssetMintingDecimals(): Promise<number> {
  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  const decimals = await publicClient.readContract({
    address: ASSET_MANAGER_ADDRESS as Address,
    abi: ASSET_MANAGER_ABI,
    functionName: 'assetMintingDecimals',
  });

  return Number(decimals);
}

/**
 * Execute minting with FDC proof
 */
export async function executeMinting(
  proof: FDCProof,
  collateralReservationId: bigint
): Promise<string> {
  // Note: This requires a wallet client
  // In the frontend, this should be called via wagmi useWriteContract hook
  // This is a helper function for the structure
  
  throw new Error('Use wagmi useWriteContract hook in component instead');
}

/**
 * Fetch FDC proof from Data Availability Layer
 */
export async function fetchFDCProof(
  roundId: number,
  requestBytes: string,
  apiKey?: string
): Promise<FDCProof> {
  const response = await fetch(
    'https://coston2-api.flare.network/api/v0/fdc/get-proof-round-id-bytes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-KEY': apiKey }),
      },
      body: JSON.stringify({
        votingRoundId: roundId,
        requestBytes: requestBytes,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch FDC proof: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    merkleProof: data.proof || [],
    data: data.response || '',
  };
}

/**
 * Prepare FDC attestation request for XRP payment
 */
export async function prepareFDCAttestationRequest(
  transactionId: string,
  inUtxo: string = '0',
  utxo: string = '0',
  verifierUrl: string = 'https://verifier-coston2.flare.network',
  apiKey?: string
): Promise<{ requestBytes: string; roundId?: number }> {
  const requestBody = {
    transactionId: transactionId,
    inUtxo: inUtxo,
    utxo: utxo,
  };

  const response = await fetch(
    `${verifierUrl}/verifier/xrp/Payment/prepareRequest`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'X-API-KEY': apiKey }),
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to prepare FDC request: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    requestBytes: data.abiEncodedRequest || '',
    roundId: data.roundId,
  };
}

