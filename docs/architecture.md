# FLIP Architecture (v2 - Escrow-Based)

## Overview

FLIP v2 transforms from a capital-intensive prefunded insurance model to a capital-efficient conditional settlement acceleration layer. The architecture eliminates idle capital requirements while maintaining user protection through escrow-based conditional settlement and FDC adjudication.

## Layers

### On-Chain Contracts
- **FLIPCore** - Main redemption handler with escrow-based provisional settlement
- **EscrowVault** - Conditional escrow vault (replaces InsurancePool)
- **SettlementReceipt** - ERC-721 NFT for conditional claims
- **LiquidityProviderRegistry** - Market-based opt-in liquidity provider system
- **PriceHedgePool** - FTSO price locking and hedging
- **OperatorRegistry** - Operator management and slashing
- **OracleRelay** - Advisory-only oracle predictions (no capital triggers)
- **DeterministicScoring** - Mathematical scoring library (replaces ML)

### Oracle Layer
- Go nodes with deterministic scoring + signed predictions
- Advisory-only predictions (routing decisions, suggested haircuts)
- No ML inference required

### Data Layer
- Ingestion (FTSO/FDC/FAssets)
- Time-series storage for historical analysis

## Flows

### Fast Lane Flow (High Confidence)

```
1) User redemption → FLIPCore.requestRedemption()
   ↓
2) FTSO price snapshot → PriceHedgePool locks price
   ↓
3) Deterministic scoring → calculateScore()
   ↓
4) Score >= 99.7% → FastLane decision
   ↓
5) LP matching → lpRegistry.matchLiquidity()
   ↓
6a) If LP matched:
    → EscrowVault.createEscrow() with LP funds
    → SettlementReceipt.mintReceipt() with LP haircut
    → User can redeemNow() immediately (with haircut)
    → LP earns haircut fee
    
6b) If no LP:
    → EscrowVault.createEscrow() with user funds (wait path)
    → SettlementReceipt.mintReceipt() with suggested haircut
    → User waits for FDC
    
7) FDC attestation → handleFDCAttestation()
   ↓
8) Escrow release → EscrowVault.releaseOnFDC()
   ↓
9) Finalization → Status: Finalized
```

### Queue FDC Flow (Low Confidence)

```
1) User redemption → FLIPCore.requestRedemption()
   ↓
2) Deterministic scoring → Score < 99.7%
   ↓
3) Queue for FDC → queueForFDC()
   ↓
4) Wait for FDC attestation
   ↓
5) FDC attestation → handleFDCAttestation()
   ↓
6) Finalization → Status: Finalized
```

## Key Architectural Changes (v1 → v2)

### Capital Model
- **v1**: Prefunded InsurancePool (capital-intensive)
- **v2**: Escrow per redemption (capital-efficient, 10-20× improvement)

### User Experience
- **v1**: Direct insurance payout
- **v2**: Receipt NFT with redemption options (immediate with haircut or wait for FDC)

### Liquidity
- **v1**: Single insurance pool
- **v2**: Market-based LPs with opt-in parameters

### Oracle Role
- **v1**: Capital-triggering predictions
- **v2**: Advisory-only (routing decisions, suggested haircuts)

### FDC Role
- **v1**: Verifier
- **v2**: Adjudicator (final arbiter for escrow release)

## Safety Mechanisms

1. **FDC Adjudication**: FDC is the final arbiter - its decision is binding
2. **Escrow Protection**: Funds held in escrow until FDC adjudication
3. **Timeout Protection**: 600-second timeout prevents indefinite lock
4. **LP Risk Management**: LPs set minimum haircuts and maximum delays
5. **Slashing**: Operators slashed for routing errors and haircut mispricing
6. **Firelight Integration**: Catastrophic backstop for edge cases

## Capital Efficiency

### v1 (InsurancePool)
- Prefunded pool: 3× monthly liability
- Idle capital: High
- Capital intensity: High

### v2 (EscrowVault)
- Per-redemption escrow: Only active redemptions
- LP capital: Market-based, opt-in
- Capital intensity: Low (10-20× improvement)

## Component Interactions

```
FLIPCore
  ├── EscrowVault (escrow management)
  ├── SettlementReceipt (NFT minting)
  ├── LiquidityProviderRegistry (LP matching)
  ├── PriceHedgePool (price locking)
  ├── OperatorRegistry (operator management)
  ├── OracleRelay (advisory predictions)
  └── DeterministicScoring (routing decisions)
```

## Migration Notes

**Critical**: v1 InsurancePool cannot be migrated to v2 EscrowVault.

**Migration Path**:
1. Deploy v2 contracts alongside v1
2. Pause v1 FLIPCore or deploy new FLIPCore
3. Migrate pending redemptions manually
4. Withdraw v1 InsurancePool funds
5. Decommission v1 contracts

## Future Enhancements

1. Receipt trading (secondary market)
2. Partial redemption support
3. Multi-asset escrows
4. Escrow pooling for efficiency
5. Governance for parameter updates
