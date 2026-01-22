# FLIP v2 - Complete Run Instructions

## 🎯 Quick Start Guide

This guide walks you through running the complete FLIP v2 flow on Coston2 testnet.

---

## Prerequisites

### **1. Install Dependencies**

```bash
# Node.js (v18+)
node --version  # Should be v18+

# Foundry (Forge)
forge --version  # Should be latest

# Go (v1.21+)
go version  # Should be v1.21+

# Install Foundry if needed
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### **2. Get Testnet Funds**

**Coston2 FLR** (for gas):
- Faucet: https://coston2-faucet.towolabs.com/
- Or: https://faucet.flare.network/

**Coston2 XRP** (for payments):
- Use XRPL Testnet faucet
- Or transfer from mainnet testnet account

**XRPL Testnet XRP** (for agent):
- Faucet: https://xrpl.org/xrp-testnet-faucet.html

---

## Step-by-Step Setup

### **Step 1: Clone and Setup**

```bash
cd /home/agnij/Desktop/FLIP

# Install Node dependencies
npm install

# Install Foundry dependencies
forge install

# Install Go dependencies (for agent)
cd agent
go mod download
cd ..
```

### **Step 2: Deploy Contracts**

```bash
# Set your Coston2 private key
export PRIVATE_KEY=your_private_key_here

# Deploy all contracts
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc \
  --broadcast \
  --verify \
  --etherscan-api-key YOUR_ETHERSCAN_API_KEY

# Save the deployed addresses from output
```

**Expected Output**:
```
✅ DEPLOYMENT SUMMARY:
Contracts Deployed:
  FLIPCore: 0x192E107c9E1adAbf7d01624AFa158d10203F8DAB
  EscrowVault: 0x62ACcaF2A09Ae5d6d8E4A92104d1Cd16430146B4
  SettlementReceipt: 0xE87c033A9c4371B6192Ab213380fb30955b3Bf39
  LP Registry: 0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B
  ...
```

### **Step 3: Update Configuration Files**

#### **3.1 Update Frontend Contracts**

Edit `frontend/lib/contracts.ts`:

```typescript
export const CONTRACTS = {
  coston2: {
    FLIPCore: "0x192E107c9E1adAbf7d01624AFa158d10203F8DAB", // From deployment
    EscrowVault: "0x62ACcaF2A09Ae5d6d8E4A92104d1Cd16430146B4",
    SettlementReceipt: "0xE87c033A9c4371B6192Ab213380fb30955b3Bf39",
    LiquidityProviderRegistry: "0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B",
    // ... other addresses
  }
}
```

#### **3.2 Update Agent Config**

Edit `agent/config.yaml`:

```yaml
flare:
  rpc_url: "https://coston2-api.flare.network/ext/C/rpc"
  flip_core_address: "0x192E107c9E1adAbf7d01624AFa158d10203F8DAB"
  escrow_vault_address: "0x62ACcaF2A09Ae5d6d8E4A92104d1Cd16430146B4"
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

### **Step 4: Set Up Demo LPs**

```bash
cd scripts/demo

# Install dependencies
npm install

# Set your private key (required)
export PRIVATE_KEY=your_private_key_here

# Run the script (uses tsx for ESM support)
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

### **Step 5: Start Agent Service**

```bash
cd agent

# Build agent
go build -o flip-agent cmd/main.go

# Run agent (foreground - to see logs)
./flip-agent

# Or run in background
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
👂 Listening for EscrowCreated events from 0x62ACcaF2A09Ae5d6d8E4A92104d1Cd16430146B4...
```

### **Step 6: Start Frontend**

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Expected Output**:
```
✅ Frontend running on http://localhost:3000
```

---

## 🧪 Running the Full Flow

### **Test 1: Mint FXRP (XRP → FXRP)**

1. **Open Frontend**: http://localhost:3000
2. **Connect Wallet**: Click "Connect Wallet" → Select MetaMask/Flare Wallet
3. **Go to Mint Page**: Click "Mint" in navigation
4. **Enter XRPL Address**: Your XRPL testnet address (where you'll send XRP)
5. **Click "Start Minting"**: This will:
   - Generate a payment address
   - Show instructions
6. **Send XRP**: 
   - Open Xaman/XUMM wallet
   - Send XRP to the displayed address
   - Amount: e.g., 100 XRP
7. **Wait for Minting** (~2-5 minutes):
   - Flare FAsset agent processes payment
   - FDC verifies payment
   - FXRP is minted to your wallet
8. **Verify**: Check your Flare wallet balance → Should see FXRP

### **Test 2: Redeem FXRP (FXRP → XRP via FLIP)**

#### **Option A: Immediate Redemption (LP Matched)**

1. **Go to Redeem Page**: Click "Redeem" in navigation
2. **Enter Amount**: e.g., 100 FXRP
3. **Enter XRPL Address**: Where you want to receive XRP
4. **Click "Request Redemption"**:
   - Approve FLIPCore to spend FXRP
   - Transaction submitted
5. **Wait for Oracle** (~30 seconds):
   - Oracle evaluates redemption
   - LP matching occurs
   - Escrow created
6. **Immediate Payout** (if LP matched):
   - SettlementReceipt minted
   - Click "Redeem Now" (or auto-redeemed)
   - **You receive XRP immediately** (with 0.05% haircut)
   - Check XRPL wallet → Should see ~99.95 XRP

#### **Option B: User-Wait Path (No LP Match)**

1. **Same steps 1-5 as above**
2. **If no LP matches**:
   - Status shows "Waiting for FDC"
   - Agent monitors escrow
3. **Agent Pays XRP** (~2-5 minutes):
   - Agent detects EscrowCreated event
   - Sends XRP payment to your address
   - Fetches FDC proof
   - Submits FDC attestation
4. **FDC Confirms**:
   - Escrow released
   - **You receive full amount** (no haircut)
   - Check XRPL wallet → Should see 100 XRP

### **Test 3: Verify Everything**

#### **Check Agent Logs**:

```bash
tail -f agent/agent.log
```

**Expected Events**:
```
📦 EscrowCreated: redemptionId=0, user=0x..., amount=100000000000000000000
💸 Sending XRP payment: 100 XRP to rTEST_ADDRESS
✅ XRP payment sent: txHash=ABC123...
⏳ Waiting 120 seconds for FDC proof...
🔍 Fetching FDC proof for round: 12345
✅ FDC proof fetched: merkleRoot=0x...
📤 Submitting FDC attestation to FLIPCore...
✅ FDC attestation submitted: redemptionId=0, success=true
```

#### **Check XRPL Explorer**:

1. Go to: https://testnet.xrpl.org
2. Search your XRPL address
3. ✅ Verify XRP payment received

#### **Check Flare Explorer**:

1. Go to: https://coston2-explorer.flare.network
2. Search FLIPCore address: `0x192E107c9E1adAbf7d01624AFa158d10203F8DAB`
3. ✅ Verify redemption transactions

#### **Check Contract State**:

```bash
# Check redemption status
cast call 0x192E107c9E1adAbf7d01624AFa158d10203F8DAB \
  "getRedemptionStatus(uint256)" 0 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check escrow status
cast call 0x62ACcaF2A09Ae5d6d8E4A92104d1Cd16430146B4 \
  "getEscrowStatus(uint256)" 0 \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

---

## 🔍 Verification Checklist

### **Before Running**:
- [ ] Contracts deployed to Coston2
- [ ] Contract addresses updated in frontend and agent
- [ ] Agent has XRPL testnet funds
- [ ] At least 3 LPs created with FLR deposits
- [ ] Agent service running and connected
- [ ] Frontend running and accessible

### **After Minting**:
- [ ] FXRP balance increased in wallet
- [ ] Minting transaction visible on Flare explorer

### **After Redemption**:
- [ ] Redemption request created
- [ ] Escrow created (check EscrowVault)
- [ ] SettlementReceipt minted
- [ ] XRP received in XRPL wallet
- [ ] FDC proof submitted (check agent logs)
- [ ] Redemption status = Finalized

---

## 🐛 Troubleshooting

### **Agent Not Starting**

```bash
# Check config file
cat agent/config.yaml

# Check RPC connection
curl -X POST https://coston2-api.flare.network/ext/C/rpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### **LP Not Matching**

```bash
# Check LP positions
cast call 0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B \
  "positions(address,address)" 0xLP_ADDRESS 0xFXRP_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check LP balance
cast call 0x3168f77a6A8a2f3c8A7D5e89d0AB7cbA0B72335B \
  "lpBalances(address,address)" 0xLP_ADDRESS 0xFXRP_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

### **XRP Payment Not Received**

1. Check agent logs for payment status
2. Verify XRPL address is correct
3. Check XRPL testnet explorer
4. Verify agent has XRPL funds

### **FDC Proof Not Found**

1. Wait 2-5 minutes after XRP payment
2. Check FDC round ID in agent logs
3. Verify State Connector is accessible
4. Check FDC round on Flare explorer

---

## 📊 Expected Results

### **Successful Flow**:

1. ✅ **Mint**: 100 XRP → 100 FXRP
2. ✅ **Redeem**: 100 FXRP → 99.95 XRP (immediate, with 0.05% haircut)
   - OR: 100 FXRP → 100 XRP (user-wait, no haircut)
3. ✅ **FDC Confirms**: Redemption finalized
4. ✅ **LP Earns**: 0.05 FLR (haircut fee)

### **Test Results**:

- ✅ All 68 tests passing
- ✅ Contracts deployed
- ✅ Agent operational
- ✅ Frontend functional
- ✅ End-to-end flow verified

---

## 🎉 Success!

If you see:
- ✅ XRP received in XRPL wallet
- ✅ Redemption status = Finalized
- ✅ Agent logs show successful FDC submission
- ✅ LP earned fees

**Then the full flow is working!** 🚀

---

## 📝 Notes

- **Testnet Only**: All addresses and networks are for Coston2 testnet
- **Real Funds**: Use testnet funds only (not mainnet)
- **Agent Monitoring**: Agent must be running for user-wait path
- **LP Matching**: Requires active LPs with sufficient funds
- **FDC Delay**: FDC proofs available ~2-5 minutes after XRP payment

