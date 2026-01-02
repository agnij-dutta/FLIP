# ✅ Mainnet Configuration Complete!

## What Changed

### 1. FAsset Addresses
- **FXRP Mainnet**: `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE`
- **FXRP Coston2**: `0x0b6A3645c240605887a5532109323A3E12273dc7`

### 2. Notebook Configuration
- **Default network**: Changed from `coston2` to `mainnet`
- **Time windows**: All set to 24 hours for better data collection
- **Network indicators**: Added 🌐 emoji to show which network is being used

### 3. Collectors Updated
- `fassets_redemptions.py`: Now has mainnet FXRP address hardcoded
- Dynamic lookup: Will query Contract Registry for other assets if needed
- FTSO: Already queries Contract Registry dynamically for mainnet

---

## How to Use

### Run the Notebook
1. **Restart your Jupyter kernel** (important!)
2. **Run all cells** - it will now use mainnet by default
3. **Wait ~11-12 minutes** for data collection (24 hours of blocks)

### Expected Results

**Mainnet has MUCH more activity than testnet:**
- ✅ **FTSO prices**: Real current prices (already working)
- ✅ **FDC attestations**: Should find events (every 3-5 minutes on mainnet)
- ✅ **FAsset redemptions**: Should find real redemption events

**If you still see synthetic data:**
- Check the network indicator (🌐) - should say "mainnet"
- Try increasing time window to 48 hours if needed
- Verify RPC connection is working

---

## Network Comparison

| Feature | Coston2 (Testnet) | Mainnet |
|---------|------------------|---------|
| FDC Events | Very rare (hours/days) | Every 3-5 minutes |
| Redemptions | Very rare | Regular activity |
| FTSO Prices | ✅ Works | ✅ Works |
| Data Quality | Synthetic fallback | Real data |

---

## Quick Test

To verify mainnet is working, run this in a Python cell:

```python
import sys
sys.path.insert(0, '../data-pipeline/collector')
from fassets_redemptions import get_fasset_address

addr = get_fasset_address('FXRP', 'mainnet')
print(f"FXRP mainnet: {addr}")
# Should print: 0xAd552A648C74D49E10027AB8a618A3ad4901c5bE
```

---

## Switch Back to Testnet

If you want to use testnet instead, change this in the notebook:

```python
network = os.getenv('FLARE_NETWORK', 'coston2')  # Change 'mainnet' to 'coston2'
```

---

## Next Steps

1. ✅ **Restart kernel**
2. ✅ **Run notebook** - will use mainnet automatically
3. ✅ **Wait for data collection** (~11-12 minutes)
4. ✅ **Enjoy real data!** 🎉

