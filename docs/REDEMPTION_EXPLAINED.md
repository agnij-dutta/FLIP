# What is Redemption? - Observable Changes Guide

## What is Redemption?

**Redemption** is the process of converting your FAsset tokens (like FXRP) back to the underlying native asset (like XRP) on the source chain. 

In FLIP v2, redemption works like this:

1. **You have FXRP** (over-collateralized token representing XRP on Flare)
2. **You want real XRP** on the XRP Ledger
3. **FLIP handles the bridge** - it locks your FXRP, creates an escrow, and coordinates the cross-chain transfer
4. **You get a Settlement Receipt** (NFT) that proves your redemption claim
5. **You can either:**
   - **Redeem immediately** (with a small haircut) if liquidity is available
   - **Wait for FDC confirmation** (get full amount, no haircut) after ~1-2 days

---

## Observable Changes You Can See

### 1. **Token Balance Changes** (Immediate)

**What happens:**
- Your FXRP balance **decreases** by the redemption amount
- FXRP tokens are **burned** (sent to dead address `0x000...dead`)

**How to observe:**
```bash
# Before redemption
cast call 0x0b6A3645c240605887a5532109323A3E12273dc7 "balanceOf(address)" \
  YOUR_ADDRESS --rpc-url https://coston2-api.flare.network/ext/C/rpc

# After redemption - balance should be lower
```

**In Frontend:**
- Your FXRP balance display will update immediately
- You'll see the tokens disappear from your wallet

---

### 2. **RedemptionRequested Event** (Immediate)

**What happens:**
- A `RedemptionRequested` event is emitted with:
  - `redemptionId` - Unique ID for this redemption
  - `user` - Your address
  - `asset` - FXRP address
  - `amount` - Amount redeemed
  - `timestamp` - When it happened

**How to observe:**
```bash
# Query events
cast logs --from-block 26190587 \
  "RedemptionRequested(uint256,address,address,uint256,uint256)" \
  --address 0x1151473d15F012d0Dd54f8e707dB6708BD25981F \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

**In Frontend:**
- The redemption ID appears after successful transaction
- You can see it in the UI

---

### 3. **Price Locked** (Immediate)

**What happens:**
- Current XRP/USD price is **locked** via FTSO
- A price hedge is created in `PriceHedgePool`
- This protects against price movements during the redemption period

**How to observe:**
```bash
# Check the redemption struct
cast call 0x1151473d15F012d0Dd54f8e707dB6708BD25981F \
  "redemptions(uint256)" REDEMPTION_ID \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Returns: (user, asset, amount, requestedAt, priceLocked, hedgeId, status, fdcRequestId, provisionalSettled)
# priceLocked will show the locked price (scaled to 18 decimals)
```

**In Frontend:**
- Could display the locked price
- Shows price protection is active

---

### 4. **Settlement Receipt NFT Minted** (After Oracle Processing)

**What happens:**
- An oracle node processes your redemption
- If approved, an **Escrow** is created
- A **Settlement Receipt NFT** is minted to your address
- This NFT represents your claim to the redeemed amount

**How to observe:**
```bash
# Check your NFT balance
cast call 0x17A223eB9D0d74265da99Ccbb994B6Ea75E4Ecb7 \
  "balanceOf(address)" YOUR_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Get receipt metadata
cast call 0x17A223eB9D0d74265da99Ccbb994B6Ea75E4Ecb7 \
  "getReceiptMetadata(uint256)" RECEIPT_ID \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

**In Frontend:**
- Your receipt count increases
- You can see receipt details (amount, haircut, status)

---

### 5. **Redemption Status Changes** (Over Time)

**Status Flow:**
```
Pending → EscrowCreated → ReceiptRedeemed → Finalized
   ↓
QueuedForFDC (if low confidence)
   ↓
Failed (if FDC confirms failure)
```

**How to observe:**
```bash
# Check status (status is at index 6 in the redemption struct)
cast call 0x1151473d15F012d0Dd54f8e707dB6708BD25981F \
  "redemptions(uint256)" REDEMPTION_ID \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Status values:
# 0 = Pending
# 1 = QueuedForFDC
# 2 = EscrowCreated
# 3 = ReceiptRedeemed
# 4 = Finalized
# 5 = Failed
```

**In Frontend:**
- Status badge updates as redemption progresses
- Shows current stage of redemption

---

### 6. **EscrowCreated Event** (After Oracle Processing)

**What happens:**
- Escrow is created in `EscrowVault`
- Funds are conditionally locked
- `EscrowCreated` event is emitted

**How to observe:**
```bash
cast logs --from-block LATEST \
  "EscrowCreated(uint256,address,uint256,uint256,uint256)" \
  --address 0x1151473d15F012d0Dd54f8e707dB6708BD25981F \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

---

### 7. **Receipt Redeemed** (When You Redeem)

**What happens:**
- You call `redeemNow()` on the Settlement Receipt
- If LP-funded: You get funds immediately (with haircut)
- If waiting for FDC: You get full amount after FDC confirms

**How to observe:**
```bash
# Check if receipt is redeemed
cast call 0x17A223eB9D0d74265da99Ccbb994B6Ea75E4Ecb7 \
  "getReceiptMetadata(uint256)" RECEIPT_ID \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# redeemed field will be true after redemption
```

---

### 8. **FDC Attestation** (After ~1-2 Days)

**What happens:**
- Flare Data Connector (FDC) confirms the cross-chain transaction
- `FDCAttestationReceived` event is emitted
- Redemption is finalized (success or failure)

**How to observe:**
```bash
cast logs --from-block LATEST \
  "FDCAttestationReceived(uint256,uint256,bytes32,uint256)" \
  --address 0x1151473d15F012d0Dd54f8e707dB6708BD25981F \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

---

## Summary: What You Can Actually See

### Immediate (Right After Transaction):
1. ✅ **FXRP balance decreases** - Tokens are burned
2. ✅ **Redemption ID appears** - Unique identifier
3. ✅ **Price is locked** - FTSO price at redemption time
4. ✅ **Transaction hash** - Proof of redemption request

### Within Minutes (After Oracle Processing):
5. ✅ **Settlement Receipt NFT** - Appears in your wallet
6. ✅ **Redemption status** - Changes from Pending to EscrowCreated
7. ✅ **Receipt metadata** - Shows amount, haircut, LP info

### When You Redeem:
8. ✅ **Receipt status** - Changes to "redeemed"
9. ✅ **Funds received** - Either immediate (with haircut) or after FDC

### After ~1-2 Days:
10. ✅ **FDC confirmation** - Final settlement
11. ✅ **Redemption finalized** - Status = Finalized or Failed

---

## How to Monitor Your Redemption

### Option 1: Frontend UI
- Check redemption status page
- View your settlement receipts
- See status updates in real-time

### Option 2: Block Explorer
- Go to: https://coston2-explorer.flare.network
- Search your transaction hash
- View events and logs

### Option 3: Command Line
```bash
# Get your redemption ID from the transaction
REDEMPTION_ID=0  # Replace with your actual ID

# Check status
cast call 0x1151473d15F012d0Dd54f8e707dB6708BD25981F \
  "redemptions(uint256)" $REDEMPTION_ID \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc

# Check receipt count
cast call 0x17A223eB9D0d74265da99Ccbb994B6Ea75E4Ecb7 \
  "balanceOf(address)" YOUR_ADDRESS \
  --rpc-url https://coston2-api.flare.network/ext/C/rpc
```

---

## Key Takeaways

1. **Redemption = Converting FXRP → XRP** (cross-chain bridge)
2. **Immediate changes**: Balance decreases, tokens burned, price locked
3. **Short-term changes**: Receipt NFT minted, escrow created
4. **Long-term changes**: FDC confirmation, final settlement
5. **You can observe**: Balance, events, receipts, status - all on-chain!

