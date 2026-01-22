/**
 * AssetManager Resolver (Coston2 / FXRP)
 *
 * Flare docs often show `ContractRegistry.getAssetManagerFXRP()` but that's a Solidity library.
 * In the frontend we can resolve the AssetManager address directly from the FXRP token contract
 * via `assetManager()`.
 */

import { createPublicClient, http, Address } from 'viem';
import { coston2 } from './chains';
import { CONTRACTS } from './contracts';

const COSTON2_RPC = 'https://coston2-api.flare.network/ext/C/rpc';

const FXRP_ADDRESS = CONTRACTS.coston2.FXRP as Address;

const FXRP_ASSET_MANAGER_ABI = [
  {
    inputs: [],
    name: 'assetManager',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export async function getAssetManagerFXRP(): Promise<Address | null> {
  const publicClient = createPublicClient({
    chain: coston2,
    transport: http(COSTON2_RPC),
  });

  try {
    const assetManager = await publicClient.readContract({
      address: FXRP_ADDRESS,
      abi: FXRP_ASSET_MANAGER_ABI,
      functionName: 'assetManager',
    });

    if (assetManager && assetManager !== '0x0000000000000000000000000000000000000000') {
      return assetManager as Address;
    }
    return null;
  } catch {
    return null;
  }
}



