# FLIP v2 Quick Start Guide

## ✅ Fixed Issues

- ✅ **TypeScript Execution**: Fixed `ts-node` ESM issue - now uses `tsx`
- ✅ **Frontend Build**: Fixed coston2 chain import issue
- ✅ **All Contracts**: Verified and deployed on Coston2

## 🚀 Quick Test (5 minutes)

### 1. Set Up Demo LPs

```bash
cd scripts/demo

# Set your private key (must have FLR for gas + deposits)
export PRIVATE_KEY=your_private_key_here

# Run setup
npx tsx setupDemoLPs.ts
```

**Expected Output**:
```
Setting up demo LPs from wallet: 0x...
Balance: 50000 FLR

Setting up LP1...
  Amount: 10000 FLR
  Min Haircut: 0.05%
  Max Delay: 3600 seconds
  Transaction: 0x...
  ✅ Confirmed in block 12345

✅ All demo LPs set up successfully
```

### 2. Start Frontend

```bash
cd ../../frontend
npm run dev
```

Open: http://localhost:3000

### 3. Test Redemption (LP Path)

1. Connect wallet (MetaMask/Flare Wallet)
2. Ensure wallet has FXRP balance
3. Go to **Redeem** page
4. Enter amount (e.g., 100 FXRP)
5. Enter XRPL address
6. Click **Request Redemption**
7. Approve FLIPCore to spend FXRP
8. ✅ **If LP matched**: You'll get immediate payout (with 0.05% haircut)

## 📋 Prerequisites Check

Run the verification script:

```bash
./verify_setup.sh
```

## 🔧 Common Issues

### TypeScript Execution Error
**Fixed!** Now uses `tsx` instead of `ts-node`

### Frontend Build Warnings
**Non-blocking** - Dev mode works fine

### Agent Service
**Requires Go** - Install with: `sudo apt install golang-go`

## 📊 Current Status

- ✅ Contracts: Deployed and verified
- ✅ Frontend: Ready for testing
- ✅ LP Script: Fixed and ready
- ⚠️ Agent: Requires Go installation

## 🎯 Next Steps

1. **Set up LPs** (see above)
2. **Test frontend** (see above)
3. **Install Go** (for full E2E with agent):
   ```bash
   sudo apt install golang-go
   cd agent
   go mod download
   go build -o flip-agent cmd/main.go
   ```
4. **Configure agent** (update `agent/config.yaml` with XRPL seed)
5. **Run agent**:
   ```bash
   ./flip-agent
   ```

---

**Ready to test!** 🚀

