# FLIP - Flare Liquidation Insurance Protocol

FLIP accelerates FAssets cross-chain settlement on Flare by combining machine-learning predictions with capital-backed insurance guarantees, delivering sub-30-second provisional settlement with 100% payout guarantees.

## Overview

FLIP provides near-instant insured settlement for FAsset redemptions while preserving Flare's trust-minimized security. The protocol uses ML predictions to enable provisional settlement within ~3 seconds, backed by an over-collateralized insurance pool that guarantees user payouts.

## Architecture

- **On-Chain Layer**: Solidity smart contracts (FLIPCore, InsurancePool, PriceHedgePool, OperatorRegistry, OracleRelay)
- **Oracle Layer**: Go-based prediction nodes with ML inference
- **ML Training Layer**: Python-based model training and calibration pipeline
- **Data Pipeline**: Real-time ingestion of FTSO prices, FDC attestations, and FAssets redemptions

## Quick Start

### Prerequisites

- Node.js >= 18
- Python 3.10+
- Go 1.21+ (for oracle nodes)
- Foundry (for contract development)

### Setup

```bash
# Install dependencies
./scripts/setup-dev-env.sh

# Install Node.js dependencies
npm install

# Set up Python virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r ml/requirements.txt

# Configure environment (copy and fill in)
cp data-pipeline/storage/config.example.yaml data-pipeline/storage/config.yaml
```

### Development

```bash
# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test
# or
forge test

# Run data collectors
python3 data-pipeline/collector/ftso_history.py
```

## Network Configuration

- **Flare Mainnet**: Chain ID 14, RPC: `https://flare-api.flare.network/ext/C/rpc`
- **Coston2 Testnet**: Chain ID 114, RPC: `https://coston2-api.flare.network/ext/C/rpc`

See `docs/network-config.md` for full details.

## Documentation

- [Architecture](docs/architecture.md)
- [Contract Specifications](docs/contract-specs.md)
- [Security Audit Plan](docs/security-audit-plan.md)
- [FTSO Integration](docs/ftso-spec.md)
- [FDC Integration](docs/fdc-spec.md)
- [FAssets Integration](docs/fassets-spec.md)

## Project Structure

```
FLIP/
├── contracts/          # Solidity smart contracts
├── ml/                 # Python ML training pipeline
├── oracle/             # Go oracle nodes
├── data-pipeline/      # Data ingestion and storage
├── tests/              # Test suites
├── scripts/            # Deployment scripts
├── monitoring/         # Observability
└── docs/               # Documentation
```

## Development Status

**Stage 0: Foundation & Research** ✅ Complete
- Development environment setup
- Data collection pipeline
- ML research framework
- Contract specifications

**Stage 1: Core Development** 🚧 In Progress
- Smart contracts implementation
- ML training pipeline
- Oracle node development

## Contributing

This project is in active development. See the [architecture documentation](docs/architecture.md) for design details.

## License

[License to be determined]

## Links

- [Flare Developer Hub](https://dev.flare.network/)
- [Flare Network](https://flare.network/)
