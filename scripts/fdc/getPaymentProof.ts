/**
 * FDC Proof Fetching Script
 * 
 * Fetches FDC proofs for XRPL payments from the Data Availability Layer
 */

import { ethers } from "ethers";

// FDC Configuration
const VERIFIER_URL = process.env.FDC_VERIFIER_URL || "https://verifier-coston2.flare.network";
const DA_LAYER_URL = process.env.FDC_DA_LAYER_URL || "https://coston2-api.flare.network/api/v0/fdc";
const API_KEY = process.env.FDC_API_KEY || "";

export interface FDCProof {
  merkleProof: string[];
  data: string;
  roundId: number;
}

export interface AttestationRequest {
  transactionId: string;
  inUtxo: string;
  utxo: string;
}

/**
 * Prepare FDC attestation request for XRPL payment
 */
export async function prepareAttestationRequest(
  transactionId: string,
  inUtxo: string = "0",
  utxo: string = "0"
): Promise<{ requestBytes: string; roundId?: number }> {
  const url = `${VERIFIER_URL}/verifier/xrp/Payment/prepareRequest`;

  const requestBody: AttestationRequest = {
    transactionId,
    inUtxo,
    utxo,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers["X-API-KEY"] = API_KEY;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Failed to prepare attestation request: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    requestBytes: data.abiEncodedRequest || "",
    roundId: data.roundId,
  };
}

/**
 * Fetch FDC proof from Data Availability Layer
 */
export async function getPaymentProof(
  roundId: number,
  requestBytes: string
): Promise<FDCProof> {
  const url = `${DA_LAYER_URL}/get-proof-round-id-bytes`;

  const requestBody = {
    votingRoundId: roundId,
    requestBytes: requestBytes,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers["X-API-KEY"] = API_KEY;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch FDC proof: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    merkleProof: data.proof || [],
    data: data.response || "",
    roundId: roundId,
  };
}

/**
 * Complete flow: Prepare request and fetch proof
 */
export async function getFDCProofForPayment(
  xrplTxHash: string,
  waitForRound: boolean = true
): Promise<FDCProof> {
  console.log("Preparing FDC attestation request...");
  const { requestBytes, roundId } = await prepareAttestationRequest(xrplTxHash);

  if (!roundId) {
    throw new Error("No round ID returned from verifier");
  }

  console.log(`FDC Round ID: ${roundId}`);
  console.log("Waiting for FDC round confirmation (3-5 minutes)...");

  if (waitForRound) {
    // Wait for FDC round to be available
    // In production, poll for round availability
    await new Promise((resolve) => setTimeout(resolve, 3 * 60 * 1000)); // 3 minutes
  }

  console.log("Fetching proof from Data Availability Layer...");
  const proof = await getPaymentProof(roundId, requestBytes);

  console.log(`Proof fetched: ${proof.merkleProof.length} merkle proof elements`);
  return proof;
}

// CLI usage
if (require.main === module) {
  const xrplTxHash = process.argv[2];
  if (!xrplTxHash) {
    console.error("Usage: ts-node getPaymentProof.ts <xrpl_tx_hash>");
    process.exit(1);
  }

  getFDCProofForPayment(xrplTxHash)
    .then((proof) => {
      console.log("\nFDC Proof:");
      console.log(JSON.stringify(proof, null, 2));
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

