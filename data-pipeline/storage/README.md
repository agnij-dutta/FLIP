# Time-series Storage

Recommended: InfluxDB for high-frequency price/attestation data, PostgreSQL for relational metadata.

Setup steps:
1) Provision InfluxDB (bucket: flip-ts, retention ~180 days) or PostgreSQL database.
2) Copy `config.example.yaml` to `config.yaml` with credentials.
3) Ensure network access from collectors/aggregators.
4) Run collectors with DSN/URL via env or config file.
