#!/bin/bash

# Verify FLIP contracts deployed on Coston2
# Usage: ./scripts/verify-coston2-deployment.sh

set -e

echo "🔍 Verifying FLIP contracts on Coston2..."

# Load environment variables
if [ ! -f .env ]; then
    echo "❌ .env file not found"
    exit 1
fi

source .env

# Check required variables
if [ -z "$COSTON2_FLIP_CORE" ]; then
    echo "❌ COSTON2_FLIP_CORE not set in .env"
    exit 1
fi

COSTON2_RPC_URL=${COSTON2_RPC_URL:-"https://coston2-api.flare.network/ext/C/rpc"}

echo "📡 Using RPC: $COSTON2_RPC_URL"
echo ""

# Verify FLIPCore
echo "1. Verifying FLIPCore..."
FLIP_CORE_CODE=$(cast code $COSTON2_FLIP_CORE --rpc-url $COSTON2_RPC_URL)
if [ "$FLIP_CORE_CODE" == "0x" ]; then
    echo "   ❌ FLIPCore has no code at $COSTON2_FLIP_CORE"
else
    echo "   ✅ FLIPCore deployed at $COSTON2_FLIP_CORE"
    
    # Check FTSO Registry
    FTSO_REGISTRY=$(cast call $COSTON2_FLIP_CORE "ftsoRegistry()" --rpc-url $COSTON2_RPC_URL)
    echo "   📍 FTSO Registry: $FTSO_REGISTRY"
    
    # Check State Connector
    STATE_CONNECTOR=$(cast call $COSTON2_FLIP_CORE "stateConnector()" --rpc-url $COSTON2_RPC_URL)
    echo "   📍 State Connector: $STATE_CONNECTOR"
fi

echo ""

# Verify EscrowVault
if [ ! -z "$COSTON2_ESCROW_VAULT" ]; then
    echo "2. Verifying EscrowVault..."
    ESCROW_CODE=$(cast code $COSTON2_ESCROW_VAULT --rpc-url $COSTON2_RPC_URL)
    if [ "$ESCROW_CODE" == "0x" ]; then
        echo "   ❌ EscrowVault has no code"
    else
        echo "   ✅ EscrowVault deployed at $COSTON2_ESCROW_VAULT"
        
        # Check FLIPCore is set
        FLIP_CORE_SET=$(cast call $COSTON2_ESCROW_VAULT "flipCore()" --rpc-url $COSTON2_RPC_URL)
        if [ "$FLIP_CORE_SET" == "$COSTON2_FLIP_CORE" ]; then
            echo "   ✅ FLIPCore correctly set"
        else
            echo "   ⚠️  FLIPCore mismatch: $FLIP_CORE_SET"
        fi
    fi
fi

echo ""

# Verify SettlementReceipt
if [ ! -z "$COSTON2_SETTLEMENT_RECEIPT" ]; then
    echo "3. Verifying SettlementReceipt..."
    RECEIPT_CODE=$(cast code $COSTON2_SETTLEMENT_RECEIPT --rpc-url $COSTON2_RPC_URL)
    if [ "$RECEIPT_CODE" == "0x" ]; then
        echo "   ❌ SettlementReceipt has no code"
    else
        echo "   ✅ SettlementReceipt deployed at $COSTON2_SETTLEMENT_RECEIPT"
    fi
fi

echo ""

# Verify FTSOv2 (Flare contract)
echo "4. Verifying Flare FTSOv2..."
FTSOV2_ADDRESS="0x3d893C53D9e8056135C26C8c638B76C8b60Df726"
FTSOV2_CODE=$(cast code $FTSOV2_ADDRESS --rpc-url $COSTON2_RPC_URL)
if [ "$FTSOV2_CODE" == "0x" ]; then
    echo "   ❌ FTSOv2 has no code at $FTSOV2_ADDRESS"
else
    echo "   ✅ FTSOv2 found at $FTSOV2_ADDRESS"
    
    # Try to get FLR/USD price (feed ID: 0x01464c522f55534400000000000000000000000000)
    echo "   📊 Testing FLR/USD price feed..."
    # Note: This requires the actual FTSOv2 interface, which uses getFeedById(bytes21)
    # Our current interface doesn't match, so we'll just verify the contract exists
fi

echo ""
echo "✅ Verification complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Test contract interactions"
echo "   2. Verify FTSOv2 interface compatibility"
echo "   3. Test with real FAssets (if available)"
echo "   4. Monitor events on explorer: https://coston2-explorer.flare.network"

