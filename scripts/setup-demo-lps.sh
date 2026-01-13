#!/bin/bash

# FLIP v2 - Demo LP Setup for Coston2 Testnet
# This script sets up demo liquidity providers for testing

set -e

# Load environment variables
source .env

# Network configuration
RPC_URL="${COSTON2_RPC:-https://coston2-api.flare.network/ext/C/rpc}"
LP_REGISTRY="${LP_REGISTRY_ADDRESS:-0x2CC077f1Da27e7e08A1832804B03b30A2990a61C}"

# Demo LP configurations
# LP 1: Conservative (1% min haircut, 1 hour max delay)
LP1_KEY="${LP1_PRIVATE_KEY}"
LP1_AMOUNT="10000000000000000000"  # 10 tokens (18 decimals)
LP1_HAIRCUT="10000"  # 1% (scaled: 1000000 = 100%)
LP1_DELAY="3600"  # 1 hour

# LP 2: Aggressive (0.5% min haircut, 2 hours max delay)
LP2_KEY="${LP2_PRIVATE_KEY}"
LP2_AMOUNT="20000000000000000000"  # 20 tokens
LP2_HAIRCUT="5000"  # 0.5%
LP2_DELAY="7200"  # 2 hours

# LP 3: Balanced (0.75% min haircut, 1.5 hours max delay)
LP3_KEY="${LP3_PRIVATE_KEY}"
LP3_AMOUNT="15000000000000000000"  # 15 tokens
LP3_HAIRCUT="7500"  # 0.75%
LP3_DELAY="5400"  # 1.5 hours

# Asset address (FXRP on Coston2 - update with actual address)
FXRP_ADDRESS="${FXRP_ADDRESS:-0x0000000000000000000000000000000000000000}"

echo "=== FLIP v2 Demo LP Setup ==="
echo ""
echo "Network: Coston2 Testnet"
echo "LP Registry: $LP_REGISTRY"
echo "RPC URL: $RPC_URL"
echo ""

# Check if FXRP address is set
if [ "$FXRP_ADDRESS" = "0x0000000000000000000000000000000000000000" ]; then
    echo "⚠️  Warning: FXRP_ADDRESS not set. Please update .env file."
    exit 1
fi

# Function to deposit liquidity
deposit_liquidity() {
    local lp_name=$1
    local private_key=$2
    local amount=$3
    local haircut=$4
    local delay=$5
    
    echo "Setting up $lp_name LP..."
    echo "  Amount: $amount wei"
    echo "  Min Haircut: $haircut (scaled)"
    echo "  Max Delay: $delay seconds"
    
    cast send "$LP_REGISTRY" \
        "depositLiquidity(address,uint256,uint256,uint256)" \
        "$FXRP_ADDRESS" \
        "$amount" \
        "$haircut" \
        "$delay" \
        --value "$amount" \
        --rpc-url "$RPC_URL" \
        --private-key "$private_key" \
        --gas-limit 500000
    
    echo "✅ $lp_name LP setup complete"
    echo ""
}

# Setup LPs
if [ -n "$LP1_KEY" ]; then
    deposit_liquidity "Conservative" "$LP1_KEY" "$LP1_AMOUNT" "$LP1_HAIRCUT" "$LP1_DELAY"
fi

if [ -n "$LP2_KEY" ]; then
    deposit_liquidity "Aggressive" "$LP2_KEY" "$LP2_AMOUNT" "$LP2_HAIRCUT" "$LP2_DELAY"
fi

if [ -n "$LP3_KEY" ]; then
    deposit_liquidity "Balanced" "$LP3_KEY" "$LP3_AMOUNT" "$LP3_HAIRCUT" "$LP3_DELAY"
fi

echo "=== Demo LP Setup Complete ==="
echo ""
echo "You can now test redemptions with LP matching!"
echo ""
echo "To check LP positions:"
echo "  cast call $LP_REGISTRY \"getPosition(address,address)\" <LP_ADDRESS> $FXRP_ADDRESS --rpc-url $RPC_URL"
echo ""

