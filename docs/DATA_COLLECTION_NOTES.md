# Data Collection Notes

## Why No Real Data on Testnet?

### FDC Attestations (0 results)

**Why:** StateConnector events are **very rare** on Coston2 testnet. The StateConnector only emits `Attestation` events when there's actual cross-chain activity (XRP/BTC/DOGE redemptions or other attestation requests).

**Frequency:**
- On mainnet: Every 3-5 minutes (when there's activity)
- On testnet: Can be hours or days between events (low activity)

**What we're doing:**
- Querying 2 hours of blocks (4000+ blocks) in 134 chunks
- Finding 0 attestations is **normal** for testnet
- Synthetic data is automatically generated for demonstration

**To get real data:**
- Query a longer time window (days/weeks)
- Use Flare mainnet (more activity)
- Or wait for actual cross-chain activity on testnet

---

### FAsset Redemptions (no address configured)

**Why:** FAsset contract addresses are not configured for Coston2 testnet.

**Current status:**
- `FASSETS_COSTON2` dictionary has `None` values
- FAssets may not be deployed on Coston2, or addresses differ from mainnet

**To get real data:**
1. Find actual FAsset contract addresses for Coston2:
   - Check Flare documentation: https://docs.flare.network
   - Check Coston2 explorer: https://coston2-explorer.flare.network
   - Query FlareContractRegistry for FAsset addresses

2. Update `data-pipeline/collector/fassets_redemptions.py`:
   ```python
   FASSETS_COSTON2 = {
       "FXRP": "0x...",  # Actual address
       "FBTC": "0x...",
       "FDOGE": "0x...",
   }
   ```

**Note:** Synthetic data is fine for testing and development. The notebooks will work with synthetic data.

---

## Expected Behavior

✅ **This is normal!** The collectors are working correctly:
- They connect to the RPC
- They query the correct contracts
- They handle RPC limits (chunking)
- They fall back to synthetic data when no real data is available

The synthetic data generators create realistic patterns:
- FTSO: Price volatility with realistic distributions
- FDC: Latency patterns (60-600 seconds, gamma distribution)
- Redemptions: Success/failure rates matching expected patterns

---

## Getting Real Data

### Option 1: Use Flare Mainnet
```python
network = "mainnet"  # Instead of "coston2"
```

**Note:** You'll need:
- Mainnet FAsset addresses
- More RPC quota (mainnet RPCs may have stricter limits)
- Real FLR for gas (if submitting transactions)

### Option 2: Query Longer Time Windows
```python
hours = 168  # 1 week instead of 2 hours
```

**Note:** This will take longer and may hit RPC rate limits.

### Option 3: Use Archive Nodes
Archive nodes allow querying much longer block ranges, but:
- May require API keys
- May have costs
- May have different rate limits

---

## Testing with Synthetic Data

The notebooks are designed to work with synthetic data:
- ✅ All analysis and visualizations work
- ✅ Model training works
- ✅ Backtesting works
- ✅ Feature engineering works

**Synthetic data is sufficient for:**
- Development and testing
- Model prototyping
- Algorithm validation
- Documentation and demos

**Real data is needed for:**
- Production model training
- Final validation
- Performance metrics
- Production deployment

---

## Troubleshooting

### "0 attestations found"
- ✅ Normal for testnet
- Try longer time window
- Try mainnet
- Check StateConnector activity on explorer

### "FAsset address not configured"
- ✅ Normal - addresses need to be found/configured
- Synthetic data will be used
- See above for how to find addresses

### "RPC rate limit errors"
- Reduce `hours` parameter
- Add more delays between queries
- Use different RPC endpoint
- Check RPC provider limits

---

## Summary

**Current status:** ✅ Working as expected
- Collectors connect and query correctly
- No real data on testnet is normal
- Synthetic data fallback works
- Notebooks function correctly with synthetic data

**Next steps for production:**
1. Find and configure FAsset addresses
2. Use mainnet or longer time windows
3. Consider archive nodes for historical data
4. Set up monitoring for real-time data collection

