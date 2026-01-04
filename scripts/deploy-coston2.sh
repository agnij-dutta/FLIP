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
INSURANCE_POOL_ADDRESS=
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

echo "🔐 Deploying contracts to Coston2..."

# Deploy InsurancePool
echo "Deploying InsurancePool..."
INSURANCE_POOL=$(forge create InsurancePool \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ InsurancePool deployed to: $INSURANCE_POOL"

# Deploy OperatorRegistry (with min stake of 1000 FLR)
echo "Deploying OperatorRegistry..."
OPERATOR_REGISTRY=$(forge create OperatorRegistry \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args 1000000000000000000000 \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ OperatorRegistry deployed to: $OPERATOR_REGISTRY"

# Deploy PriceHedgePool (needs FTSO Registry address)
# For Coston2, use the actual FTSO Registry address
FTSO_REGISTRY="0x0000000000000000000000000000000000000000" # Update with actual address
echo "Deploying PriceHedgePool..."
PRICE_HEDGE_POOL=$(forge create PriceHedgePool \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $FTSO_REGISTRY \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ PriceHedgePool deployed to: $PRICE_HEDGE_POOL"

# Deploy StateConnector mock (for testing) or use actual address
STATE_CONNECTOR="0x0000000000000000000000000000000000000000" # Update with actual address

# Deploy FLIPCore
echo "Deploying FLIPCore..."
FLIP_CORE=$(forge create FLIPCore \
    --rpc-url $COSTON2_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $FTSO_REGISTRY $STATE_CONNECTOR $INSURANCE_POOL $PRICE_HEDGE_POOL $OPERATOR_REGISTRY \
    --legacy \
    | grep "Deployed to:" | awk '{print $3}')

echo "✅ FLIPCore deployed to: $FLIP_CORE"

# Save addresses to .env
cat >> .env << EOF

# Deployed on Coston2 Testnet
COSTON2_FLIP_CORE=$FLIP_CORE
COSTON2_INSURANCE_POOL=$INSURANCE_POOL
COSTON2_PRICE_HEDGE_POOL=$PRICE_HEDGE_POOL
COSTON2_OPERATOR_REGISTRY=$OPERATOR_REGISTRY
EOF

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "Contract addresses:"
echo "  FLIPCore: $FLIP_CORE"
echo "  InsurancePool: $INSURANCE_POOL"
echo "  PriceHedgePool: $PRICE_HEDGE_POOL"
echo "  OperatorRegistry: $OPERATOR_REGISTRY"
echo ""
echo "📝 Update frontend/app/page.tsx with FLIP_CORE_ADDRESS=$FLIP_CORE"
echo "🔍 View on explorer: https://coston2.testnet.flarescan.com/address/$FLIP_CORE"



