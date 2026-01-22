/**
 * FDC Proof Submission Script
 * 
 * Submits FDC proofs to FLIPCore.handleFDCAttestation()
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// FLIPCore ABI (simplified)
const FLIP_CORE_ABI = [
  {
    inputs: [
      { name: "_redemptionId", type: "uint256" },
      { name: "_requestId", type: "uint256" },
      { name: "_success", type: "bool" },
    ],
    name: "handleFDCAttestation",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// Configuration
const RPC_URL = process.env.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
const FLIP_CORE_ADDRESS = process.env.FLIP_CORE_ADDRESS || "0x1151473d15F012d0Dd54f8e707dB6708BD25981F";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

/**
 * Submit FDC proof to FLIPCore
 */
export async function submitFDCProof(
  redemptionId: bigint,
  requestId: bigint,
  success: boolean
): Promise<string> {
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set in environment");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const flipCore = new ethers.Contract(FLIP_CORE_ADDRESS, FLIP_CORE_ABI, wallet);

  console.log(`Submitting FDC proof for redemption ${redemptionId}...`);
  console.log(`Request ID: ${requestId}`);
  console.log(`Success: ${success}`);

  const tx = await flipCore.handleFDCAttestation(redemptionId, requestId, success);
  console.log(`Transaction sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block ${receipt.blockNumber}`);

  return tx.hash;
}

/**
 * Parse FDC response to determine success and extract request ID
 * This is a placeholder - actual parsing depends on FDC response format
 */
export function parseFDCResponse(fdcData: string): { success: boolean; requestId: bigint } {
  // TODO: Parse actual FDC response format
  // For now, assume success and use placeholder request ID
  // In production, decode the FDC attestation response to get:
  // - Success status (payment verified or not)
  // - Request ID for matching

  try {
    // Attempt to parse as JSON
    const parsed = JSON.parse(fdcData);
    return {
      success: parsed.success !== false, // Default to true unless explicitly false
      requestId: BigInt(parsed.requestId || 0),
    };
  } catch {
    // If not JSON, assume success (placeholder)
    return {
      success: true,
      requestId: BigInt(0),
    };
  }
}

// CLI usage
if (require.main === module) {
  const redemptionId = process.argv[2];
  const requestId = process.argv[3] || "0";
  const success = process.argv[4] !== "false";

  if (!redemptionId) {
    console.error("Usage: ts-node submitProof.ts <redemption_id> [request_id] [success]");
    process.exit(1);
  }

  submitFDCProof(BigInt(redemptionId), BigInt(requestId), success)
    .then((txHash) => {
      console.log(`\nSuccess! Transaction: ${txHash}`);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

