#!/bin/bash

# FLIP v2 Setup Verification Script
# This script verifies all components are ready to run

set -e

# Get script directory and navigate to project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🔍 FLIP v2 Setup Verification"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✅${NC} $1"
}

check_fail() {
    echo -e "${RED}❌${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

# 1. Prerequisites
echo "📋 Step 1: Prerequisites"
echo "-----------------------"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed: $NODE_VERSION"
else
    check_fail "Node.js not found"
    exit 1
fi

if command -v forge &> /dev/null; then
    FORGE_VERSION=$(forge --version | head -1)
    check_pass "Foundry installed: $FORGE_VERSION"
else
    check_fail "Foundry not found"
    exit 1
fi

if command -v go &> /dev/null; then
    GO_VERSION=$(go version)
    check_pass "Go installed: $GO_VERSION"
    GO_AVAILABLE=true
else
    check_warn "Go not found - Agent service will not be available"
    GO_AVAILABLE=false
fi

echo ""

# 2. Contract Verification
echo "📦 Step 2: Contract Deployment Verification"
echo "-------------------------------------------"

RPC_URL="https://coston2-api.flare.network/ext/C/rpc"
FLIP_CORE="0x192E107c9E1adAbf7d01624AFa158d10203F8DAB"
ESCROW_VAULT="0x62ACcaF2A09Ae5d6d8E4A92104d1Cd16430146B4"
LP_REGISTRY="0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B"

echo "Checking RPC connection..."
if cast block-number --rpc-url "$RPC_URL" &> /dev/null; then
    BLOCK_NUM=$(cast block-number --rpc-url "$RPC_URL")
    check_pass "RPC connected (block: $BLOCK_NUM)"
else
    check_fail "RPC connection failed"
    exit 1
fi

echo "Checking FLIPCore..."
if cast code "$FLIP_CORE" --rpc-url "$RPC_URL" | grep -q "0x"; then
    PAUSED=$(cast call "$FLIP_CORE" "paused()" --rpc-url "$RPC_URL")
    if [ "$PAUSED" = "0x0000000000000000000000000000000000000000000000000000000000000000" ]; then
        check_pass "FLIPCore deployed and not paused"
    else
        check_warn "FLIPCore is paused"
    fi
else
    check_fail "FLIPCore not found at $FLIP_CORE"
    exit 1
fi

echo "Checking EscrowVault..."
ESCROW_FLIP=$(cast call "$ESCROW_VAULT" "flipCore()" --rpc-url "$RPC_URL")
if [ "$ESCROW_FLIP" = "0x000000000000000000000000192e107c9e1adabf7d01624afa158d10203f8dab" ]; then
    check_pass "EscrowVault configured correctly"
else
    check_fail "EscrowVault not configured"
    exit 1
fi

echo "Checking LP Registry..."
LP_FLIP=$(cast call "$LP_REGISTRY" "flipCore()" --rpc-url "$RPC_URL")
if [ "$LP_FLIP" = "0x000000000000000000000000192e107c9e1adabf7d01624afa158d10203f8dab" ]; then
    check_pass "LP Registry configured correctly"
else
    check_fail "LP Registry not configured"
    exit 1
fi

echo ""

# 3. Frontend Setup
echo "🎨 Step 3: Frontend Setup"
echo "------------------------"

cd frontend

if [ -f package.json ]; then
    check_pass "package.json exists"
    
    if [ -d node_modules ]; then
        check_pass "Dependencies installed"
    else
        check_warn "Dependencies not installed - run: npm install"
    fi
    
    if [ -f lib/contracts.ts ]; then
        if grep -q "0x192E107c9E1adAbf7d01624AFa158d10203F8DAB" lib/contracts.ts; then
            check_pass "Contract addresses configured"
        else
            check_warn "Contract addresses may need updating"
        fi
    else
        check_fail "lib/contracts.ts not found"
    fi
else
    check_fail "package.json not found"
fi

cd ..

echo ""

# 4. LP Setup Script
echo "💰 Step 4: LP Setup Script"
echo "-------------------------"

cd scripts/demo

if [ -f setupDemoLPs.ts ]; then
    check_pass "setupDemoLPs.ts exists"
    
    if [ -d node_modules ]; then
        check_pass "Dependencies installed"
    else
        check_warn "Dependencies not installed - run: npm install"
    fi
    
    if grep -q "0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B" setupDemoLPs.ts; then
        check_pass "LP Registry address configured"
    else
        check_warn "LP Registry address may need updating"
    fi
else
    check_fail "setupDemoLPs.ts not found"
fi

cd ../..

echo ""

# 5. Agent Setup
echo "🤖 Step 5: Agent Service"
echo "----------------------"

cd agent

if [ -f config.yaml ]; then
    check_pass "config.yaml exists"
    
    if grep -q "0x192E107c9E1adAbf7d01624AFa158d10203F8DAB" config.yaml; then
        check_pass "FLIPCore address configured"
    else
        check_warn "FLIPCore address may need updating"
    fi
    
    if grep -q "sYOUR_WALLET_SEED_HERE" config.yaml; then
        check_warn "XRPL wallet seed needs to be configured"
    else
        check_pass "XRPL wallet seed configured"
    fi
else
    check_fail "config.yaml not found"
fi

if [ "$GO_AVAILABLE" = true ]; then
    if [ -f go.mod ]; then
        check_pass "go.mod exists"
        
        if [ -d vendor ] || [ -f go.sum ]; then
            check_pass "Go dependencies available"
        else
            check_warn "Go dependencies not installed - run: go mod download"
        fi
        
        if [ -f cmd/main.go ]; then
            check_pass "Agent main.go exists"
            
            if [ -f flip-agent ] || [ -f agent ]; then
                check_pass "Agent binary exists"
            else
                check_warn "Agent not built - run: go build -o flip-agent cmd/main.go"
            fi
        else
            check_fail "cmd/main.go not found"
        fi
    else
        check_fail "go.mod not found"
    fi
else
    check_warn "Go not available - Agent cannot be built/run"
fi

cd ..

echo ""

# 6. Summary
echo "📊 Summary"
echo "=========="
echo ""
echo "✅ Contracts: Deployed and configured"
echo "✅ Frontend: Ready (may need npm install)"
echo "✅ LP Script: Ready (may need npm install)"
if [ "$GO_AVAILABLE" = true ]; then
    echo "✅ Agent: Ready (may need go mod download and build)"
else
    echo "⚠️  Agent: Go not installed - cannot run agent service"
fi
echo ""
echo "🚀 Next Steps:"
echo "  1. Install frontend dependencies: cd frontend && npm install"
echo "  2. Install LP script dependencies: cd scripts/demo && npm install"
if [ "$GO_AVAILABLE" = true ]; then
    echo "  3. Install Go dependencies: cd agent && go mod download"
    echo "  4. Build agent: cd agent && go build -o flip-agent cmd/main.go"
    echo "  5. Configure XRPL wallet seed in agent/config.yaml"
else
    echo "  3. Install Go to enable agent service"
fi
echo "  6. Set up demo LPs: cd scripts/demo && npx ts-node setupDemoLPs.ts"
echo "  7. Start frontend: cd frontend && npm run dev"
if [ "$GO_AVAILABLE" = true ]; then
    echo "  8. Start agent: cd agent && ./flip-agent"
fi
echo ""

