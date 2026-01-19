# FLIP v2 - Ready to Test! 🚀

## ✅ Configuration Complete

### LP Setup (Fixed)
- **Amounts**: Reduced to 50 FLR each (fits your 198 FLR balance)
- **Total needed**: ~150 FLR + gas (~48 FLR reserve)
- **Your balance**: 198 FLR ✅

### Agent XRPL (Configured)
- **Address**: `rECtK3zdPiyBX9MjJp6NiggoWb7aJ39uxy`
- **Balance**: 100 XRP (testnet) ✅
- **Seed**: Configured in `agent/config.yaml` ✅

---

## 🚀 Quick Test Steps

### 1. Set Up Demo LPs

```bash
cd scripts/demo
export PRIVATE_KEY=your_private_key_here
npx tsx setupDemoLPs.ts
```

**Expected**: 3 LPs with 50 FLR each (total ~150 FLR + gas)

### 2. Start Frontend

```bash
cd ../../frontend
npm run dev
```

Open: http://localhost:3000

### 3. Test Redemption Flow

1. **Connect Wallet** (MetaMask/Flare Wallet)
2. **Ensure FXRP Balance** (if you don't have FXRP, you'll need to mint first)
3. **Go to Redeem Page**
4. **Enter Amount** (e.g., 10 FXRP - small to test)
5. **Enter XRPL Address** (your XRPL testnet address)
6. **Request Redemption**
7. **Approve FLIPCore** to spend FXRP

**Expected Results**:
- ✅ **If LP matched**: Immediate payout (with 0.05% haircut)
- ⏳ **If no LP match**: User-wait path (requires agent)

### 4. Test Agent (Optional - Requires Go)

If you want to test the full flow with agent:

```bash
# Install Go (if not installed)
sudo apt install golang-go

# Build agent
cd agent
go mod download
go build -o flip-agent cmd/main.go

# Run agent
./flip-agent
```

The agent will:
- Monitor `EscrowCreated` events
- Send XRP payments automatically
- Fetch FDC proofs
- Submit FDC attestations

---

## 📊 Current Setup

### Contracts ✅
- All deployed on Coston2
- All configured correctly
- All verified via RPC

### LPs ⚠️
- **Ready to set up** (run script above)
- **Amounts**: 50 FLR each (3 LPs = 150 FLR)
- **Total capacity**: 150 FLR for redemptions

### Agent ✅
- **XRPL wallet**: Configured
- **Balance**: 100 XRP (testnet)
- **Status**: Ready (requires Go to run)

### Frontend ✅
- **Dependencies**: Installed
- **Addresses**: Configured
- **Status**: Ready to test

---

## 🧪 Test Scenarios

### Scenario 1: LP Matched (Immediate Redemption)
1. Set up LPs (50 FLR each)
2. Request redemption for ≤50 FXRP
3. ✅ Should get immediate payout (with haircut)

### Scenario 2: No LP Match (User-Wait)
1. Request redemption for >50 FXRP (or if LPs exhausted)
2. ⏳ Wait for agent to pay XRP
3. Agent submits FDC proof
4. ✅ Get full amount (no haircut)

### Scenario 3: Full E2E (With Agent)
1. Set up LPs
2. Start agent service
3. Request redemption
4. Agent pays XRP automatically
5. FDC confirms
6. ✅ Redemption finalized

---

## 📝 Notes

- **LP Amounts**: Reduced to 50 FLR each for your balance
- **Gas Reserve**: Keep ~48 FLR for gas fees
- **XRPL**: Agent has 100 XRP ready for payments
- **Testing**: Start with small amounts (10-20 FXRP)

---

## ✅ Verification Checklist

- [x] Contracts deployed
- [x] Agent XRPL configured
- [x] LP script fixed (smaller amounts)
- [ ] LPs set up (run script)
- [ ] Frontend tested
- [ ] Agent running (if testing full flow)

**Status**: Ready to test! 🎉

