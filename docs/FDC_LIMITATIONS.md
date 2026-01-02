# FDC Attestation Collection Limitations

## Issue

The StateConnector contract does not expose round information via standard RPC calls. The `getStateConnectorRound()` function returns "execution reverted: no data", indicating that rounds are managed differently than expected.

## Current Status

- ❌ **Round-based queries**: Not available via standard RPC
- ⚠️ **Event-based queries**: Works but may not find recent events (events may be old)
- ✅ **Synthetic data**: Used as fallback for development/testing

## Why This Happens

1. **StateConnector Architecture**: Rounds may be managed off-chain or through a different mechanism
2. **RPC Limitations**: Standard RPC nodes may not have access to round data
3. **Archive Nodes**: May be required for historical round queries

## Solutions for Production

### Option 1: Flare Systems Explorer API
- Use the official Flare Systems Explorer API
- URL: `https://flare-systems-explorer.flare.network`
- Provides programmatic access to attestation data

### Option 2: Archive Nodes
- Use archive RPC nodes that maintain full historical data
- May require API keys or paid access
- Can query historical events more effectively

### Option 3: Direct Integration
- Integrate with FAssets contracts directly
- Monitor redemption events which trigger attestations
- Use redemption timestamps to estimate attestation timing

## Current Workaround

The collector:
1. Attempts round-based query (fails gracefully)
2. Falls back to event-based query (may find old events)
3. Uses synthetic data if no events found (for development)

Synthetic data simulates:
- ~4.5 minute intervals (FDC round duration)
- Realistic latency distributions (60-600 seconds)
- Proper timestamp sequencing

## For Real Data

To get real FDC attestation data:
1. Use Flare Systems Explorer API
2. Set up archive node access
3. Monitor FAssets redemption events (which correlate with attestations)

## Impact on ML Training

- **Development/Testing**: Synthetic data is sufficient
- **Production Training**: Need real data from API or archive nodes
- **Model Validation**: Can use redemption events as proxy for attestation timing

