#!/bin/bash
# Quick demo setup script

set -e

echo "🚀 Setting up FLIP demo on Coston2..."

# Load .env
source .env

# Set new contract addresses
export LP_REGISTRY_ADDRESS="0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B"
export FLIP_CORE_ADDRESS="0x192E107c9E1adAbf7d01624AFa158d10203F8DAB"
export FXRP_ADDRESS="0x0b6A3645c240605887a5532109323A3E12273dc7"

echo "📝 Contract Addresses:"
echo "  LP Registry: $LP_REGISTRY_ADDRESS"
echo "  FLIP Core: $FLIP_CORE_ADDRESS"
echo "  FXRP: $FXRP_ADDRESS"
echo ""

# Setup demo LPs
echo "💰 Setting up demo LPs..."
if command -v tsx &> /dev/null; then
    tsx scripts/demo/setupDemoLPs.ts
else
    echo "⚠️  tsx not found, install with: npm install -g tsx"
    echo "   Or run manually with node/ts-node"
fi

echo ""
echo "✅ Demo setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure agent: Update agent/config.yaml with FLIP_CORE_ADDRESS"
echo "2. Start agent: cd agent && go run main.go"
echo "3. Test redemption flow on frontend"
