/**
 * Demo LP Setup Script
 * 
 * Sets up demo liquidity providers with real FLR on Coston2
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const RPC_URL = process.env.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
const LP_REGISTRY_ADDRESS = process.env.LP_REGISTRY_ADDRESS || "0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B";
const FXRP_ADDRESS = process.env.FXRP_ADDRESS || "0x0b6A3645c240605887a5532109323A3E12273dc7";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// LP Registry ABI
const LP_REGISTRY_ABI = [
  {
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_minHaircut', type: 'uint256' },
      { name: '_maxDelay', type: 'uint256' },
    ],
    name: 'depositLiquidity',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// Demo LP configurations (adjusted for smaller balances)
const DEMO_LPS = [
  {
    name: 'LP1',
    amount: ethers.parseEther('50'), // 50 FLR (smaller amount for testing)
    minHaircut: 500, // 0.05% (scaled: 1000000 = 100%) - low to allow matching
    maxDelay: 3600, // 1 hour
  },
  {
    name: 'LP2',
    amount: ethers.parseEther('50'), // 50 FLR
    minHaircut: 1000, // 0.1%
    maxDelay: 1800, // 30 minutes
  },
  {
    name: 'LP3',
    amount: ethers.parseEther('50'), // 50 FLR
    minHaircut: 2000, // 0.2%
    maxDelay: 7200, // 2 hours
  },
];

async function setupDemoLPs() {
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set in environment");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log(`Setting up demo LPs from wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(await provider.getBalance(wallet.address))} FLR\n`);

  const lpRegistry = new ethers.Contract(LP_REGISTRY_ADDRESS, LP_REGISTRY_ABI, wallet);

  for (const lp of DEMO_LPS) {
    console.log(`Setting up ${lp.name}...`);
    console.log(`  Amount: ${ethers.formatEther(lp.amount)} FLR`);
    console.log(`  Min Haircut: ${(lp.minHaircut / 10000).toFixed(2)}%`);
    console.log(`  Max Delay: ${lp.maxDelay} seconds`);

    try {
      const tx = await lpRegistry.depositLiquidity(
        FXRP_ADDRESS,
        lp.amount,
        lp.minHaircut,
        lp.maxDelay,
        { value: lp.amount }
      );

      console.log(`  Transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  ✅ Confirmed in block ${receipt.blockNumber}\n`);
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}\n`);
    }
  }

  console.log("Demo LP setup complete!");
}

// CLI usage
setupDemoLPs()
  .then(() => {
    console.log("\n✅ All demo LPs set up successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

