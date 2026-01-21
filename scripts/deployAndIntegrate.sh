#!/bin/bash
# Deploy FLIP contracts and update all config files

set -e

echo "=== FLIP Contract Deployment & Integration ==="
echo ""

# Check PRIVATE_KEY
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY environment variable not set"
    echo "   Run: export PRIVATE_KEY=your_private_key"
    exit 1
fi

echo "✅ PRIVATE_KEY is set"
echo ""

# Deploy contracts
echo "📦 Deploying contracts to Coston2..."
DEPLOY_OUTPUT=$(forge script script/Deploy.s.sol --rpc-url https://coston2-api.flare.network/ext/C/rpc --broadcast -vvv 2>&1)

# Extract addresses from deployment output
FLIP_CORE=$(echo "$DEPLOY_OUTPUT" | grep -oP "FLIPCore deployed to: \K0x[a-fA-F0-9]{40}" | tail -1)
ESCROW_VAULT=$(echo "$DEPLOY_OUTPUT" | grep -oP "EscrowVault deployed to: \K0x[a-fA-F0-9]{40}" | tail -1)
SETTLEMENT_RECEIPT=$(echo "$DEPLOY_OUTPUT" | grep -oP "SettlementReceipt deployed to: \K0x[a-fA-F0-9]{40}" | tail -1)
LP_REGISTRY=$(echo "$DEPLOY_OUTPUT" | grep -oP "LiquidityProviderRegistry deployed to: \K0x[a-fA-F0-9]{40}" | tail -1)
OPERATOR_REGISTRY=$(echo "$DEPLOY_OUTPUT" | grep -oP "OperatorRegistry deployed to: \K0x[a-fA-F0-9]{40}" | tail -1)
PRICE_HEDGE_POOL=$(echo "$DEPLOY_OUTPUT" | grep -oP "PriceHedgePool deployed to: \K0x[a-fA-F0-9]{40}" | tail -1)
ORACLE_RELAY=$(echo "$DEPLOY_OUTPUT" | grep -oP "OracleRelay deployed to: \K0x[a-fA-F0-9]{40}" | tail -1)
FTSO_ADAPTER=$(echo "$DEPLOY_OUTPUT" | grep -oP "FtsoV2Adapter deployed to: \K0x[a-fA-F0-9]{40}" | tail -1)

if [ -z "$FLIP_CORE" ]; then
    echo "❌ Error: Could not extract FLIPCore address from deployment output"
    echo "Deployment output:"
    echo "$DEPLOY_OUTPUT" | tail -50
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "=== Deployed Addresses ==="
echo "FLIPCore: $FLIP_CORE"
echo "EscrowVault: $ESCROW_VAULT"
echo "SettlementReceipt: $SETTLEMENT_RECEIPT"
echo "LiquidityProviderRegistry: $LP_REGISTRY"
echo "OperatorRegistry: $OPERATOR_REGISTRY"
echo "PriceHedgePool: $PRICE_HEDGE_POOL"
echo "OracleRelay: $ORACLE_RELAY"
echo "FtsoV2Adapter: $FTSO_ADAPTER"
echo ""

# Update frontend/lib/contracts.ts
echo "📝 Updating frontend/lib/contracts.ts..."
sed -i "s/FLIPCore: '0x[^']*'/FLIPCore: '$FLIP_CORE'/" frontend/lib/contracts.ts
sed -i "s/EscrowVault: '0x[^']*'/EscrowVault: '$ESCROW_VAULT'/" frontend/lib/contracts.ts
sed -i "s/SettlementReceipt: '0x[^']*'/SettlementReceipt: '$SETTLEMENT_RECEIPT'/" frontend/lib/contracts.ts
sed -i "s/LiquidityProviderRegistry: '0x[^']*'/LiquidityProviderRegistry: '$LP_REGISTRY'/" frontend/lib/contracts.ts
sed -i "s/OperatorRegistry: '0x[^']*'/OperatorRegistry: '$OPERATOR_REGISTRY'/" frontend/lib/contracts.ts
sed -i "s/PriceHedgePool: '0x[^']*'/PriceHedgePool: '$PRICE_HEDGE_POOL'/" frontend/lib/contracts.ts
sed -i "s/OracleRelay: '0x[^']*'/OracleRelay: '$ORACLE_RELAY'/" frontend/lib/contracts.ts
sed -i "s/FtsoV2Adapter: '0x[^']*'/FtsoV2Adapter: '$FTSO_ADAPTER'/" frontend/lib/contracts.ts
echo "✅ Updated frontend/lib/contracts.ts"

# Update agent/config.yaml
echo "📝 Updating agent/config.yaml..."
sed -i "s/flip_core_address: \"0x[^\"]*\"/flip_core_address: \"$FLIP_CORE\"/" agent/config.yaml
sed -i "s/escrow_vault_address: \"0x[^\"]*\"/escrow_vault_address: \"$ESCROW_VAULT\"/" agent/config.yaml
echo "✅ Updated agent/config.yaml"

# Update COSTON2_DEPLOYED_ADDRESSES.md
echo "📝 Updating COSTON2_DEPLOYED_ADDRESSES.md..."
cat > COSTON2_DEPLOYED_ADDRESSES.md << EOF
# Coston2 Deployed Contract Addresses

**Deployment Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")

## Core Contracts

- **FLIPCore**: \`$FLIP_CORE\`
- **EscrowVault**: \`$ESCROW_VAULT\`
- **SettlementReceipt**: \`$SETTLEMENT_RECEIPT\`
- **LiquidityProviderRegistry**: \`$LP_REGISTRY\`
- **OperatorRegistry**: \`$OPERATOR_REGISTRY\`
- **PriceHedgePool**: \`$PRICE_HEDGE_POOL\`
- **OracleRelay**: \`$ORACLE_RELAY\`
- **FtsoV2Adapter**: \`$FTSO_ADAPTER\`

## Network

- **Chain ID**: 114 (Coston2 Testnet)
- **RPC URL**: https://coston2-api.flare.network/ext/C/rpc
- **Explorer**: https://coston2-explorer.flare.network
EOF
echo "✅ Updated COSTON2_DEPLOYED_ADDRESSES.md"

echo ""
echo "🎉 Integration complete!"
echo ""
echo "=== Next Steps ==="
echo "1. Process redemption: npx tsx scripts/processRedemption.ts 0"
echo "2. Start agent service: cd agent && go run main.go"
echo "3. Check XRPL wallet: rfXXKYA7g8knfv8PWcsPx5N1ZofFoNxrHS"
echo ""

