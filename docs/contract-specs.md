# FLIP Contract Interfaces

## FTSOv2
- See `docs/ftso-spec.md`
- Interfaces: `IFtso.sol`, `IFtsoRegistry.sol`

## FDC
- See `docs/fdc-spec.md`
- Interface: `IStateConnector.sol`

## FAssets
- See `docs/fassets-spec.md`
- Interfaces: `IFAsset.sol`, `IAgentVault.sol`

## FLIP Contracts
- `FLIPCore.sol`: requestRedemption, finalizeProvisional, claimFailure, getRedemptionStatus, events
- `InsurancePool.sol`: claimFailure, replenishPool, getPoolUtilization, getPoolBalance, auto-pause rules
- `PriceHedgePool.sol`: lockPrice (FTSO snapshot), checkHedgeTolerance (1%), settleHedge
- `OperatorRegistry.sol`: stake, slashOperator, distributeRewards, getOperatorStats
- `OracleRelay.sol`: submitPrediction (signed), getLatestPrediction, aggregation logic

Integration Points:
- FTSOv2 for price snapshots and hedging
- FDC attestation events for finality
- FAssets redemption hooks
