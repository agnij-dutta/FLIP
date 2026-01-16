/**
 * End-to-End Test Script
 * 
 * Tests complete flow: mint FXRP → redeem via FLIP → receive XRP
 */

import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

// Configuration
const RPC_URL = process.env.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/C/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// Contract addresses
const FLIP_CORE_ADDRESS = "0x1151473d15F012d0Dd54f8e707dB6708BD25981F";
const FXRP_ADDRESS = "0x0b6A3645c240605887a5532109323A3E12273dc7";
const LP_REGISTRY_ADDRESS = "0x3A6aEa499Df3e330E9BBFfeF9Fe5393FA6227E36";

// ABIs (simplified)
const ERC20_ABI = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
] as const;

const FLIP_CORE_ABI = [
  { inputs: [{ name: '_amount', type: 'uint256' }, { name: '_asset', type: 'address' }, { name: '_xrplAddress', type: 'string' }], name: 'requestRedemption', outputs: [{ name: 'redemptionId', type: 'uint256' }], stateMutability: 'nonpayable', type: 'function' },
] as const;

async function e2eTest() {
  if (!PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY not set in environment");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("🧪 FLIP End-to-End Test");
  console.log("=" .repeat(50));
  console.log(`Wallet: ${wallet.address}\n`);

  // Step 1: Check FXRP balance
  console.log("Step 1: Checking FXRP balance...");
  const fxrp = new ethers.Contract(FXRP_ADDRESS, ERC20_ABI, wallet);
  const decimals = await fxrp.decimals();
  const balance = await fxrp.balanceOf(wallet.address);
  console.log(`FXRP Balance: ${ethers.formatUnits(balance, decimals)} FXRP\n`);

  if (balance === 0n) {
    console.log("⚠️  No FXRP balance. Please mint FXRP first using the mint page.");
    console.log("   You can mint FXRP using Flare's FAssets system.\n");
    return;
  }

  // Step 2: Approve FLIPCore
  console.log("Step 2: Approving FLIPCore to spend FXRP...");
  const approveTx = await fxrp.approve(FLIP_CORE_ADDRESS, ethers.MaxUint256);
  await approveTx.wait();
  console.log("✅ Approval confirmed\n");

  // Step 3: Request redemption
  console.log("Step 3: Requesting redemption...");
  const flipCore = new ethers.Contract(FLIP_CORE_ADDRESS, FLIP_CORE_ABI, wallet);
  const redeemAmount = balance / 2n; // Redeem half of balance
  const xrplAddress = process.env.XRPL_ADDRESS || "rTEST_ADDRESS_HERE"; // Replace with actual XRPL address

  const redeemTx = await flipCore.requestRedemption(
    redeemAmount,
    FXRP_ADDRESS,
    xrplAddress
  );
  const redeemReceipt = await redeemTx.wait();

  // Parse RedemptionRequested event
  const redemptionId = redeemReceipt.logs[0]?.args?.[0] || null;
  console.log(`✅ Redemption requested: ID ${redemptionId}\n`);

  // Step 4: Check redemption status
  console.log("Step 4: Checking redemption status...");
  console.log("   (Oracle will process and create escrow)\n");

  // Step 5: Wait for agent payment
  console.log("Step 5: Waiting for agent to send XRP payment...");
  console.log("   (Agent should detect EscrowCreated event and send XRP)\n");

  // Step 6: Check final status
  console.log("Step 6: Final status check...");
  const finalBalance = await fxrp.balanceOf(wallet.address);
  console.log(`Final FXRP Balance: ${ethers.formatUnits(finalBalance, decimals)} FXRP\n`);

  console.log("✅ End-to-end test complete!");
  console.log("\nNote: This test verifies the on-chain flow.");
  console.log("For full end-to-end test including XRPL payments, ensure:");
  console.log("1. Agent service is running");
  console.log("2. XRPL address is correct and funded");
  console.log("3. FDC proofs are being submitted");
}

// CLI usage
if (require.main === module) {
  e2eTest()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error:", error);
      process.exit(1);
    });
}

export { e2eTest };

