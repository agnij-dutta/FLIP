# FLIP Architecture (Stage 0 Draft)

Layers:
- On-Chain: FLIPCore, InsurancePool, PriceHedgePool, OperatorRegistry, OracleRelay
- Oracle Layer: Go nodes with ML inference + signed predictions
- ML Layer: Python training, conformal calibration, backtesting
- Data Layer: Ingestion (FTSO/FDC/FAssets), time-series storage

Flows:
1) User redemption -> FLIPCore
2) FTSO price snapshot -> PriceHedgePool locks price with tolerance
3) Oracle nodes compute p(success) -> OracleRelay submits signed verdicts
4) High-confidence -> provisional settlement + insurance earmark
5) FDC attestation -> release or payout + slashing
6) Low-confidence -> wait for FDC (no provisional)

Safety:
- FDC final judge; no bypass
- Insurance-backed provisional settlements
- Slashing aligned with payout size
- Auto-pause when pool < 3x monthly liability
