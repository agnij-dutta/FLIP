#!/usr/bin/env tsx
/**
 * Complete deployment, integration, and testing script
 * 1. Deploys FLIP contracts
 * 2. Updates all config files
 * 3. Processes redemption ID 0
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { coston2 } from '../frontend/lib/chains';

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
    name: 'ownerProcessRedemption',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

function extractAddress(output: string, contractName: string): string | null {
  const regex = new RegExp(`${contractName} deployed to: (0x[a-fA-F0-9]{40})`, 'i');
  const match = output.match(regex);
  return match ? match[1] : null;
}

function updateContractsFile(flipCore: string, escrowVault: string, settlementReceipt: string, lpRegistry: string, operatorRegistry: string, priceHedgePool: string, oracleRelay: string, ftsoAdapter: string) {
  const filePath = 'frontend/lib/contracts.ts';
  let content = readFileSync(filePath, 'utf-8');
  
  content = content.replace(/FLIPCore: '0x[a-fA-F0-9]{40}'/, `FLIPCore: '${flipCore}'`);
  content = content.replace(/EscrowVault: '0x[a-fA-F0-9]{40}'/, `EscrowVault: '${escrowVault}'`);
  content = content.replace(/SettlementReceipt: '0x[a-fA-F0-9]{40}'/, `SettlementReceipt: '${settlementReceipt}'`);
  content = content.replace(/LiquidityProviderRegistry: '0x[a-fA-F0-9]{40}'/, `LiquidityProviderRegistry: '${lpRegistry}'`);
  content = content.replace(/OperatorRegistry: '0x[a-fA-F0-9]{40}'/, `OperatorRegistry: '${operatorRegistry}'`);
  content = content.replace(/PriceHedgePool: '0x[a-fA-F0-9]{40}'/, `PriceHedgePool: '${priceHedgePool}'`);
  content = content.replace(/OracleRelay: '0x[a-fA-F0-9]{40}'/, `OracleRelay: '${oracleRelay}'`);
  content = content.replace(/FtsoV2Adapter: '0x[a-fA-F0-9]{40}'/, `FtsoV2Adapter: '${ftsoAdapter}'`);
  
  writeFileSync(filePath, content, 'utf-8');
  console.log('✅ Updated frontend/lib/contracts.ts');
}

function updateAgentConfig(flipCore: string, escrowVault: string) {
  const filePath = 'agent/config.yaml';
  let content = readFileSync(filePath, 'utf-8');
  
  content = content.replace(/flip_core_address: "0x[a-fA-F0-9]{40}"/, `flip_core_address: "${flipCore}"`);
  content = content.replace(/escrow_vault_address: "0x[a-fA-F0-9]{40}"/, `escrow_vault_address: "${escrowVault}"`);
  
  writeFileSync(filePath, content, 'utf-8');
  console.log('✅ Updated agent/config.yaml');
}

async function processRedemption(flipCore: string, privateKey: string, redemptionId: bigint) {
  const account = privateKeyToAccount(`0x${privateKey.replace('0x', '')}` as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: coston2,
    transport: http('https://coston2-api.flare.network/ext/C/rpc'),
  });

  // Check redemption status
  const redemption = await client.readContract({
    address: flipCore as `0x${string}`,
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

  // Process redemption
  const priceVolatility = BigInt(50000);
  const agentSuccessRate = BigInt(950000);
  const agentStake = parseEther('1000');

  console.log('\nCalling ownerProcessRedemption()...');
  
  const hash = await client.writeContract({
    address: flipCore as `0x${string}`,
    abi: FLIP_CORE_ABI,
    functionName: 'ownerProcessRedemption',
    args: [redemptionId, priceVolatility, agentSuccessRate, agentStake],
  });

  console.log(`\n✅ Transaction sent: ${hash}`);
  console.log('Waiting for confirmation...');
  const receipt = await client.waitForTransactionReceipt({ hash });
  console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  console.log(`\n🎉 Escrow created! Agent should detect EscrowCreated event and send XRP.`);
  console.log(`Check XRPL wallet: ${redemption.xrplAddress}`);
  console.log(`Explorer: https://coston2-explorer.flare.network/tx/${hash}`);
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  console.log('=== FLIP Contract Deployment & Integration ===\n');

  // Step 1: Deploy contracts
  console.log('📦 Deploying contracts to Coston2...');
  const deployOutput = execSync(
    'forge script script/Deploy.s.sol --rpc-url https://coston2-api.flare.network/ext/C/rpc --broadcast',
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  // Extract addresses
  const flipCore = extractAddress(deployOutput, 'FLIPCore');
  const escrowVault = extractAddress(deployOutput, 'EscrowVault');
  const settlementReceipt = extractAddress(deployOutput, 'SettlementReceipt');
  const lpRegistry = extractAddress(deployOutput, 'LiquidityProviderRegistry');
  const operatorRegistry = extractAddress(deployOutput, 'OperatorRegistry');
  const priceHedgePool = extractAddress(deployOutput, 'PriceHedgePool');
  const oracleRelay = extractAddress(deployOutput, 'OracleRelay');
  const ftsoAdapter = extractAddress(deployOutput, 'FtsoV2Adapter');

  if (!flipCore) {
    console.error('❌ Error: Could not extract FLIPCore address');
    console.log('Deployment output:');
    console.log(deployOutput.slice(-1000));
    process.exit(1);
  }

  console.log('\n✅ Deployment complete!');
  console.log('\n=== Deployed Addresses ===');
  console.log(`FLIPCore: ${flipCore}`);
  console.log(`EscrowVault: ${escrowVault}`);
  console.log(`SettlementReceipt: ${settlementReceipt}`);
  console.log(`LiquidityProviderRegistry: ${lpRegistry}`);
  console.log(`OperatorRegistry: ${operatorRegistry}`);
  console.log(`PriceHedgePool: ${priceHedgePool}`);
  console.log(`OracleRelay: ${oracleRelay}`);
  console.log(`FtsoV2Adapter: ${ftsoAdapter}`);

  // Step 2: Update config files
  console.log('\n📝 Updating config files...');
  updateContractsFile(flipCore!, escrowVault!, settlementReceipt!, lpRegistry!, operatorRegistry!, priceHedgePool!, oracleRelay!, ftsoAdapter!);
  updateAgentConfig(flipCore!, escrowVault!);

  // Step 3: Process redemption
  console.log('\n🧪 Testing redemption processing...');
  await processRedemption(flipCore!, privateKey, BigInt(0));

  console.log('\n✅ All done!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

