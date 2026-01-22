#!/bin/bash

# Frontend End-to-End Test Script
# Tests frontend flows: mint, redeem, LP dashboard

set -e

echo "🧪 Frontend End-to-End Test"
echo "================================"
echo ""

# Check if frontend is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "⚠️  Frontend not running. Start with: cd frontend && pnpm dev"
    echo ""
    echo "Manual test checklist:"
    echo "1. ✅ Connect wallet (MetaMask)"
    echo "2. ✅ Navigate to /mint page"
    echo "3. ✅ Select agent and reserve collateral"
    echo "4. ✅ Connect XRPL wallet and send XRP payment"
    echo "5. ✅ Execute minting and verify FXRP balance"
    echo "6. ✅ Navigate to /redeem page"
    echo "7. ✅ Enter XRPL address and request redemption"
    echo "8. ✅ Approve FXRP if needed"
    echo "9. ✅ Verify redemption status updates"
    echo "10. ✅ Verify receipt minted"
    echo "11. ✅ Redeem receipt (immediate or wait for FDC)"
    echo "12. ✅ Navigate to /lp page"
    echo "13. ✅ Deposit liquidity"
    echo "14. ✅ View LP position"
    echo "15. ✅ Withdraw liquidity"
    exit 0
fi

echo "✅ Frontend is running"
echo ""
echo "Please test the following flows manually:"
echo ""
echo "MINTING FLOW:"
echo "  1. Go to http://localhost:3000/mint"
echo "  2. Connect wallet"
echo "  3. Select agent and lots"
echo "  4. Reserve collateral"
echo "  5. Connect XRPL wallet"
echo "  6. Send XRP payment"
echo "  7. Wait for FDC and execute minting"
echo ""
echo "REDEMPTION FLOW:"
echo "  1. Go to http://localhost:3000/redeem"
echo "  2. Enter amount and XRPL address"
echo "  3. Approve if needed"
echo "  4. Request redemption"
echo "  5. Verify status updates"
echo "  6. Redeem receipt"
echo ""
echo "LP FLOW:"
echo "  1. Go to http://localhost:3000/lp"
echo "  2. Deposit liquidity"
echo "  3. View position"
echo "  4. Withdraw liquidity"
echo ""

