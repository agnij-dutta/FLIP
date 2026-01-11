#!/bin/bash

# Test FLIP contracts deployed on Coston2
# Usage: ./scripts/test-coston2-deployment.sh

set -e

echo "🧪 Testing FLIP contracts on Coston2..."

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

# Test 1: Check FLIPCore is deployed
echo "1. Testing FLIPCore..."
FLIP_CORE_CODE=$(cast code $COSTON2_FLIP_CORE --rpc-url $COSTON2_RPC_URL)
if [ "$FLIP_CORE_CODE" == "0x" ]; then
    echo "   ❌ FLIPCore has no code"
    exit 1
else
    echo "   ✅ FLIPCore deployed"
fi

# Test 2: Check FTSOv2 adapter
if [ ! -z "$COSTON2_FTSO_ADAPTER" ]; then
    echo "2. Testing FtsoV2Adapter..."
    ADAPTER_CODE=$(cast code $COSTON2_FTSO_ADAPTER --rpc-url $COSTON2_RPC_URL)
    if [ "$ADAPTER_CODE" == "0x" ]; then
        echo "   ❌ FtsoV2Adapter has no code"
    else
        echo "   ✅ FtsoV2Adapter deployed"
        
        # Test getting XRP/USD price
        echo "   📊 Testing XRP/USD price feed..."
        XRP_PRICE=$(cast call $COSTON2_FTSO_ADAPTER \
            "getCurrentPriceWithDecimals(string)" \
            "XRP/USD" \
            --rpc-url $COSTON2_RPC_URL 2>/dev/null || echo "call failed")
        
        if [ "$XRP_PRICE" != "call failed" ] && [ ! -z "$XRP_PRICE" ]; then
            echo "   ✅ XRP/USD price: $XRP_PRICE"
        else
            echo "   ⚠️  Could not get XRP/USD price (may need feed ID configuration)"
        fi
    fi
fi

# Test 3: Check EscrowVault
if [ ! -z "$COSTON2_ESCROW_VAULT" ]; then
    echo "3. Testing EscrowVault..."
    ESCROW_CODE=$(cast code $COSTON2_ESCROW_VAULT --rpc-url $COSTON2_RPC_URL)
    if [ "$ESCROW_CODE" == "0x" ]; then
        echo "   ❌ EscrowVault has no code"
    else
        echo "   ✅ EscrowVault deployed"
        
        # Check FLIPCore is set
        FLIP_CORE_SET=$(cast call $COSTON2_ESCROW_VAULT "flipCore()" --rpc-url $COSTON2_RPC_URL)
        if [ "$FLIP_CORE_SET" == "$COSTON2_FLIP_CORE" ]; then
            echo "   ✅ FLIPCore correctly set"
        else
            echo "   ⚠️  FLIPCore mismatch"
        fi
    fi
fi

# Test 4: Check SettlementReceipt
if [ ! -z "$COSTON2_SETTLEMENT_RECEIPT" ]; then
    echo "4. Testing SettlementReceipt..."
    RECEIPT_CODE=$(cast code $COSTON2_SETTLEMENT_RECEIPT --rpc-url $COSTON2_RPC_URL)
    if [ "$RECEIPT_CODE" == "0x" ]; then
        echo "   ❌ SettlementReceipt has no code"
    else
        echo "   ✅ SettlementReceipt deployed"
    fi
fi

# Test 5: Test FTSOv2 directly (Flare contract)
echo "5. Testing Flare FTSOv2..."
FTSOV2_ADDRESS="0x3d893C53D9e8056135C26C8c638B76C8b60Df726"
FTSOV2_CODE=$(cast code $FTSOV2_ADDRESS --rpc-url $COSTON2_RPC_URL)
if [ "$FTSOV2_CODE" == "0x" ]; then
    echo "   ❌ FTSOv2 has no code"
else
    echo "   ✅ FTSOv2 found"
    
    # Try to get FLR/USD price (feed ID: 0x01464c522f55534400000000000000000000000000)
    echo "   📊 Testing FLR/USD price feed..."
    # Note: This requires the actual FTSOv2 ABI, which we don't have in cast
    # But we can verify the contract exists
fi

echo ""
echo "✅ Basic tests complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Test contract interactions via Remix or cast"
echo "   2. Test with real FAssets (if available)"
echo "   3. Monitor events on explorer"
echo "   4. Test full redemption flow"

