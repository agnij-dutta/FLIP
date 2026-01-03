#!/bin/bash
# Test script for FLIP contracts using Foundry

set -e

echo "🧪 Testing FLIP Contracts..."
echo ""

# Check if Foundry is installed
if ! command -v forge &> /dev/null; then
    echo "❌ Foundry not found. Installing..."
    curl -L https://foundry.paradigm.xyz | bash
    source ~/.bashrc || source ~/.zshrc
    foundryup
fi

echo "✅ Foundry version:"
forge --version
echo ""

# Compile contracts
echo "📦 Compiling contracts..."
forge build
echo ""

# Run tests
echo "🧪 Running tests..."
echo ""

echo "1. Testing DeterministicScoring library..."
forge test --match-contract DeterministicScoring -vv
echo ""

echo "2. Testing FLIPCore contract..."
forge test --match-contract FLIPCore -vv
echo ""

echo "3. Running integration tests..."
forge test --match-path "tests/integration/*" -vv
echo ""

echo "✅ All tests completed!"
echo ""
echo "📊 Test Summary:"
forge test --summary

