#!/bin/bash

# Script to help get FXRP tokens on Coston2 testnet
# FXRP is an FAsset that needs to be minted through the FAsset system

set -e

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Network configuration
RPC_URL="${COSTON2_RPC_URL:-https://coston2-api.flare.network/ext/C/rpc}"
FXRP_ADDRESS="${FXRP_ADDRESS:-0x0b6A3645c240605887a5532109323A3E12273dc7}"

echo "=== Getting FXRP on Coston2 Testnet ==="
echo ""
echo "FXRP Address: $FXRP_ADDRESS"
echo "RPC URL: $RPC_URL"
echo ""

# Check if private key is set
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY not set in .env file"
    echo "Please set PRIVATE_KEY in .env file"
    exit 1
fi

# Get deployer address
DEPLOYER_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY" 2>/dev/null || echo "")
if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "❌ Could not derive address from PRIVATE_KEY"
    exit 1
fi

echo "Deployer Address: $DEPLOYER_ADDRESS"
echo ""

# Check current FXRP balance
echo "Checking current FXRP balance..."
BALANCE=$(cast call "$FXRP_ADDRESS" \
    "balanceOf(address)" \
    "$DEPLOYER_ADDRESS" \
    --rpc-url "$RPC_URL" 2>/dev/null || echo "0")

if [ "$BALANCE" != "0" ]; then
    BALANCE_ETH=$(cast --to-unit "$BALANCE" ether 2>/dev/null || echo "$BALANCE")
    echo "✅ Current FXRP Balance: $BALANCE_ETH FXRP"
else
    echo "⚠️  Current FXRP Balance: 0 FXRP"
fi
echo ""

# Check if FXRP contract has a mint function (for testing)
echo "Checking FXRP contract interface..."
echo ""

# Try to find mint function
echo "📝 Options to get FXRP on Coston2:"
echo ""
echo "1. **Mint FXRP through FAsset system** (requires collateral):"
echo "   - FXRP is an FAsset that requires over-collateralization"
echo "   - You need to deposit native XRP (or other collateral) to mint FXRP"
echo "   - This typically requires interacting with the FAsset Agent system"
echo ""
echo "2. **Get FXRP from someone who has minted it**:"
echo "   - Ask in Flare Discord/Telegram for testnet FXRP"
echo "   - Or use a testnet faucet if available"
echo ""
echo "3. **Check Flare documentation**:"
echo "   - https://docs.flare.network/"
echo "   - Look for 'FAssets' or 'FXRP' minting guide"
echo ""

# Try to read the contract to see available functions
echo "Checking FXRP contract functions..."
echo ""

# Common FAsset functions to check
FUNCTIONS=(
    "mint"
    "requestMint"
    "mintTo"
    "deposit"
)

echo "Available functions (if any):"
for func in "${FUNCTIONS[@]}"; do
    # Try to get function selector
    SELECTOR=$(cast sig "$func(address,uint256)" 2>/dev/null || echo "")
    if [ -n "$SELECTOR" ]; then
        echo "  - $func"
    fi
done
echo ""

# Check if there's a way to mint via cast
echo "💡 To mint FXRP, you typically need to:"
echo ""
echo "   Option A: Use Flare's FAsset UI (if available on testnet)"
echo "   - Check: https://flare.network/ecosystem/fassets"
echo ""
echo "   Option B: Interact directly with FAsset contract"
echo "   - Find the Agent contract address"
echo "   - Call requestMint() with collateral"
echo ""
echo "   Option C: Get from testnet faucet or community"
echo "   - Flare Discord: https://discord.gg/flare"
echo "   - Flare Telegram: https://t.me/flarenetwork"
echo ""

# Check contract code to see if it's a proxy or has specific functions
echo "Checking contract code..."
CODE=$(cast code "$FXRP_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || echo "")
if [ -n "$CODE" ] && [ "$CODE" != "0x" ]; then
    echo "✅ Contract exists and has code"
    CODE_LENGTH=${#CODE}
    echo "   Code length: $((CODE_LENGTH / 2)) bytes"
else
    echo "⚠️  Contract may not exist or has no code"
fi
echo ""

echo "=== Summary ==="
echo ""
echo "Your wallet: $DEPLOYER_ADDRESS"
echo "FXRP Balance: $BALANCE"
echo ""
echo "Next steps:"
echo "1. Check Flare docs for FAsset minting: https://docs.flare.network/"
echo "2. Join Flare community to get testnet FXRP"
echo "3. Or use the FAsset Agent system to mint with collateral"
echo ""

