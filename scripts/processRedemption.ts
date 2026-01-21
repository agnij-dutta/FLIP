#!/usr/bin/env tsx
/**
 * Script to process a pending redemption by calling finalizeProvisional()
 * Now works for contract owner without requiring operator status
 */

import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { coston2 } from '../frontend/lib/chains';

// Contract addresses
const FLIP_CORE = '0x192E107c9E1adAbf7d01624AFa158d10203F8DAB' as const;

// ABIs
const FLIP_CORE_ABI = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
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
    inputs: [
      { name: '_redemptionId', type: 'uint256' },
      { name: '_priceVolatility', type: 'uint256' },
      { name: '_agentSuccessRate', type: 'uint256' },
      { name: '_agentStake', type: 'uint256' },
    ],
    name: 'finalizeProvisional',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
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
] as const;

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  const redemptionId = process.argv[2] ? BigInt(process.argv[2]) : BigInt(0);
  console.log(`Processing redemption ID: ${redemptionId}`);

  const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: coston2,
    transport: http('https://coston2-api.flare.network/ext/C/rpc'),
  });

  // Check if caller is owner
  const owner = await client.readContract({
    address: FLIP_CORE,
    abi: FLIP_CORE_ABI,
    functionName: 'owner',
  });

  console.log(`Contract owner: ${owner}`);
  console.log(`Your address: ${account.address}`);
  
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    console.log('\n⚠️  Warning: You are not the contract owner.');
    console.log('The contract has been modified to allow owner to process redemptions.');
    console.log('If you deployed it, make sure you are using the correct private key.');
  } else {
    console.log('✅ You are the contract owner - can process redemptions!');
  }

  // Check redemption status
  const redemption = await client.readContract({
    address: FLIP_CORE,
    abi: FLIP_CORE_ABI,
    functionName: 'redemptions',
    args: [redemptionId],
  });

  console.log(`\nRedemption Status: ${redemption.status} (0=Pending, 2=EscrowCreated)`);
  console.log(`Amount: ${formatEther(redemption.amount)} FXRP`);
  console.log(`XRPL Address: ${redemption.xrplAddress}`);

  if (redemption.status !== 0) {
    console.log(`⚠️  Redemption is not in Pending status. Current status: ${redemption.status}`);
    return;
  }

  // Call ownerProcessRedemption with default oracle parameters
  const priceVolatility = BigInt(50000); // 5% volatility (scaled: 1000000 = 100%)
  const agentSuccessRate = BigInt(950000); // 95% success rate
  const agentStake = parseEther('1000'); // 1000 FLR stake

  console.log('\nCalling ownerProcessRedemption()...');
  console.log('This will:');
  console.log('  1. Score the redemption');
  console.log('  2. Match LP liquidity (if available)');
  console.log('  3. Create escrow');
  console.log('  4. Mint settlement receipt NFT');
  console.log('  5. Emit EscrowCreated event (agent will detect this and send XRP)');

  try {
    const hash = await client.writeContract({
      address: FLIP_CORE,
      abi: FLIP_CORE_ABI,
      functionName: 'ownerProcessRedemption',
      args: [redemptionId, priceVolatility, agentSuccessRate, agentStake],
    });

    console.log(`\n✅ Transaction sent: ${hash}`);
    console.log('Waiting for confirmation...');
    const receipt = await client.waitForTransactionReceipt({ hash });
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    console.log('\n🎉 Escrow created! The agent service should now detect EscrowCreated event and send XRP.');
    console.log(`Check your XRPL wallet: ${redemption.xrplAddress}`);
    console.log(`\nExplorer: https://coston2-explorer.flare.network/tx/${hash}`);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message?.includes('score too low')) {
      console.log('\n💡 Tip: Try adjusting oracle parameters (priceVolatility, agentSuccessRate)');
      console.log('   Or ensure LPs are available with matching haircuts');
    }
    if (error.message?.includes('not operator') || error.message?.includes('not owner')) {
      console.log('\n💡 The contract modification may not be deployed yet.');
      console.log('   You need to redeploy FLIPCore with the new ownerProcessRedemption function.');
    }
    throw error;
  }
}

main().catch(console.error);

