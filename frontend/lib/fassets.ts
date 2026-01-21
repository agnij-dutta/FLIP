/**
 * Flare FAssets Integration Helpers
 * 
 * Provides functions for interacting with Flare's AssetManager
 * for minting FAssets (FXRP, FBTC, etc.)
 */

import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { coston2 } from './chains';
import { getAssetManagerFXRP } from './contractRegistry';

// Coston2 RPC
const COSTON2_RPC = 'https://coston2-api.flare.network/ext/C/rpc';

// AssetManager contract address on Coston2
// Resolved from FXRP token via `assetManager()`, cached in-module.
let ASSET_MANAGER_ADDRESS: Address | null = null;
let ASSET_MANAGER_ADDRESS_PROMISE: Promise<Address | null> | null = null;

/**
 * Get AssetManager address (cached, fetched from ContractRegistry)
 */
export async function getAssetManagerAddress(): Promise<Address | null> {
  if (ASSET_MANAGER_ADDRESS) {
    return ASSET_MANAGER_ADDRESS;
  }

  if (!ASSET_MANAGER_ADDRESS_PROMISE) {
    ASSET_MANAGER_ADDRESS_PROMISE = getAssetManagerFXRP();
  }

  const address = await ASSET_MANAGER_ADDRESS_PROMISE;
  if (address) {
    ASSET_MANAGER_ADDRESS = address;
  }
  
  return address;
}

async function requireAssetManagerAddress(): Promise<Address> {
  const address = await getAssetManagerAddress();
  if (!address) {
    throw new Error(
      'AssetManager address not configured or could not be resolved on Coston2. Minting FXRP requires the FXRP AssetManager contract. For testing, you can skip minting if you already have FXRP tokens.'
    );
  }
  return address;
}

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
          { name: 'ownerManagementAddress', type: 'address' },
          { name: 'feeBIPS', type: 'uint256' },
          { name: 'mintingVaultCollateralRatioBIPS', type: 'uint256' },
          { name: 'mintingPoolCollateralRatioBIPS', type: 'uint256' },
          { name: 'freeCollateralLots', type: 'uint256' },
          { name: 'status', type: 'uint8' },
        ],
        name: '_agents',
        type: 'tuple[]',
      },
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
  ownerManagementAddress: Address;
  feeBIPS: bigint;
  mintingVaultCollateralRatioBIPS: bigint;
  mintingPoolCollateralRatioBIPS: bigint;
  freeCollateralLots: bigint;
  status: number; // 0 = NORMAL, others = various states (PAUSED, LIQUIDATION, etc.)
}

// Agent status values (from FAssets)
export const AGENT_STATUS = {
  NORMAL: 0,
  PAUSED: 1,
  LIQUIDATION: 2,
  DESTROYED: 3,
} as const;

export interface CollateralReservationInfo {
  minter: Address;
  agentVault: Address;
  lots: bigint;
  valueUBA: bigint; // Underlying Base Amount
  feeUBA: bigint;
  lastUnderlyingBlock: bigint;
  lastUnderlyingTimestamp: bigint;
  paymentReference: `0x${string}`;
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
  const assetManagerAddress = await requireAssetManagerAddress();

  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  try {
    const result = await publicClient.readContract({
      address: assetManagerAddress,
      abi: ASSET_MANAGER_ABI,
      functionName: 'getAvailableAgentsDetailedList',
      args: [BigInt(offset), BigInt(limit)],
    });

    // Result is a tuple: [agents[], totalCount]
    // viem returns named tuple outputs as an object with property names
    let agents: AgentInfo[];
    if (result && typeof result === 'object' && '_agents' in result) {
      // Named tuple output
      agents = (result as any)._agents || [];
    } else if (Array.isArray(result)) {
      // Array output (positional)
      agents = (result[0] || []) as AgentInfo[];
    } else {
      console.error('Unexpected agents response format:', result);
      return [];
    }
    
    if (!Array.isArray(agents)) {
      console.error('Agents is not an array:', agents);
      return [];
    }
    
    // Parse agents with correct field names matching the updated ABI
    const parsedAgents = agents.map((agent: any) => {
      // Log raw agent data for debugging
      console.log('Raw agent data:', agent);

      // Extract fields - handle both object and array formats
      const agentVault = agent.agentVault || agent[0];
      const ownerManagementAddress = agent.ownerManagementAddress || agent[1];
      const feeBIPS = agent.feeBIPS ?? agent[2];
      const mintingVaultCollateralRatioBIPS = agent.mintingVaultCollateralRatioBIPS ?? agent[3];
      const mintingPoolCollateralRatioBIPS = agent.mintingPoolCollateralRatioBIPS ?? agent[4];
      const freeCollateralLots = agent.freeCollateralLots ?? agent[5];
      const status = agent.status ?? agent[6];

      // Convert to appropriate types
      const statusNum = typeof status === 'bigint' ? Number(status) : Number(status || 0);

      return {
        agentVault,
        ownerManagementAddress,
        feeBIPS: BigInt(feeBIPS || 0),
        mintingVaultCollateralRatioBIPS: BigInt(mintingVaultCollateralRatioBIPS || 0),
        mintingPoolCollateralRatioBIPS: BigInt(mintingPoolCollateralRatioBIPS || 0),
        freeCollateralLots: BigInt(freeCollateralLots || 0),
        status: statusNum & 0xFF, // Ensure uint8 range
      };
    });

    console.log('Parsed agents:', parsedAgents);
    return parsedAgents as AgentInfo[];
  } catch (error: any) {
    console.error('Error loading agents:', error);
    // If contract doesn't exist or function fails, return empty array
    if (error.message?.includes('not a contract') || error.message?.includes('no data')) {
      throw new Error('AssetManager contract not found or not deployed on Coston2. Minting FXRP may not be available on testnet. You can test redemption if you already have FXRP tokens.');
    }
    throw error;
  }
}

/**
 * Get collateral reservation fee
 */
export async function getCollateralReservationFee(lots: number): Promise<bigint> {
  const assetManagerAddress = await requireAssetManagerAddress();
  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  return await publicClient.readContract({
    address: assetManagerAddress,
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
  const assetManagerAddress = await requireAssetManagerAddress();
  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  const result = await publicClient.readContract({
    address: assetManagerAddress,
    abi: ASSET_MANAGER_ABI,
    functionName: 'collateralReservationInfo',
    args: [reservationId],
  });

  // `collateralReservationInfo` has a single tuple return, so viem returns the tuple directly.
  return result as unknown as CollateralReservationInfo;
}

/**
 * Get asset minting decimals (for XRP, typically 6)
 */
export async function getAssetMintingDecimals(): Promise<number> {
  const assetManagerAddress = await requireAssetManagerAddress();
  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  const decimals = await publicClient.readContract({
    address: assetManagerAddress,
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

