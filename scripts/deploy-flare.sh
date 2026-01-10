#!/bin/bash

# Deploy FLIP contracts to Flare Mainnet
# Usage: ./scripts/deploy-flare.sh
# WARNING: This deploys to MAINNET. Ensure all addresses are correct!

set -e

echo "🚀 Deploying FLIP contracts to Flare Mainnet..."
echo "⚠️  WARNING: This is MAINNET deployment. Double-check all addresses!"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating template..."
    cat > .env << EOF
# Flare Network Configuration
PRIVATE_KEY=your_private_key_here
FLARE_RPC_URL=https://flare-api.flare.network/ext/C/rpc

# Contract Addresses (will be filled after deployment)
FLIP_CORE_ADDRESS=
ESCROW_VAULT_ADDRESS=
SETTLEMENT_RECEIPT_ADDRESS=
LIQUIDITY_PROVIDER_REGISTRY_ADDRESS=
PRICE_HEDGE_POOL_ADDRESS=
OPERATOR_REGISTRY_ADDRESS=
EOF
    echo "📝 Please fill in your .env file with your private key and RPC URLs"
    exit 1
fi

# Load environment variables
source .env

# Check if private key is set
if [ -z "$PRIVATE_KEY" ] || [ "$PRIVATE_KEY" == "your_private_key_here" ]; then
    echo "❌ Please set PRIVATE_KEY in .env file"
    exit 1
fi

# Confirmation prompt for mainnet
read -p "⚠️  Are you sure you want to deploy to Flare MAINNET? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

# Set network to Flare Mainnet
export NETWORK=flare
export RPC_URL=$FLARE_RPC_URL

echo "📦 Compiling contracts..."
forge build

echo "🔐 Deploying contracts to Flare Mainnet..."

# Deploy EscrowVault
echo "Deploying EscrowVault..."
ESCROW_VAULT=$(forge create EscrowVault \
    --rpc-url $FLARE_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ EscrowVault deployed to: $ESCROW_VAULT"

# Deploy SettlementReceipt (needs EscrowVault address)
echo "Deploying SettlementReceipt..."
SETTLEMENT_RECEIPT=$(forge create SettlementReceipt \
    --rpc-url $FLARE_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $ESCROW_VAULT \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ SettlementReceipt deployed to: $SETTLEMENT_RECEIPT"

# Deploy LiquidityProviderRegistry
echo "Deploying LiquidityProviderRegistry..."
LIQUIDITY_PROVIDER_REGISTRY=$(forge create LiquidityProviderRegistry \
    --rpc-url $FLARE_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ LiquidityProviderRegistry deployed to: $LIQUIDITY_PROVIDER_REGISTRY"

# Deploy OperatorRegistry (with min stake of 1000 FLR)
echo "Deploying OperatorRegistry..."
OPERATOR_REGISTRY=$(forge create OperatorRegistry \
    --rpc-url $FLARE_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args 1000000000000000000000 \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ OperatorRegistry deployed to: $OPERATOR_REGISTRY"

# Deploy PriceHedgePool (needs FTSO Registry address)
# For Flare Mainnet, use the actual FTSO Registry address
# Get from: https://docs.flare.network/tech/ftso/contracts/
FTSO_REGISTRY="0x0000000000000000000000000000000000000000" # Update with actual address
echo "⚠️  WARNING: Update FTSO_REGISTRY with actual Flare Mainnet address!"
read -p "Press Enter to continue or Ctrl+C to cancel..."

echo "Deploying PriceHedgePool..."
PRICE_HEDGE_POOL=$(forge create PriceHedgePool \
    --rpc-url $FLARE_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $FTSO_REGISTRY \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ PriceHedgePool deployed to: $PRICE_HEDGE_POOL"

# Deploy StateConnector (use actual address)
# Get from: https://docs.flare.network/tech/state-connector/contracts/
STATE_CONNECTOR="0x0000000000000000000000000000000000000000" # Update with actual address
echo "⚠️  WARNING: Update STATE_CONNECTOR with actual Flare Mainnet address!"
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Firelight Protocol address (optional, use zero address if not available)
FIRELIGHT_PROTOCOL="0x0000000000000000000000000000000000000000" # Update with actual address

# Deploy FLIPCore (v2 with escrow-based model)
echo "Deploying FLIPCore (v2)..."
FLIP_CORE=$(forge create FLIPCore \
    --rpc-url $FLARE_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $FTSO_REGISTRY $STATE_CONNECTOR $ESCROW_VAULT $SETTLEMENT_RECEIPT $LIQUIDITY_PROVIDER_REGISTRY $PRICE_HEDGE_POOL $OPERATOR_REGISTRY $FIRELIGHT_PROTOCOL \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ FLIPCore deployed to: $FLIP_CORE"

# Set FLIPCore addresses in EscrowVault and LiquidityProviderRegistry
echo "Configuring EscrowVault and LiquidityProviderRegistry..."
cast send $ESCROW_VAULT "setFLIPCore(address)" $FLIP_CORE \
    --rpc-url $FLARE_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy

cast send $LIQUIDITY_PROVIDER_REGISTRY "setFLIPCore(address)" $FLIP_CORE \
    --rpc-url $FLARE_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy

echo "✅ Configuration complete"

# Save addresses to .env
cat >> .env << EOF

# Deployed on Flare Mainnet (v2)
FLARE_FLIP_CORE=$FLIP_CORE
FLARE_ESCROW_VAULT=$ESCROW_VAULT
FLARE_SETTLEMENT_RECEIPT=$SETTLEMENT_RECEIPT
FLARE_LIQUIDITY_PROVIDER_REGISTRY=$LIQUIDITY_PROVIDER_REGISTRY
FLARE_PRICE_HEDGE_POOL=$PRICE_HEDGE_POOL
FLARE_OPERATOR_REGISTRY=$OPERATOR_REGISTRY
EOF

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Contract addresses (v2):"
echo "  FLIPCore: $FLIP_CORE"
echo "  EscrowVault: $ESCROW_VAULT"
echo "  SettlementReceipt: $SETTLEMENT_RECEIPT"
echo "  LiquidityProviderRegistry: $LIQUIDITY_PROVIDER_REGISTRY"
echo "  PriceHedgePool: $PRICE_HEDGE_POOL"
echo "  OperatorRegistry: $OPERATOR_REGISTRY"
echo ""
echo "📝 Update frontend/app/page.tsx with FLIP_CORE_ADDRESS=$FLIP_CORE"
echo "🔍 View on explorer: https://flarescan.com/address/$FLIP_CORE"
echo ""
echo "⚠️  IMPORTANT: Verify all contract addresses on explorer before use!"

