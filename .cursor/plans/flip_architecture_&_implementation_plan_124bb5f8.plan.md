---
name: FLIP Architecture & Implementation Plan
overview: "Complete architecture and staged implementation plan for FLIP protocol: smart contracts, ML prediction engine, insurance pools, operator network, and integration with Flare's FTSO/FDC infrastructure."
todos:
  - id: 0.1.1
    content: Create project directory structure (FLIP/ with all subdirectories)
    status: completed
  - id: 0.1.2
    content: Set up Foundry development environment (scripts/setup-dev-env.sh)
    status: completed
    dependencies:
      - 0.1.1
  - id: 0.1.3
    content: Configure Flare network configs (Chain ID 14 mainnet, 114 Coston2)
    status: completed
    dependencies:
      - 0.1.1
  - id: 0.1.4
    content: Install and configure Hardhat as alternative tooling
    status: completed
    dependencies:
      - 0.1.1
  - id: 0.1.5
    content: Set up Go development environment for oracle nodes
    status: completed
    dependencies:
      - 0.1.1
  - id: 0.1.6
    content: Set up Python environment for ML training (ml/requirements.txt)
    status: completed
    dependencies:
      - 0.1.1
  - id: 0.1.7
    content: Configure testnet faucet access and RPC endpoints
    status: completed
    dependencies:
      - 0.1.1
  - id: 0.2.1
    content: Implement data-pipeline/collector/ftso_history.py - FTSO historical price queries
    status: completed
  - id: 0.2.2
    content: Implement data-pipeline/collector/fdc_attestations.py - FDC event scraping
    status: completed
  - id: 0.2.3
    content: Implement data-pipeline/collector/fassets_redemptions.py - Redemption history collection
    status: completed
  - id: 0.2.4
    content: Implement data-pipeline/collector/flare_rpc_client.go - RPC client for Flare networks
    status: completed
  - id: 0.2.5
    content: Set up time-series database (InfluxDB/PostgreSQL) for data storage
    status: completed
    dependencies:
      - 0.2.1
      - 0.2.2
      - 0.2.3
      - 0.2.4
  - id: 0.2.6
    content: Create data validation and quality checks
    status: completed
    dependencies:
      - 0.2.5
  - id: 0.3.1
    content: Create ml/research/feature_exploration.ipynb - Analyze FTSO volatility and FDC latency
    status: completed
    dependencies:
      - 0.2.5
  - id: 0.3.2
    content: Create ml/research/model_prototyping.ipynb - Test XGBoost, neural nets, ensemble methods
    status: completed
    dependencies:
      - 0.2.5
  - id: 0.3.3
    content: Create ml/research/conformal_calibration.ipynb - Validate confidence intervals
    status: completed
    dependencies:
      - 0.2.5
  - id: 0.3.4
    content: Create ml/research/backtest_framework.ipynb - Historical simulation framework
    status: completed
    dependencies:
      - 0.2.5
  - id: 0.3.5
    content: Collect and validate 6+ months of historical data for training
    status: completed
    dependencies:
      - 0.3.1
      - 0.3.2
      - 0.3.3
      - 0.3.4
  - id: 0.3.6
    content: Establish baseline model performance metrics
    status: completed
    dependencies:
      - 0.3.5
  - id: 0.4.1
    content: Document FTSOv2 interface specifications (IFtso.sol, IFtsoRegistry.sol)
    status: completed
  - id: 0.4.2
    content: Document FDC interface specifications (IStateConnector.sol)
    status: completed
  - id: 0.4.3
    content: Document FAssets interface specifications (IFAsset.sol, IAgentVault.sol)
    status: completed
  - id: 0.4.4
    content: Create docs/contract-specs.md with all FLIP contract interfaces
    status: completed
    dependencies:
      - 0.4.1
      - 0.4.2
      - 0.4.3
  - id: 0.4.5
    content: Define security audit requirements and plan
    status: completed
    dependencies:
      - 0.4.4
  - id: 0.4.6
    content: Create architecture documentation (docs/architecture.md)
    status: completed
    dependencies:
      - 0.4.4
  - id: 1.1.1.1
    content: Implement contracts/interfaces/IFtso.sol - FTSOv2 interface
    status: completed
    dependencies:
      - 0.4.4
  - id: 1.1.1.2
    content: Implement contracts/interfaces/IFtsoRegistry.sol - FTSO registry interface
    status: completed
    dependencies:
      - 0.4.4
  - id: 1.1.1.3
    content: Implement contracts/interfaces/IStateConnector.sol - FDC interface
    status: completed
    dependencies:
      - 0.4.4
  - id: 1.1.1.4
    content: Implement contracts/interfaces/IFAsset.sol - FAssets interface
    status: completed
    dependencies:
      - 0.4.4
  - id: 1.1.1.5
    content: Implement contracts/interfaces/IAgentVault.sol - Agent vault interface
    status: completed
    dependencies:
      - 0.4.4
  - id: 1.1.2.1
    content: Implement contracts/FLIPCore.sol - Main redemption handler with all functions and events
    status: completed
    dependencies:
      - 1.1.1.1
      - 1.1.1.2
      - 1.1.1.3
      - 1.1.1.4
      - 1.1.1.5
  - id: 1.1.2.2
    content: Implement contracts/InsurancePool.sol - Settlement Guarantee Pool with auto-pause logic
    status: completed
    dependencies:
      - 1.1.1.1
      - 1.1.1.2
      - 1.1.1.3
      - 1.1.1.4
      - 1.1.1.5
  - id: 1.1.2.3
    content: Implement contracts/PriceHedgePool.sol - Price Hedge Pool with FTSO integration
    status: completed
    dependencies:
      - 1.1.1.1
      - 1.1.1.2
      - 1.1.1.3
      - 1.1.1.4
      - 1.1.1.5
  - id: 1.1.2.4
    content: Implement contracts/OperatorRegistry.sol - Operator management with slashing rules
    status: completed
    dependencies:
      - 1.1.1.1
      - 1.1.1.2
      - 1.1.1.3
      - 1.1.1.4
      - 1.1.1.5
  - id: 1.1.2.5
    content: Implement contracts/OracleRelay.sol - Oracle prediction interface with aggregation
    status: completed
    dependencies:
      - 1.1.1.1
      - 1.1.1.2
      - 1.1.1.3
      - 1.1.1.4
      - 1.1.1.5
  - id: 1.1.3.1
    content: Integrate FTSOv2 price feeds into PriceHedgePool
    status: completed
    dependencies:
      - 1.1.2.1
      - 1.1.2.2
      - 1.1.2.3
      - 1.1.2.4
      - 1.1.2.5
  - id: 1.1.3.2
    content: Integrate FDC attestation event listeners into FLIPCore
    status: completed
    dependencies:
      - 1.1.2.1
      - 1.1.2.2
      - 1.1.2.3
      - 1.1.2.4
      - 1.1.2.5
  - id: 1.1.3.3
    content: Integrate FAssets redemption flow hooks
    status: completed
    dependencies:
      - 1.1.2.1
      - 1.1.2.2
      - 1.1.2.3
      - 1.1.2.4
      - 1.1.2.5
  - id: 1.1.3.4
    content: Write unit tests for all contracts (Foundry)
    status: completed
    dependencies:
      - 1.1.3.1
      - 1.1.3.2
      - 1.1.3.3
  - id: 1.1.3.5
    content: Write integration tests with mock FTSO/FDC contracts
    status: completed
    dependencies:
      - 1.1.3.1
      - 1.1.3.2
      - 1.1.3.3
  - id: 1.2.1.1
    content: Implement ml/training/feature_engineering.py with all feature extraction logic
    status: completed
    dependencies:
      - 0.3.6
  - id: 1.2.2.1
    content: Implement ml/training/model_trainer.py - XGBoost, neural nets, ensemble methods
    status: completed
    dependencies:
      - 1.2.1.1
  - id: 1.2.2.2
    content: Implement ml/training/calibration.py - Conformal prediction calibration
    status: completed
    dependencies:
      - 1.2.1.1
  - id: 1.2.3.1
    content: Implement ml/training/backtest.py - Historical validation framework
    status: completed
    dependencies:
      - 1.2.2.1
      - 1.2.2.2
  - id: 1.2.3.2
    content: Validate model achieves >99.7% accuracy on historical data
    status: pending
    dependencies:
      - 1.2.3.1
  - id: 1.2.3.3
    content: Validate confidence intervals have proper coverage (conformal prediction)
    status: pending
    dependencies:
      - 1.2.3.1
  - id: 1.3.1.1
    content: Implement oracle/node/main.go - Main oracle service with Flare RPC connection
    status: completed
    dependencies:
      - 1.2.2.1
      - 1.2.2.2
  - id: 1.3.1.2
    content: Implement oracle/node/predictor.go - ML model inference wrapper
    status: completed
    dependencies:
      - 1.2.2.1
      - 1.2.2.2
  - id: 1.3.1.3
    content: Implement oracle/node/relay.go - On-chain transaction submission with signing
    status: completed
    dependencies:
      - 1.2.2.1
      - 1.2.2.2
  - id: 1.3.2.1
    content: Implement oracle/node/monitor.go - Health checks and drift detection
    status: completed
    dependencies:
      - 1.3.1.1
      - 1.3.1.2
      - 1.3.1.3
  - id: 1.3.3.1
    content: Integrate Python ML model loading (CGO or gRPC)
    status: completed
    dependencies:
      - 1.3.2.1
  - id: 1.3.3.2
    content: Set up operator key management
    status: completed
    dependencies:
      - 1.3.2.1
  - id: 1.3.3.3
    content: Configure operator registration and staking
    status: completed
    dependencies:
      - 1.3.2.1
  - id: 1.4.1.1
    content: Implement data-pipeline/ingest/flare_rpc.go - Real-time FAssets redemption events
    status: completed
    dependencies:
      - 0.2.5
  - id: 1.4.1.2
    content: Implement data-pipeline/ingest/ftso_feeds.go - FTSO price feed streaming
    status: completed
    dependencies:
      - 0.2.5
  - id: 1.4.1.3
    content: Implement data-pipeline/ingest/fdc_attestations.go - FDC event monitoring
    status: completed
    dependencies:
      - 0.2.5
  - id: 1.4.2.1
    content: Implement data-pipeline/storage/timeseries.go - Time-series database integration
    status: completed
    dependencies:
      - 1.4.1.1
      - 1.4.1.2
      - 1.4.1.3
  - id: 1.4.2.2
    content: Implement data-pipeline/aggregator/features.go - Feature computation for ML
    status: completed
    dependencies:
      - 1.4.2.1
  - id: 1.5.1.1
    content: Set up Foundry test suite (tests/contracts/)
    status: completed
    dependencies:
      - 1.1.2.1
      - 1.1.2.2
      - 1.1.2.3
      - 1.1.2.4
      - 1.1.2.5
  - id: 1.5.1.2
    content: Create mock FTSO and FDC contracts for unit tests
    status: completed
    dependencies:
      - 1.5.1.1
  - id: 1.5.1.3
    content: Write unit tests for all FLIP contracts
    status: completed
    dependencies:
      - 1.5.1.2
  - id: 1.5.1.4
    content: Write integration tests with real FTSO/FDC on Coston2 testnet
    status: completed
    dependencies:
      - 1.5.1.2
  - id: 1.5.1.5
    content: Configure network settings in hardhat.config.js or Foundry config
    status: completed
    dependencies:
      - 1.5.1.2
  - id: 1.5.2.1
    content: Implement end-to-end redemption flow tests (tests/integration/)
    status: completed
    dependencies:
      - 1.1.3.1
      - 1.1.3.2
      - 1.1.3.3
      - 1.3.1.1
      - 1.3.1.2
      - 1.3.1.3
  - id: 1.5.3.1
    content: Implement ML validation tests (tests/ml/)
    status: completed
    dependencies:
      - 1.2.3.1
      - 1.2.3.2
      - 1.2.3.3
  - id: 1.5.4.1
    content: Implement insurance pool stress tests (tests/stress/)
    status: completed
    dependencies:
      - 1.1.2.2
  - id: 2.1.1
    content: Create scripts/deploy-songbird.sh - Contract deployment script
    status: pending
    dependencies:
      - 1.1.3.4
      - 1.1.3.5
      - 1.5.1.3
      - 1.5.2.1
  - id: 2.1.2
    content: Verify Songbird network configuration (Chain ID, RPC endpoints)
    status: pending
    dependencies:
      - 2.1.1
  - id: 2.1.3
    content: Deploy all FLIP contracts to Songbird canary-network
    status: pending
    dependencies:
      - 2.1.2
  - id: 2.1.4
    content: Verify contracts on Songbird explorer
    status: pending
    dependencies:
      - 2.1.3
  - id: 2.1.5
    content: Initialize contracts with FTSO and FDC addresses
    status: pending
    dependencies:
      - 2.1.3
  - id: 2.1.6
    content: Set governance parameters (multisig configuration)
    status: pending
    dependencies:
      - 2.1.3
  - id: 2.2.1
    content: Create scripts/configure-operators.sh - Operator onboarding script
    status: pending
    dependencies:
      - 2.1.6
  - id: 2.2.2
    content: Register initial operators with minimum stake ($100k SGB equivalent)
    status: pending
    dependencies:
      - 2.2.1
  - id: 2.2.3
    content: Configure operator permissions and slashing parameters
    status: pending
    dependencies:
      - 2.2.2
  - id: 2.2.4
    content: Set up operator monitoring and alerting infrastructure
    status: pending
    dependencies:
      - 2.2.2
  - id: 2.3.1
    content: Create scripts/bootstrap-pool.sh - Pool funding script
    status: pending
    dependencies:
      - 2.1.6
  - id: 2.3.2
    content: Fund Settlement Guarantee Pool (SGP) with initial capital
    status: pending
    dependencies:
      - 2.3.1
  - id: 2.3.3
    content: Fund Price Hedge Pool (PHP) with FLR/SGB
    status: pending
    dependencies:
      - 2.3.1
  - id: 2.3.4
    content: Configure pool utilization thresholds and auto-pause rules
    status: pending
    dependencies:
      - 2.3.2
      - 2.3.3
  - id: 2.4.1
    content: Implement monitoring/dashboard/ - Real-time metrics dashboard
    status: pending
    dependencies:
      - 2.1.3
  - id: 2.4.2
    content: Implement monitoring/alerts/ - PagerDuty/Slack alerting
    status: pending
    dependencies:
      - 2.1.3
  - id: 2.4.3
    content: Implement monitoring/logging/ - Structured logging system
    status: pending
    dependencies:
      - 2.1.3
  - id: 2.5.1
    content: Partner with FAssets agents for integration testing
    status: pending
    dependencies:
      - 2.1.3
      - 2.2.2
      - 2.3.2
  - id: 2.5.2
    content: "Set up live backtesting: log all redemptions for model validation"
    status: pending
    dependencies:
      - 2.5.1
  - id: 2.5.3
    content: Onboard additional operators and test staking
    status: pending
    dependencies:
      - 2.5.1
  - id: 2.5.4
    content: Performance tuning based on real-world data
    status: pending
    dependencies:
      - 2.5.2
      - 2.5.3
  - id: 2.5.5
    content: "Collect metrics: latency, accuracy, pool utilization"
    status: pending
    dependencies:
      - 2.5.4
  - id: 3.1.1
    content: Complete smart contract security audit (Trail of Bits, OpenZeppelin, etc.)
    status: pending
    dependencies:
      - 2.5.5
  - id: 3.1.2
    content: Complete ML model validation audit (statistical review)
    status: pending
    dependencies:
      - 2.5.5
  - id: 3.1.3
    content: Complete economic model review (actuarial validation)
    status: pending
    dependencies:
      - 2.5.5
  - id: 3.1.4
    content: Address all audit findings and implement fixes
    status: pending
    dependencies:
      - 3.1.1
      - 3.1.2
      - 3.1.3
  - id: 3.2.1
    content: Create scripts/deploy-flare.sh - Mainnet deployment script
    status: pending
    dependencies:
      - 3.1.4
  - id: 3.2.2
    content: Deploy all contracts to Flare mainnet (Chain ID 14)
    status: pending
    dependencies:
      - 3.2.1
  - id: 3.2.3
    content: Verify contracts on Flare explorers
    status: pending
    dependencies:
      - 3.2.2
  - id: 3.2.4
    content: Initialize with production FTSO and FDC addresses
    status: pending
    dependencies:
      - 3.2.2
  - id: 3.2.5
    content: Bootstrap insurance pools with production capital
    status: pending
    dependencies:
      - 3.2.2
  - id: 3.3.1
    content: Set up initial multisig (Flare Foundation or grant committee)
    status: pending
    dependencies:
      - 3.2.5
  - id: 3.3.2
    content: Configure governance parameters (fee rates, confidence thresholds, pause logic)
    status: pending
    dependencies:
      - 3.3.1
  - id: 3.3.3
    content: Plan DAO transition (on-chain voting with operators)
    status: pending
    dependencies:
      - 3.3.2
  - id: 3.4.1
    content: Open operator onboarding process
    status: pending
    dependencies:
      - 3.2.5
  - id: 3.4.2
    content: Implement KYC/AML compliance (optional)
    status: pending
    dependencies:
      - 3.4.1
  - id: 3.4.3
    content: Set minimum stake requirements ($100k FLR or stablecoins)
    status: pending
    dependencies:
      - 3.4.1
  - id: 3.4.4
    content: Create operator performance dashboard and leaderboards
    status: pending
    dependencies:
      - 3.4.3
  - id: 3.5.1
    content: Create developer documentation (integration guides for FAssets agents)
    status: pending
    dependencies:
      - 3.2.5
  - id: 3.5.2
    content: Create API reference (oracle node endpoints, contract interfaces)
    status: pending
    dependencies:
      - 3.2.5
  - id: 3.5.3
    content: Create user guides (how to use FLIP for instant redemptions)
    status: pending
    dependencies:
      - 3.2.5
  - id: 3.5.4
    content: Set up public monitoring dashboards (pool utilization, operator performance)
    status: pending
    dependencies:
      - 3.2.5
  - id: 3.5.5
    content: Create docs/api-reference.md with complete API documentation
    status: pending
    dependencies:
      - 3.5.1
      - 3.5.2
      - 3.5.3
      - 3.5.4
---

# FLIP Architecture & Implementation Plan

[Previous plan content remains the same - I'm just updating the todos section]

## Implementation Todos

### Stage 0: Foundation & Research (Weeks 1-4)

#### 0.1 Development Environment Setup

- **0.1.1** Create project directory structure (`FLIP/` with all subdirectories)
- **0.1.2** Set up Foundry development environment (`scripts/setup-dev-env.sh`)
- **0.1.3** Configure Flare network configs (Chain ID 14 mainnet, 114 Coston2)
- **0.1.4** Install and configure Hardhat as alternative tooling
- **0.1.5** Set up Go development environment for oracle nodes
- **0.1.6** Set up Python environment for ML training (`ml/requirements.txt`)
- **0.1.7** Configure testnet faucet access and RPC endpoints

#### 0.2 Data Collection Pipeline

- **0.2.1** Implement `data-pipeline/collector/ftso_history.py` - FTSO historical price queries
- **0.2.2** Implement `data-pipeline/collector/fdc_attestations.py` - FDC event scraping
- **0.2.3** Implement `data-pipeline/collector/fassets_redemptions.py` - Redemption history collection
- **0.2.4** Implement `data-pipeline/collector/flare_rpc_client.go` - RPC client for Flare networks
- **0.2.5** Set up time-series database (InfluxDB/PostgreSQL) for data storage
- **0.2.6** Create data validation and quality checks

#### 0.3 ML Research & Prototyping

- **0.3.1** Create `ml/research/feature_exploration.ipynb` - Analyze FTSO volatility and FDC latency
- **0.3.2** Create `ml/research/model_prototyping.ipynb` - Test XGBoost, neural nets, ensemble methods
- **0.3.3** Create `ml/research/conformal_calibration.ipynb` - Validate confidence intervals
- **0.3.4** Create `ml/research/backtest_framework.ipynb` - Historical simulation framework
- **0.3.5** Collect and validate 6+ months of historical data for training
- **0.3.6** Establish baseline model performance metrics

#### 0.4 Contract Specifications & Documentation

- **0.4.1** Document FTSOv2 interface specifications (`IFtso.sol`, `IFtsoRegistry.sol`)
- **0.4.2** Document FDC interface specifications (`IStateConnector.sol`)
- **0.4.3** Document FAssets interface specifications (`IFAsset.sol`, `IAgentVault.sol`)
- **0.4.4** Create `docs/contract-specs.md` with all FLIP contract interfaces
- **0.4.5** Define security audit requirements and plan
- **0.4.6** Create architecture documentation (`docs/architecture.md`)

### Stage 1: Core Development (Weeks 5-20)

#### 1.1 Smart Contracts Development

**1.1.1 Flare Protocol Interfaces**

- **1.1.1.1** Implement `contracts/interfaces/IFtso.sol` - FTSOv2 interface
- **1.1.1.2** Implement `contracts/interfaces/IFtsoRegistry.sol` - FTSO registry interface
- **1.1.1.3** Implement `contracts/interfaces/IStateConnector.sol` - FDC interface
- **1.1.1.4** Implement `contracts/interfaces/IFAsset.sol` - FAssets interface
- **1.1.1.5** Implement `contracts/interfaces/IAgentVault.sol` - Agent vault interface

**1.1.2 Core FLIP Contracts**

- **1.1.2.1** Implement `contracts/FLIPCore.sol` - Main redemption handler
- `requestRedemption()` function
- `finalizeProvisional()` function
- `claimFailure()` function
- `getRedemptionStatus()` view function
- Event emissions for all state changes
- **1.1.2.2** Implement `contracts/InsurancePool.sol` - Settlement Guarantee Pool
- `claimFailure()` function
- `replenishPool()` function
- `getPoolUtilization()` view function
- `getPoolBalance()` view function
- Auto-pause logic (pool < 3× monthly liability)
- **1.1.2.3** Implement `contracts/PriceHedgePool.sol` - Price Hedge Pool with FTSO integration
- `lockPrice()` function with FTSO price snapshot
- `checkHedgeTolerance()` function (1% tolerance)
- `settleHedge()` function
- FTSO integration for real-time price locking
- **1.1.2.4** Implement `contracts/OperatorRegistry.sol` - Operator management
- `stake()` function
- `slashOperator()` function (20% if miss_rate > 1%, full payout on incorrect settlement)
- `distributeRewards()` function
- `getOperatorStats()` view function
- **1.1.2.5** Implement `contracts/OracleRelay.sol` - Oracle prediction interface
- `submitPrediction()` function with signature verification
- `getLatestPrediction()` view function
- Prediction aggregation logic

**1.1.3 Integration & Testing**

- **1.1.3.1** Integrate FTSOv2 price feeds into PriceHedgePool
- **1.1.3.2** Integrate FDC attestation event listeners into FLIPCore
- **1.1.3.3** Integrate FAssets redemption flow hooks
- **1.1.3.4** Write unit tests for all contracts (Foundry)
- **1.1.3.5** Write integration tests with mock FTSO/FDC contracts

#### 1.2 ML Training Pipeline

**1.2.1 Feature Engineering**

- **1.2.1.1** Implement `ml/training/feature_engineering.py`
- FTSO price volatility (rolling std dev)
- Recent redemption success rate
- Mempool congestion metrics
- FDC attestation latency history
- Time-of-day patterns
- Operator performance correlation

**1.2.2 Model Training**

- **1.2.2.1** Implement `ml/training/model_trainer.py`
- XGBoost model training
- Neural network training (alternative)
- Ensemble method implementation
- Model serialization and versioning
- **1.2.2.2** Implement `ml/training/calibration.py`
- Conformal prediction calibration
- Confidence interval computation `[p_lower, p_upper]`
- Calibration validation

**1.2.3 Backtesting & Validation**

- **1.2.3.1** Implement `ml/training/backtest.py`
- Historical simulation framework
- Performance metrics calculation (accuracy, precision, recall)
- Cross-validation implementation
- Out-of-sample testing
- **1.2.3.2** Validate model achieves >99.7% accuracy on historical data
- **1.2.3.3** Validate confidence intervals have proper coverage (conformal prediction)

#### 1.3 Oracle Node Development

**1.3.1 Core Oracle Service**

- **1.3.1.1** Implement `oracle/node/main.go` - Main oracle service
- Flare RPC connection management
- Event subscription (RedemptionRequested events)
- Service lifecycle management
- **1.3.1.2** Implement `oracle/node/predictor.go` - ML model inference
- Load serialized ML model (XGBoost/ONNX/TensorFlow Lite)
- Feature extraction from on-chain data
- Model inference execution
- Confidence interval computation
- **1.3.1.3** Implement `oracle/node/relay.go` - On-chain transaction submission
- Sign predictions with operator private key
- Submit to OracleRelay.sol contract
- Replay protection (timestamp + nonce)

**1.3.2 Monitoring & Drift Detection**

- **1.3.2.1** Implement `oracle/node/monitor.go` - Health checks and drift detection
- Track prediction accuracy vs FDC outcomes
- Alert on accuracy drop below 99.5%
- Automatic retraining trigger
- Fallback to FDC-only mode on drift

**1.3.3 Integration**

- **1.3.3.1** Integrate Python ML model loading (CGO or gRPC)
- **1.3.3.2** Set up operator key management
- **1.3.3.3** Configure operator registration and staking

#### 1.4 Data Pipeline Development

**1.4.1 Real-time Data Ingestion**

- **1.4.1.1** Implement `data-pipeline/ingest/flare_rpc.go`
- Flare RPC connection (mainnet/testnet)
- WebSocket subscription for new blocks
- FAssets redemption event monitoring
- Block time tracking (~1.8s)
- **1.4.1.2** Implement `data-pipeline/ingest/ftso_feeds.go`
- FTSOv2 block-latency feed subscription (every ~1.8s)
- Incremental delta update tracking (1/2^18 precision)
- VRF provider selection monitoring
- Volatility incentive detection
- Scaling feed anchor storage (90-second epochs)
- **1.4.1.3** Implement `data-pipeline/ingest/fdc_attestations.go`
- StateConnector event subscription
- Request ID and timestamp tracking
- Latency measurement (request → attestation)
- FDC Verifier API cross-reference
- DA Layer monitoring

**1.4.2 Data Storage & Aggregation**

- **1.4.2.1** Implement `data-pipeline/storage/timeseries.go`
- InfluxDB/PostgreSQL integration
- Time-series data storage (FTSO prices, FDC attestations, redemptions)
- Indexing by timestamp, asset, redemption ID, agent
- 6+ month data retention
- **1.4.2.2** Implement `data-pipeline/aggregator/features.go`
- FTSO volatility computation (1h, 24h windows)
- FDC success rate calculation (recent 100 redemptions)
- FDC latency distribution (mean, p95, p99)
- Agent performance metrics
- Time-of-day pattern extraction
- Mempool metrics aggregation

#### 1.5 Testing Infrastructure

**1.5.1 Contract Testing**

- **1.5.1.1** Set up Foundry test suite (`tests/contracts/`)
- **1.5.1.2** Create mock FTSO and FDC contracts for unit tests
- **1.5.1.3** Write unit tests for all FLIP contracts
- **1.5.1.4** Write integration tests with real FTSO/FDC on Coston2 testnet
- **1.5.1.5** Configure network settings in `hardhat.config.js` or Foundry config

**1.5.2 Integration Testing**

- **1.5.2.1** Implement end-to-end redemption flow tests (`tests/integration/`)
- Full flow: User → FLIP → FTSO → Oracle → Provisional settlement → FDC
- Failure scenarios: FDC rejection, insurance payout, operator slashing
- Edge cases: High volatility, FTSO unavailability, FDC delay
- Performance tests: Measure latency (target ≤30s)

**1.5.3 ML Model Testing**

- **1.5.3.1** Implement ML validation tests (`tests/ml/`)
- Cross-validation on 6+ months data
- Out-of-sample testing (recent 3 months)
- Conformal prediction calibration validation
- Feature importance analysis
- Model drift detection tests

**1.5.4 Stress Testing**

- **1.5.4.1** Implement insurance pool stress tests (`tests/stress/`)
- Simulate 0.35% failure rate scenarios
- Test pool drawdown under correlated failures
- Validate auto-pause triggers
- Test operator slashing under high miss rates

### Stage 2: Beta Deployment (Weeks 21-25)

#### 2.1 Songbird Deployment Preparation

- **2.1.1** Create `scripts/deploy-songbird.sh` - Contract deployment script
- **2.1.2** Verify Songbird network configuration (Chain ID, RPC endpoints)
- **2.1.3** Deploy all FLIP contracts to Songbird canary-network
- **2.1.4** Verify contracts on Songbird explorer
- **2.1.5** Initialize contracts with FTSO and FDC addresses
- **2.1.6** Set governance parameters (multisig configuration)

#### 2.2 Operator Onboarding

- **2.2.1** Create `scripts/configure-operators.sh` - Operator onboarding script
- **2.2.2** Register initial operators with minimum stake ($100k SGB equivalent)
- **2.2.3** Configure operator permissions and slashing parameters
- **2.2.4** Set up operator monitoring and alerting infrastructure

#### 2.3 Insurance Pool Bootstrap

- **2.3.1** Create `scripts/bootstrap-pool.sh` - Pool funding script
- **2.3.2** Fund Settlement Guarantee Pool (SGP) with initial capital
- **2.3.3** Fund Price Hedge Pool (PHP) with FLR/SGB
- **2.3.4** Configure pool utilization thresholds and auto-pause rules

#### 2.4 Monitoring Infrastructure

- **2.4.1** Implement `monitoring/dashboard/` - Real-time metrics dashboard
- **2.4.2** Implement `monitoring/alerts/` - PagerDuty/Slack alerting
- **2.4.3** Implement `monitoring/logging/` - Structured logging system

#### 2.5 Beta Testing

- **2.5.1** Partner with FAssets agents for integration testing
- **2.5.2** Set up live backtesting: log all redemptions for model validation
- **2.5.3** Onboard additional operators and test staking
- **2.5.4** Performance tuning based on real-world data
- **2.5.5** Collect metrics: latency, accuracy, pool utilization

### Stage 3: Production Release (Week 26+)

#### 3.1 Security Audits

- **3.1.1** Complete smart contract security audit (Trail of Bits, OpenZeppelin, etc.)
- **3.1.2** Complete ML model validation audit (statistical review)
- **3.1.3** Complete economic model review (actuarial validation)
- **3.1.4** Address all audit findings and implement fixes

#### 3.2 Flare Mainnet Deployment

- **3.2.1** Create `scripts/deploy-flare.sh` - Mainnet deployment script
- **3.2.2** Deploy all contracts to Flare mainnet (Chain ID 14)
- **3.2.3** Verify contracts on Flare explorers
- **3.2.4** Initialize with production FTSO and FDC addresses
- **3.2.5** Bootstrap insurance pools with production capital

#### 3.3 Governance Setup

- **3.3.1** Set up initial multisig (Flare Foundation or grant committee)
- **3.3.2** Configure governance parameters (fee rates, confidence thresholds, pause logic)
- **3.3.3** Plan DAO transition (on-chain voting with operators)

#### 3.4 Public Operator Registry

- **3.4.1** Open operator onboarding process
- **3.4.2** Implement KYC/AML compliance (optional)
- **3.4.3** Set minimum stake requirements ($100k FLR or stablecoins)
- **3.4.4** Create operator performance dashboard and leaderboards

#### 3.5 Documentation & API

- **3.5.1** Create developer documentation (integration guides for FAssets agents)
- **3.5.2** Create API reference (oracle node endpoints, contract interfaces)
- **3.5.3** Create user guides (how to use FLIP for instant redemptions)
- **3.5.4** Set up public monitoring dashboards (pool utilization, operator performance)
- **3.5.5** Create `docs/api-reference.md` with complete API documentation

## Todo Dependencies

**Stage 0 Dependencies:**

- 0.1.1 → 0.1.2, 0.1.3, 0.1.4, 0.1.5, 0.1.6
- 0.2.1, 0.2.2, 0.2.3, 0.2.4 → 0.2.5 → 0.2.6
- 0.2.5 → 0.3.1, 0.3.2, 0.3.3, 0.3.4 → 0.3.5 → 0.3.6
- 0.4.1, 0.4.2, 0.4.3 → 0.4.4 → 0.4.5, 0.4.6

**Stage 1 Dependencies:**

- 0.4.4 → 1.1.1.1, 1.1.1.2, 1.1.1.3, 1.1.1.4, 1.1.1.5
- 1.1.1.* → 1.1.2.1, 1.1.2.2, 1.1.2.3, 1.1.2.4, 1.1.2.5
- 1.1.2.* → 1.1.3.1, 1.1.3.2, 1.1.3.3 → 1.1.3.4, 1.1.3.5
- 0.3.6 → 1.2.1.1 → 1.2.2.1, 1.2.2.2 → 1.2.3.1 → 1.2.3.2, 1.2.3.3
- 1.2.2.* → 1.3.1.1, 1.3.1.2, 1.3.1.3 → 1.3.2.1 → 1.3.3.1, 1.3.3.2, 1.3.3.3
- 0.2.5 → 1.4.1.1, 1.4.1.2, 1.4.1.3 → 1.4.2.1 → 1.4.2.2
- 1.1.2.* → 1.5.1.1 → 1.5.1.2 → 1.5.1.3, 1.5.1.4, 1.5.1.5
- 1.1.3.*, 1.3.1.* → 1.5.2.1
- 1.2.3.* → 1.5.3.1
- 1.1.2.2 → 1.5.4.1

**Stage 2 Dependencies:**

- 1.1.3.*, 1.5.1.*, 1.5.2.* → 2.1.1 → 2.1.2 → 2.1.3 → 2.1.4, 2.1.5, 2.1.6
- 2.1.6 → 2.2.1 → 2.2.2 → 2.2.3, 2.2.4
- 2.1.6 → 2.3.1 → 2.3.2, 2.3.3 → 2.3.4
- 2.1.3 → 2.4.1, 2.4.2, 2.4.3
- 2.1.3, 2.2.2, 2.3.2 → 2.5.1 → 2.5.2, 2.5.3 → 2.5.4 → 2.5.5

**Stage 3 Dependencies:**

- 2.5.5 → 3.1.1, 3.1.2, 3.1.3 → 3.1.4
- 3.1.4 → 3.2.1 → 3.2.2 → 3.2.3, 3.2.4 → 3.2.5
- 3.2.5 → 3.3.1 → 3.3.2 → 3.3.3
- 3.2.5 → 3.4.1 → 3.4.2, 3.4.3 → 3.4.4
- 3.2.5 → 3.5.1, 3.5.2, 3.5.3, 3.5.4 → 3.5.5