# Data Collection Plan (6+ months)

Sources:
- FTSO block-latency feeds (2-week on-chain, extend via archival provider)
- FDC Attestation events (StateConnector logs + verifier API)
- FAssets redemption events (RedemptionRequested/Completed/Failed)

Steps:
1) Run collectors: ftso_history, fdc_attestations, fassets_redemptions.
2) Export to time-series DB (InfluxDB/PG) with retention >= 180 days.
3) Backfill via archival provider for months beyond on-chain history.
4) Validate with data-pipeline/collector/validation.py.

Status: Stubbed for execution once archival access is available.
