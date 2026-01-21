# FLIP Protocol - Deployment Guide

**Last Updated**: January 2026  
**Network**: Coston2 Testnet (Chain ID 114)

This is the master deployment guide consolidating all deployment and setup documentation.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Contract Deployment](#contract-deployment)
4. [Configuration](#configuration)
5. [Agent Setup](#agent-setup)
6. [Frontend Setup](#frontend-setup)
7. [LP Setup](#lp-setup)
8. [Verification](#verification)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

For a complete setup walkthrough, see:
- **Quick Start Guide**: [`QUICK_START.md`](../QUICK_START.md) - 5-minute test setup
- **Run Instructions**: [`RUN_INSTRUCTIONS.md`](../RUN_INSTRUCTIONS.md) - Complete step-by-step guide

---

## Prerequisites

### Required Software

- **Node.js** >= 18
- **Foundry** (Forge) - Latest version
- **Go** >= 1.21 (for agent service)
- **Python** >= 3.10 (optional, for data pipeline)

### Installation

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install Node.js dependencies
npm install

# Install Go dependencies (for agent)
cd agent
go mod download
cd ..
```

### Testnet Funds

**Coston2 FLR** (for gas):
- Faucet: https://coston2-faucet.towolabs.com/
- Or: https://faucet.flare.network/

**XRPL Testnet XRP** (for agent payments):
- Faucet: https://xrpl.org/xrp-testnet-faucet.html

---

## Contract Deployment

### Deployment Script

**File**: `script/Deploy.s.sol`

```bash
# Set your Coston2 private key
export PRIVATE_KEY=your_private_key_here

# Deploy all contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --broadcast \
  --verify \
  --etherscan-api-key YOUR_ETHERSCAN_API_KEY
```

### Deployed Addresses

**Current Deployment** (January 2026):

| Contract | Address (Coston2) |
|----------|-------------------|
| FLIPCore | `0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15` |
| EscrowVault | `0x414319C341F9f63e92652ee5e2B1231E675F455e` |
| SettlementReceipt | `0x2FDd4bb68F88449A9Ce48689a55D442b9B247C73` |
| LiquidityProviderRegistry | `0x611054f7428B6C92AAacbDe41D62877FFEd12F84` |
| OperatorRegistry | `0x944Eaa134707bA703F11562ee39727acdF7842Fc` |
| PriceHedgePool | `0xD9DFB051c432F830BB02F9CE8eE3abBB0378a589` |
| OracleRelay | `0x4FeC52DD1b0448a946d2147d5F91A925a5C6C8BA` |
| FtsoV2Adapter | `0xbb1cBE0a82B0D71D40F0339e7a05baf424aE1392` |

**See**: [`COSTON2_DEPLOYED_ADDRESSES.md`](../COSTON2_DEPLOYED_ADDRESSES.md) for full details

### Post-Deployment Configuration

After deployment, contracts are automatically configured with:
- ✅ EscrowVault.setFLIPCore()
- ✅ EscrowVault.setSettlementReceipt()
- ✅ LiquidityProviderRegistry.setFLIPCore()
- ✅ LiquidityProviderRegistry.setEscrowVault()
- ✅ SettlementReceipt.setFLIPCore()

**Verify Configuration**:
```bash
# Check FLIPCore is set in EscrowVault
cast call 0x414319C341F9f63e92652ee5e2B1231E675F455e "flipCore()" \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

---

## Configuration

### Frontend Configuration

**File**: `frontend/lib/contracts.ts`

Update with deployed addresses:
```typescript
export const CONTRACTS = {
  coston2: {
    FLIPCore: "0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15",
    EscrowVault: "0x414319C341F9f63e92652ee5e2B1231E675F455e",
    SettlementReceipt: "0x2FDd4bb68F88449A9Ce48689a55D442b9B247C73",
    LiquidityProviderRegistry: "0x611054f7428B6C92AAacbDe41D62877FFEd12F84",
    // ... other addresses
  }
}
```

**See**: [`FRONTEND_SETUP.md`](../FRONTEND_SETUP.md) for detailed frontend setup

### Agent Configuration

**File**: `agent/config.yaml`

```yaml
flare:
  rpc_url: "https://coston2-api.flare.network/ext/C/rpc"
  flip_core_address: "0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15"
  escrow_vault_address: "0x414319C341F9f63e92652ee5e2B1231E675F455e"
  state_connector_address: "0x1000000000000000000000000000000000000005"

xrpl:
  network: "testnet"
  rpc_url: "https://s.altnet.rippletest.net:51234"
  wallet_seed: "sYOUR_XRPL_TESTNET_SEED_HERE"  # Get from XRPL testnet wallet

agent:
  check_interval: 5  # seconds
  fdc_delay: 120     # seconds to wait after XRP payment before fetching FDC proof
```

**Get XRPL Testnet Seed**:
1. Create wallet at https://xrpl.org/xrp-testnet-faucet.html
2. Copy the seed (starts with `s`)
3. Fund it with testnet XRP (from faucet)

---

## Agent Setup

### Build Agent

```bash
cd agent
go build -o flip-agent cmd/main.go
```

### Run Agent

**Foreground** (to see logs):
```bash
./flip-agent
```

**Background**:
```bash
nohup ./flip-agent > agent.log 2>&1 &
tail -f agent.log
```

**Expected Output**:
```
🚀 FLIP Agent starting...
✅ Connected to Flare Coston2: https://coston2-api.flare.network/ext/C/rpc
✅ Connected to XRPL Testnet: https://s.altnet.rippletest.net:51234
✅ XRPL wallet address: rYOUR_ADDRESS_HERE
✅ XRPL balance: 1000 XRP
👂 Listening for EscrowCreated events from 0x414319C341F9f63e92652ee5e2B1231E675F455e...
```

**See**: Agent service details in [`IMPLEMENTATION_CHECKPOINT.md`](IMPLEMENTATION_CHECKPOINT.md#agent-service)

---

## Frontend Setup

### Install Dependencies

```bash
cd frontend
npm install
```

### Run Development Server

```bash
npm run dev
```

**Expected Output**:
```
✅ Frontend running on http://localhost:3000
```

### Production Build

```bash
npm run build
npm start
```

**See**: [`FRONTEND_SETUP.md`](../FRONTEND_SETUP.md) for detailed frontend setup

---

## LP Setup

### Demo LP Setup Script

**File**: `scripts/demo/setupDemoLPs.ts`

```bash
cd scripts/demo

# Install dependencies
npm install

# Set your private key (required)
export PRIVATE_KEY=your_private_key_here

# Run the script
npx tsx setupDemoLPs.ts
```

**This will**:
- Create 3 demo LP wallets
- Each deposits 10,000 FLR
- Sets minHaircut to 0.05% (500)
- Sets maxDelay to 3600 seconds (1 hour)

**Expected Output**:
```
✅ LP 1 (0x...) deposited 10000 FLR
✅ LP 2 (0x...) deposited 10000 FLR
✅ LP 3 (0x...) deposited 10000 FLR
```

**See**: [`docs/LIQUIDITY_PROVIDER_GUIDE.md`](LIQUIDITY_PROVIDER_GUIDE.md) for LP details

---

## Verification

### Contract Verification

**Check Contract State**:
```bash
# Check redemption status
cast call 0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15 \
  "getRedemptionStatus(uint256)" 0 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check escrow status
cast call 0x414319C341F9f63e92652ee5e2B1231E675F455e \
  "getEscrowStatus(uint256)" 0 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

### Explorer Verification

- **Flare Explorer**: https://coston2-explorer.flare.network
- **XRPL Explorer**: https://testnet.xrpl.org

### Verification Checklist

- [ ] All contracts deployed to Coston2
- [ ] Contract addresses updated in frontend and agent
- [ ] Agent has XRPL testnet funds
- [ ] At least 3 LPs created with FLR deposits
- [ ] Agent service running and connected
- [ ] Frontend running and accessible

---

## Troubleshooting

### Agent Not Starting

```bash
# Check config file
cat agent/config.yaml

# Check RPC connection
curl -X POST https://coston2-api.flare.network/ext/C/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### LP Not Matching

```bash
# Check LP positions
cast call 0x611054f7428B6C92AAacbDe41D62877FFEd12F84 \
  "positions(address,address)" 0xLP_ADDRESS 0xFXRP_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

### XRP Payment Not Received

1. Check agent logs for payment status
2. Verify XRPL address is correct
3. Check XRPL testnet explorer
4. Verify agent has XRPL funds

### FDC Proof Not Found

1. Wait 2-5 minutes after XRP payment
2. Check FDC round ID in agent logs
3. Verify State Connector is accessible

---

## Related Documentation

- **Quick Start**: [`QUICK_START.md`](../QUICK_START.md)
- **Run Instructions**: [`RUN_INSTRUCTIONS.md`](../RUN_INSTRUCTIONS.md)
- **Frontend Setup**: [`FRONTEND_SETUP.md`](../FRONTEND_SETUP.md)
- **Testing Guide**: [`TESTING_GUIDE.md`](../TESTING_GUIDE.md)
- **Implementation Checkpoint**: [`docs/IMPLEMENTATION_CHECKPOINT.md`](IMPLEMENTATION_CHECKPOINT.md)
- **Deployed Addresses**: [`COSTON2_DEPLOYED_ADDRESSES.md`](../COSTON2_DEPLOYED_ADDRESSES.md)

---

**Last Updated**: January 2026  
**Status**: ✅ Ready for Coston2 Testnet Deployment

