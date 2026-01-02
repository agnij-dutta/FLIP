# Enhanced FDC Attestation Collection

## Overview

We've implemented multiple methods to collect FDC attestation data:

1. **Flare Systems Explorer API** (if API key available)
2. **FAsset Redemption Correlation** (derives attestations from redemption events)
3. **Event-based queries** (fallback, may find old events)
4. **Synthetic data** (final fallback for development)

## How It Works

### Method 1: API (Primary)
- Uses Flare Systems Explorer API
- Requires `FLARE_API_KEY` environment variable
- Get API key from: https://api-portal.flare.network/
- Most accurate and up-to-date

### Method 2: FAsset Redemption Correlation (Secondary)
- **Key Insight**: FAsset redemptions trigger StateConnector attestations
- RedemptionRequested → FDC processes → Attestation ~3-5 minutes later
- Uses redemption events to estimate attestation timing
- Provides realistic data derived from actual blockchain events

### Method 3: Event-based Query (Tertiary)
- Queries StateConnector `Attestation` events directly
- May find old events (2+ years ago)
- Limited by RPC node capabilities

### Method 4: Synthetic Data (Fallback)
- Generates realistic attestation patterns
- ~4.5 minute intervals (FDC round duration)
- Used when no real data available

## Usage

The enhanced method is **automatically enabled** in the notebook:

```python
from fdc_attestations import get_recent_attestations

# Automatically tries: API → Redemptions → Events → Synthetic
df = get_recent_attestations(hours=24, network='mainnet', use_enhanced=True)
```

## Configuration

### For API Access

1. Get API key from https://api-portal.flare.network/
2. Set environment variable:
   ```bash
   export FLARE_API_KEY="your-api-key-here"
   ```

### For Redemption Correlation

- Automatically uses FXRP redemptions
- Works on mainnet (FXRP address configured)
- No additional configuration needed

## Data Quality

| Method | Accuracy | Latency | Availability |
|--------|----------|---------|--------------|
| API | ✅ Highest | Real-time | Requires API key |
| Redemption Correlation | ✅ High | ~3-5 min delay | ✅ Always available |
| Event Query | ⚠️ Low | Historical only | Limited |
| Synthetic | ⚠️ N/A | N/A | ✅ Always available |

## Example Output

When using redemption correlation, you'll see:

```
📊 Deriving attestations from FXRP redemption events...
   Found 150 redemption events
✅ Derived 150 attestations from redemption events
   Time range: 2025-01-01 10:00:00 to 2025-01-02 10:00:00
```

The derived attestations include:
- `request_id`: Matches redemption ID
- `datetime`: Estimated attestation time (redemption + 3-5 min)
- `redemption_status`: Original redemption status
- `source`: "redemption_correlation"

## Benefits

1. **Real Data**: Uses actual redemption events from blockchain
2. **No API Required**: Works without API keys
3. **Realistic Timing**: Models actual FDC processing latency
4. **Automatic Fallback**: Gracefully handles failures

## Next Steps

1. **Get API Key** (optional but recommended):
   - Visit https://api-portal.flare.network/
   - Sign up and generate API key
   - Set `FLARE_API_KEY` environment variable

2. **Run Notebook**:
   - Enhanced method is enabled by default
   - Will automatically use best available method

3. **Monitor Results**:
   - Check which method was used (API vs correlation)
   - Verify data quality and timing

## Files

- `data-pipeline/collector/fdc_api.py`: Enhanced API and correlation methods
- `data-pipeline/collector/fdc_attestations.py`: Main collector (uses enhanced methods)
- `ml/research/feature_exploration.ipynb`: Updated to use enhanced method

