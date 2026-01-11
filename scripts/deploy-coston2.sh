#!/bin/bash

# Deploy FLIP contracts to Coston2 testnet
# Usage: ./scripts/deploy-coston2.sh

set -e

echo "🚀 Deploying FLIP contracts to Coston2 testnet..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating template..."
    cat > .env << EOF
# Flare Network Configuration
PRIVATE_KEY=your_private_key_here
COSTON2_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
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

# Set network to Coston2
export NETWORK=coston2
export RPC_URL=$COSTON2_RPC_URL

echo "📦 Compiling contracts..."
forge build

echo "🔐 Deploying contracts to Coston2 using forge script..."
echo "⚠️  Note: Using forge script instead of forge create for reliable broadcasting"

# Deploy all contracts using forge script
echo "Running deployment script..."
forge script script/Deploy.s.sol:Deploy \
    --rpc-url $COSTON2_RPC_URL \
    --broadcast \
    --legacy \
    -vv

echo ""
echo "✅ Deployment complete! Check the output above for contract addresses."
echo "📝 Contract addresses are also saved in: broadcast/Deploy.s.sol/114/run-latest.json"

# Deploy SettlementReceipt (needs EscrowVault address)
echo "Deploying SettlementReceipt..."
SETTLEMENT_RECEIPT_OUTPUT=$(forge create SettlementReceipt \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $ESCROW_VAULT \
    --legacy \
    --broadcast 2>&1)
SETTLEMENT_RECEIPT=$(echo "$SETTLEMENT_RECEIPT_OUTPUT" | grep "Deployed to:" | sed 's/.*Deployed to: //' | awk '{print $1}')

if [ -z "$SETTLEMENT_RECEIPT" ] || [ "$SETTLEMENT_RECEIPT" == "" ]; then
    echo "❌ Failed to deploy SettlementReceipt"
    echo "Output: $SETTLEMENT_RECEIPT_OUTPUT" | tail -20
    exit 1
fi

echo "✅ SettlementReceipt deployed to: $SETTLEMENT_RECEIPT"

# Deploy LiquidityProviderRegistry
echo "Deploying LiquidityProviderRegistry..."
LP_REGISTRY_OUTPUT=$(forge create LiquidityProviderRegistry \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy \
    --broadcast 2>&1)
LIQUIDITY_PROVIDER_REGISTRY=$(echo "$LP_REGISTRY_OUTPUT" | grep "Deployed to:" | sed 's/.*Deployed to: //' | awk '{print $1}')

if [ -z "$LIQUIDITY_PROVIDER_REGISTRY" ] || [ "$LIQUIDITY_PROVIDER_REGISTRY" == "" ]; then
    echo "❌ Failed to deploy LiquidityProviderRegistry"
    echo "Output: $LP_REGISTRY_OUTPUT" | tail -20
    exit 1
fi

echo "✅ LiquidityProviderRegistry deployed to: $LIQUIDITY_PROVIDER_REGISTRY"

# Deploy OperatorRegistry (with min stake of 1000 FLR)
echo "Deploying OperatorRegistry..."
OP_REGISTRY_OUTPUT=$(forge create OperatorRegistry \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args 1000000000000000000000 \
    --legacy \
    --broadcast 2>&1)
OPERATOR_REGISTRY=$(echo "$OP_REGISTRY_OUTPUT" | grep "Deployed to:" | sed 's/.*Deployed to: //' | awk '{print $1}')

if [ -z "$OPERATOR_REGISTRY" ] || [ "$OPERATOR_REGISTRY" == "" ]; then
    echo "❌ Failed to deploy OperatorRegistry"
    echo "Output: $OP_REGISTRY_OUTPUT" | tail -20
    exit 1
fi

echo "✅ OperatorRegistry deployed to: $OPERATOR_REGISTRY"

# Deploy FtsoV2Adapter (wraps FTSOv2 to match our IFtsoRegistry interface)
# FTSOv2 Coston2: 0x3d893C53D9e8056135C26C8c638B76C8b60Df726
FTSOV2_ADDRESS="0x3d893C53D9e8056135C26C8c638B76C8b60Df726"
echo "Deploying FtsoV2Adapter..."
FTSO_ADAPTER_OUTPUT=$(forge create FtsoV2Adapter \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $FTSOV2_ADDRESS \
    --legacy \
    --broadcast 2>&1)
FTSO_ADAPTER=$(echo "$FTSO_ADAPTER_OUTPUT" | grep "Deployed to:" | sed 's/.*Deployed to: //' | awk '{print $1}')

if [ -z "$FTSO_ADAPTER" ] || [ "$FTSO_ADAPTER" == "" ]; then
    echo "❌ Failed to deploy FtsoV2Adapter"
    echo "Output: $FTSO_ADAPTER_OUTPUT" | tail -20
    exit 1
fi

echo "✅ FtsoV2Adapter deployed to: $FTSO_ADAPTER"

# Deploy PriceHedgePool (uses adapter)
echo "Deploying PriceHedgePool..."
PHP_OUTPUT=$(forge create PriceHedgePool \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $FTSO_ADAPTER \
    --legacy \
    --broadcast 2>&1)
PRICE_HEDGE_POOL=$(echo "$PHP_OUTPUT" | grep "Deployed to:" | sed 's/.*Deployed to: //' | awk '{print $1}')

if [ -z "$PRICE_HEDGE_POOL" ] || [ "$PRICE_HEDGE_POOL" == "" ]; then
    echo "❌ Failed to deploy PriceHedgePool"
    echo "Output: $PHP_OUTPUT" | tail -20
    exit 1
fi

echo "✅ PriceHedgePool deployed to: $PRICE_HEDGE_POOL"

# State Connector address for Coston2
# Note: FDC uses ContractRegistry.getFdcVerification() in production
# For now, we'll use a placeholder - in production, use ContractRegistry
STATE_CONNECTOR="0x0000000000000000000000000000000000000000" # Will be set via ContractRegistry

# Firelight Protocol address (optional, use zero address if not available)
FIRELIGHT_PROTOCOL="0x0000000000000000000000000000000000000000" # Update with actual address

# Deploy FLIPCore (v2 with escrow-based model)
echo "Deploying FLIPCore (v2)..."
FLIP_CORE_OUTPUT=$(forge create FLIPCore \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $FTSO_ADAPTER $STATE_CONNECTOR $ESCROW_VAULT $SETTLEMENT_RECEIPT $LIQUIDITY_PROVIDER_REGISTRY $PRICE_HEDGE_POOL $OPERATOR_REGISTRY \
    --legacy \
    --broadcast 2>&1)
FLIP_CORE=$(echo "$FLIP_CORE_OUTPUT" | grep "Deployed to:" | sed 's/.*Deployed to: //' | awk '{print $1}')

if [ -z "$FLIP_CORE" ] || [ "$FLIP_CORE" == "" ]; then
    echo "❌ Failed to deploy FLIPCore"
    echo "Output: $FLIP_CORE_OUTPUT" | tail -20
    exit 1
fi

echo "✅ FLIPCore deployed to: $FLIP_CORE"

# Set FLIPCore addresses in EscrowVault and LiquidityProviderRegistry
echo "Configuring EscrowVault and LiquidityProviderRegistry..."
cast send $ESCROW_VAULT "setFLIPCore(address)" $FLIP_CORE \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy

cast send $LIQUIDITY_PROVIDER_REGISTRY "setFLIPCore(address)" $FLIP_CORE \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy

cast send $SETTLEMENT_RECEIPT "setFLIPCore(address)" $FLIP_CORE \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy

# Configure FtsoV2Adapter with feed IDs for common assets
# XRP/USD: 0x015852502f55534400000000000000000000000000
# FLR/USD: 0x01464c522f55534400000000000000000000000000
# BTC/USD: 0x014254432f55534400000000000000000000000000
echo "Configuring FtsoV2Adapter feed IDs..."
# Note: Feed IDs will be set per asset when FAssets are known
# For now, adapter has default mappings

echo "✅ Configuration complete"

# Save addresses to .env
cat >> .env << EOF

# Deployed on Coston2 Testnet (v2)
COSTON2_FLIP_CORE=$FLIP_CORE
COSTON2_ESCROW_VAULT=$ESCROW_VAULT
COSTON2_SETTLEMENT_RECEIPT=$SETTLEMENT_RECEIPT
COSTON2_LIQUIDITY_PROVIDER_REGISTRY=$LIQUIDITY_PROVIDER_REGISTRY
COSTON2_PRICE_HEDGE_POOL=$PRICE_HEDGE_POOL
COSTON2_OPERATOR_REGISTRY=$OPERATOR_REGISTRY
COSTON2_FTSO_ADAPTER=$FTSO_ADAPTER
COSTON2_FTSOV2=$FTSOV2_ADDRESS
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
echo "  FtsoV2Adapter: $FTSO_ADAPTER"
echo "  FTSOv2 (Flare): $FTSOV2_ADDRESS"
echo ""
echo "📝 Update frontend/app/page.tsx with FLIP_CORE_ADDRESS=$FLIP_CORE"
echo "🔍 View on explorer: https://coston2.testnet.flarescan.com/address/$FLIP_CORE"






