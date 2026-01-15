#!/bin/bash

# Script to mint FXRP on Coston2 testnet
# This attempts to mint FXRP through the FAsset system

set -e

# Load environment variables
if [ -f .env ]; then
    source .env
fi

# Network configuration
RPC_URL="${COSTON2_RPC_URL:-https://coston2-api.flare.network/ext/C/rpc}"
FXRP_ADDRESS="${FXRP_ADDRESS:-0x0b6A3645c240605887a5532109323A3E12273dc7}"

echo "=== Mint FXRP on Coston2 Testnet ==="
echo ""

# Check if private key is set
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ PRIVATE_KEY not set in .env file"
    exit 1
fi

# Get deployer address
DEPLOYER_ADDRESS=$(cast wallet address --private-key "$PRIVATE_KEY" 2>/dev/null || echo "")
if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "❌ Could not derive address from PRIVATE_KEY"
    exit 1
fi

echo "Deployer: $DEPLOYER_ADDRESS"
echo "FXRP Contract: $FXRP_ADDRESS"
echo ""

# Check current balance
BALANCE=$(cast call "$FXRP_ADDRESS" \
    "balanceOf(address)" \
    "$DEPLOYER_ADDRESS" \
    --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
BALANCE_ETH=$(cast --to-unit "$BALANCE" ether 2>/dev/null || echo "$BALANCE")
echo "Current FXRP Balance: $BALANCE_ETH FXRP"
echo ""

# Note: FXRP minting typically requires:
# 1. Finding the FAsset Agent contract
# 2. Depositing collateral (native XRP or FLR)
# 3. Calling requestMint() or similar function
# 
# On testnet, this is complex. Instead, we recommend:
# - Getting FXRP from Flare community (Discord/Telegram)
# - Or using Flare's FAsset UI if available on testnet

echo "⚠️  Direct minting via script is complex on testnet."
echo ""
echo "📝 Recommended approaches:"
echo ""
echo "1. **Flare Community** (Easiest):"
echo "   - Join Flare Discord: https://discord.gg/flare"
echo "   - Ask for testnet FXRP in #testnet or #fassets channel"
echo "   - Someone can send you testnet FXRP"
echo ""
echo "2. **Flare FAsset UI** (If available):"
echo "   - Check: https://flare.network/ecosystem/fassets"
echo "   - Use the UI to mint FXRP with collateral"
echo ""
echo "3. **Manual Minting** (Advanced):"
echo "   - Find FAsset Agent contract on Coston2"
echo "   - Deposit collateral (native XRP or FLR)"
echo "   - Call requestMint() function"
echo "   - See Flare docs: https://docs.flare.network/"
echo ""

# Try to find Agent contract (if we know the pattern)
echo "🔍 Checking for FAsset Agent contract..."
echo ""

# Common Agent contract patterns (these may not exist on testnet)
AGENT_PATTERNS=(
    "0x1000000000000000000000000000000000000001"  # Common placeholder
    "0x0000000000000000000000000000000000000000"  # Zero address
)

# Check if FXRP contract has an agent() or getAgent() function
echo "Checking FXRP contract for agent address..."
AGENT_ADDRESS=$(cast call "$FXRP_ADDRESS" \
    "agent()" \
    --rpc-url "$RPC_URL" 2>/dev/null || echo "")

if [ -n "$AGENT_ADDRESS" ] && [ "$AGENT_ADDRESS" != "0x0000000000000000000000000000000000000000" ]; then
    echo "✅ Found Agent: $AGENT_ADDRESS"
    echo ""
    echo "You can try to mint via:"
    echo "  cast send $AGENT_ADDRESS \"requestMint(...)\" ..."
    echo "  (See Flare docs for exact parameters)"
else
    echo "⚠️  Could not find Agent contract address"
    echo "   FXRP contract may not expose agent() function"
fi
echo ""

echo "=== Summary ==="
echo ""
echo "Your wallet: $DEPLOYER_ADDRESS"
echo "Current FXRP: $BALANCE_ETH"
echo ""
echo "💡 Quickest way: Ask Flare community for testnet FXRP"
echo "   Discord: https://discord.gg/flare"
echo ""

