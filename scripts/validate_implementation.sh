#!/bin/bash
# Validation script for FLIP implementation
# Checks that all components are properly implemented and can connect to Flare networks

set -e

echo "=== FLIP Implementation Validation ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Python dependencies
echo "1. Checking Python dependencies..."
if python3 -c "import web3, pandas, numpy, xgboost" 2>/dev/null; then
    echo -e "${GREEN}✓ Python dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠ Some Python dependencies missing (install with: pip install -r ml/requirements.txt)${NC}"
fi

# Check Go (if installed)
echo ""
echo "2. Checking Go installation..."
if command -v go &> /dev/null; then
    echo -e "${GREEN}✓ Go installed: $(go version)${NC}"
else
    echo -e "${YELLOW}⚠ Go not installed (required for oracle node)${NC}"
fi

# Validate Python scripts
echo ""
echo "3. Validating Python scripts..."
python3 -m py_compile data-pipeline/collector/ftso_history.py && echo -e "${GREEN}✓ ftso_history.py${NC}" || echo -e "${RED}✗ ftso_history.py${NC}"
python3 -m py_compile data-pipeline/collector/fdc_attestations.py && echo -e "${GREEN}✓ fdc_attestations.py${NC}" || echo -e "${RED}✗ fdc_attestations.py${NC}"
python3 -m py_compile data-pipeline/collector/fassets_redemptions.py && echo -e "${GREEN}✓ fassets_redemptions.py${NC}" || echo -e "${RED}✗ fassets_redemptions.py${NC}"
python3 -m py_compile ml/training/train_model.py && echo -e "${GREEN}✓ train_model.py${NC}" || echo -e "${RED}✗ train_model.py${NC}"

# Validate Solidity contracts
echo ""
echo "4. Validating Solidity contracts..."
if command -v npx &> /dev/null; then
    if npx hardhat compile > /dev/null 2>&1; then
        echo -e "${GREEN}✓ All contracts compile successfully${NC}"
    else
        echo -e "${RED}✗ Contract compilation failed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Hardhat not available (install with: npm install)${NC}"
fi

# Test Flare network connection
echo ""
echo "5. Testing Flare network connections..."
test_rpc() {
    local url=$1
    local name=$2
    if curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name RPC accessible${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ $name RPC not accessible (may be network issue)${NC}"
        return 1
    fi
}

test_rpc "https://coston2-api.flare.network/ext/C/rpc" "Coston2"
test_rpc "https://flare-api.flare.network/ext/C/rpc" "Flare Mainnet"

# Check file structure
echo ""
echo "6. Checking file structure..."
required_files=(
    "contracts/FLIPCore.sol"
    "contracts/InsurancePool.sol"
    "contracts/PriceHedgePool.sol"
    "contracts/OperatorRegistry.sol"
    "contracts/OracleRelay.sol"
    "ml/training/model_trainer.py"
    "ml/training/feature_engineering.py"
    "ml/training/calibration.py"
    "ml/training/backtest.py"
    "oracle/node/main.go"
    "oracle/node/predictor.go"
    "oracle/node/relay.go"
    "oracle/node/monitor.go"
)

missing_files=0
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}✗ $file missing${NC}"
        ((missing_files++))
    fi
done

# Summary
echo ""
echo "=== Validation Summary ==="
if [ $missing_files -eq 0 ]; then
    echo -e "${GREEN}✓ All core files present${NC}"
else
    echo -e "${RED}✗ $missing_files files missing${NC}"
fi

echo ""
echo "Next steps:"
echo "1. Install dependencies: pip install -r ml/requirements.txt"
echo "2. Set environment variables: FLARE_NETWORK, FTSO_REGISTRY_ADDRESS, etc."
echo "3. Collect training data: python3 ml/training/train_model.py --network coston2"
echo "4. Train model: python3 ml/training/train_model.py --model-type xgboost"
echo "5. Deploy contracts: npx hardhat deploy --network coston2"

