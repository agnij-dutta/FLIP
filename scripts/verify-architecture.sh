#!/bin/bash
# Verify FLIP architecture without running tests (structure check)

set -e

echo "🔍 Verifying FLIP Architecture..."
echo ""

# Check contract files
echo "📄 Checking contract files..."
required_contracts=(
    "contracts/FLIPCore.sol"
    "contracts/DeterministicScoring.sol"
    "contracts/InsurancePool.sol"
    "contracts/PriceHedgePool.sol"
    "contracts/OperatorRegistry.sol"
)

for contract in "${required_contracts[@]}"; do
    if [ -f "$contract" ]; then
        echo "  ✅ $contract"
    else
        echo "  ❌ $contract (MISSING)"
        exit 1
    fi
done

# Check test files
echo ""
echo "🧪 Checking test files..."
required_tests=(
    "tests/contracts/DeterministicScoring.t.sol"
    "tests/contracts/FLIPCore.t.sol"
    "tests/integration/FullFlow.t.sol"
)

for test in "${required_tests[@]}"; do
    if [ -f "$test" ]; then
        echo "  ✅ $test"
    else
        echo "  ❌ $test (MISSING)"
        exit 1
    fi
done

# Check mock contracts
echo ""
echo "🎭 Checking mock contracts..."
required_mocks=(
    "tests/contracts/mocks/MockFAsset.sol"
    "tests/contracts/mocks/MockFtsoRegistry.sol"
    "tests/contracts/mocks/MockStateConnector.sol"
)

for mock in "${required_mocks[@]}"; do
    if [ -f "$mock" ]; then
        echo "  ✅ $mock"
    else
        echo "  ⚠️  $mock (optional)"
    fi
done

# Check for OracleRelay references (should be removed)
echo ""
echo "🔍 Checking for removed dependencies..."
if grep -r "OracleRelay" contracts/FLIPCore.sol 2>/dev/null | grep -v "//" > /dev/null; then
    echo "  ⚠️  OracleRelay still referenced in FLIPCore.sol"
else
    echo "  ✅ OracleRelay removed from FLIPCore"
fi

# Check for DeterministicScoring usage
echo ""
echo "🔍 Checking deterministic scoring integration..."
if grep -q "DeterministicScoring" contracts/FLIPCore.sol; then
    echo "  ✅ FLIPCore uses DeterministicScoring"
else
    echo "  ❌ FLIPCore does not use DeterministicScoring"
    exit 1
fi

# Check documentation
echo ""
echo "📚 Checking documentation..."
docs=(
    "docs/MATHEMATICAL_MODEL.md"
    "docs/MVP_NO_ML.md"
    "TESTING_GUIDE.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo "  ✅ $doc"
    else
        echo "  ⚠️  $doc (optional)"
    fi
done

echo ""
echo "✅ Architecture verification complete!"
echo ""
echo "📊 Summary:"
echo "  - Contracts: ✅"
echo "  - Tests: ✅"
echo "  - Mocks: ✅"
echo "  - Integration: ✅"
echo ""
echo "🚀 Ready to test! Run: ./scripts/test-contracts.sh"

