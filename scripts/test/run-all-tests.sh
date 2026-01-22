#!/bin/bash

# Comprehensive Test Suite Runner
# Runs all tests: contracts, integration, e2e

set -e

echo "🧪 FLIP Comprehensive Test Suite"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0

# Function to run test and track results
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo -e "${YELLOW}Running: ${test_name}${NC}"
    if eval "$test_command"; then
        echo -e "${GREEN}✅ ${test_name} PASSED${NC}\n"
        ((PASSED++))
    else
        echo -e "${RED}❌ ${test_name} FAILED${NC}\n"
        ((FAILED++))
    fi
}

# 1. Contract Unit Tests
echo "=== Contract Unit Tests ==="
run_test "FLIPCore Tests" "forge test --match-contract FLIPCoreTest -vv"
run_test "EscrowVault Tests" "forge test --match-contract EscrowVaultTest -vv"
run_test "SettlementReceipt Tests" "forge test --match-contract SettlementReceiptTest -vv"
run_test "LiquidityProviderRegistry Tests" "forge test --match-contract LiquidityProviderRegistryTest -vv"

# 2. Integration Tests
echo "=== Integration Tests ==="
run_test "Contract Integration Tests" "forge test --match-contract ContractIntegrationTest -vv"
run_test "Full Flow Tests" "forge test --match-contract FullFlowTest -vv"

# 3. End-to-End Tests
echo "=== End-to-End Tests ==="
run_test "Comprehensive E2E Tests" "forge test --match-contract ComprehensiveE2ETest -vv"

# 4. Stress Tests
echo "=== Stress Tests ==="
run_test "Escrow Stress Tests" "forge test --match-contract EscrowStressTest -vv"

# Summary
echo "=================================="
echo "Test Summary:"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo "=================================="

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

