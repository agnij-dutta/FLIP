# FLIP v2 - Current Implementation Map

## Executive Summary

This document provides a comprehensive map of the current FLIP v2 implementation, including all contracts, code structure, deployed addresses, and functional capabilities as of the latest deployment.

**Last Updated**: January 2026  
**Deployment Status**: ✅ Deployed to Coston2 Testnet  
**Version**: FLIP v2.0 (Escrow-Based Model)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Smart Contracts](#smart-contracts)
3. [Oracle System](#oracle-system)
4. [Frontend Implementation](#frontend-implementation)
5. [Data Pipeline](#data-pipeline)
6. [Deployment Status](#deployment-status)
7. [Known Gaps & Limitations](#known-gaps--limitations)

---

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│  (Frontend: Next.js + Wagmi + RainbowKit)               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              On-Chain Contracts (Solidity)              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  FLIPCore    │  │ EscrowVault  │  │ Settlement   │ │
│  │              │  │              │  │ Receipt      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ LP Registry  │  │ Price Hedge  │  │ Operator     │ │
│  │              │  │ Pool         │  │ Registry     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                   │
│  │ OracleRelay  │  │ Deterministic│                   │
│  │              │  │ Scoring      │                   │
│  └──────────────┘  └──────────────┘                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            Oracle Layer (Go)                            │
│  - Event Monitoring                                     │
│  - Deterministic Scoring                                │
│  - Prediction Submission                                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│         External Integrations                           │
│  - Flare FTSO (Price Feeds)                             │
│  - Flare FDC (State Connector)                          │
│  - Flare FAssets (FXRP)                                 │
└─────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Escrow-Based Settlement**: No prefunded pools, funds escrowed per redemption
2. **FDC as Final Judge**: All settlements require FDC confirmation
3. **Market-Based Liquidity**: LPs opt-in with custom parameters
4. **Deterministic Scoring**: On-chain mathematical scoring (no ML dependency)
5. **Advisory Oracles**: Oracles provide routing suggestions, not capital triggers

---

## Smart Contracts

### 1. FLIPCore (`contracts/FLIPCore.sol`)

**Purpose**: Main redemption handler coordinating the entire flow

**Key Functions**:
- `requestRedemption(uint256 _amount, address _asset)` - User initiates redemption
- `finalizeProvisional(uint256 _redemptionId, ...)` - Oracle/operator finalizes escrow
- `handleFDCAttestation(uint256 _redemptionId, uint256 _requestId, bool _success)` - FDC result handler
- `claimFailure(uint256 _redemptionId)` - Failure claim handler

**State Variables**:
- `mapping(uint256 => Redemption) public redemptions` - All redemption records
- `uint256 public nextRedemptionId` - Auto-incrementing ID counter
- `RedemptionStatus` enum: Pending, QueuedForFDC, EscrowCreated, ReceiptRedeemed, Finalized, Failed, Timeout

**Dependencies**:
- `EscrowVault` - Escrow management
- `SettlementReceipt` - NFT minting
- `LiquidityProviderRegistry` - LP matching
- `PriceHedgePool` - Price locking
- `OperatorRegistry` - Operator management
- `DeterministicScoring` - Risk scoring

**Current Status**: ✅ Fully implemented, deployed to Coston2

**Deployed Address**: `0x1151473d15F012d0Dd54f8e707dB6708BD25981F` (Coston2)

---

### 2. EscrowVault (`contracts/EscrowVault.sol`)

**Purpose**: Conditional escrow vault holding funds until FDC adjudication

**Key Functions**:
- `createEscrow(...)` - Create escrow for redemption
- `releaseOnFDC(uint256 _redemptionId, bool _success, uint256 _fdcRoundId)` - Release based on FDC
- `timeoutRelease(uint256 _redemptionId)` - Handle timeout

**State Variables**:
- `mapping(uint256 => Escrow) public escrows` - Escrow records
- `uint256 public constant FDC_TIMEOUT = 600` - 10 minute timeout

**Escrow Structure**:
```solidity
struct Escrow {
    uint256 redemptionId;
    address user;
    address lp;              // LP address if LP-funded, address(0) if user-wait
    address asset;
    uint256 amount;
    uint256 createdAt;
    uint256 fdcRoundId;
    EscrowStatus status;
    bool lpFunded;
}
```

**Current Status**: ✅ Implemented, but **CRITICAL GAP**: Does not actually hold funds (see Known Gaps)

**Deployed Address**: `0x96f78a441cd5F495BdE362685B200c285e445073` (Coston2)

---

### 3. SettlementReceipt (`contracts/SettlementReceipt.sol`)

**Purpose**: ERC-721 NFT representing conditional redemption claims

**Key Functions**:
- `mintReceipt(...)` - Mint receipt NFT to user
- `redeemNow(uint256 _receiptId)` - Immediate redemption (with haircut)
- `redeemAfterFDC(uint256 _receiptId)` - Redemption after FDC confirmation

**Receipt Metadata**:
```solidity
struct ReceiptMetadata {
    uint256 redemptionId;
    address asset;
    uint256 amount;
    uint256 haircutRate;      // Scaled: 1000000 = 100%
    uint256 createdAt;
    uint256 fdcRoundId;
    bool redeemed;
    address lp;               // LP address if LP-funded
}
```

**Current Status**: ✅ Fully implemented, deployed

**Deployed Address**: `0x17A223eB9D0d74265da99Ccbb994B6Ea75E4Ecb7` (Coston2)

**Gap**: `redeemNow()` emits event but doesn't transfer funds (see Known Gaps)

---

### 4. LiquidityProviderRegistry (`contracts/LiquidityProviderRegistry.sol`)

**Purpose**: Market-based liquidity provider system

**Key Functions**:
- `depositLiquidity(address _asset, uint256 _amount, uint256 _minHaircut, uint256 _maxDelay)` - LP deposits
- `withdrawLiquidity(address _asset, uint256 _amount)` - LP withdraws
- `matchLiquidity(address _asset, uint256 _amount, uint256 _requestedHaircut)` - Match LP for redemption

**LP Position Structure**:
```solidity
struct LPPosition {
    address lp;
    address asset;
    uint256 depositedAmount;
    uint256 availableAmount;
    uint256 minHaircut;       // Scaled: 1000000 = 100%
    uint256 maxDelay;         // Seconds
    uint256 totalEarned;
    bool active;
}
```

**Current Status**: ✅ Implemented, but **CRITICAL GAP**: Accepts `msg.value` but doesn't store funds (see Known Gaps)

**Deployed Address**: `0x3A6aEa499Df3e330E9BBFfeF9Fe5393FA6227E36` (Coston2)

---

### 5. PriceHedgePool (`contracts/PriceHedgePool.sol`)

**Purpose**: Lock FTSO prices and hedge against price movements

**Key Functions**:
- `lockPrice(address _asset, uint256 _amount)` - Lock current price
- `settleHedge(uint256 _hedgeId)` - Settle hedge after FDC

**Current Status**: ✅ Fully implemented, deployed

**Deployed Address**: `0xb8d9efA7348b7E89d308F8f6284Fbc14D2C4d3Ef` (Coston2)

---

### 6. OperatorRegistry (`contracts/OperatorRegistry.sol`)

**Purpose**: Manage oracle operators with staking and slashing

**Key Functions**:
- `registerOperator(uint256 _stake)` - Register as operator
- `distributeRewards()` - Distribute rewards to operators

**Current Status**: ✅ Fully implemented, deployed

**Deployed Address**: `0x98E12876aB1b38f1B6ac6ceA745f8BA703Ff2DEB` (Coston2)

---

### 7. OracleRelay (`contracts/OracleRelay.sol`)

**Purpose**: Receive advisory predictions from oracle nodes

**Key Functions**:
- `submitPrediction(uint256 _redemptionId, uint256 _score, uint256 _suggestedHaircut, uint8 _routingDecision)` - Submit prediction

**Current Status**: ✅ Fully implemented, deployed

**Deployed Address**: `0xa9feC29134294e5Cb18e8125F700a1d8C354891f` (Coston2)

---

### 8. DeterministicScoring (`contracts/DeterministicScoring.sol`)

**Purpose**: On-chain mathematical scoring library

**Key Functions**:
- `calculateScore(ScoringParams memory params)` - Calculate redemption score

**Scoring Formula**:
- Base score from volatility, agent metrics, historical data
- Confidence intervals: `confidenceLower = score * 98 / 100` (2% conservative)
- Threshold: `PROVISIONAL_THRESHOLD = 997000` (99.7%)

**Current Status**: ✅ Fully implemented

---

### 9. FtsoV2Adapter (`contracts/FtsoV2Adapter.sol`)

**Purpose**: Adapter for Flare FTSO v2 price feeds

**Key Functions**:
- `getCurrentPriceWithDecimals(string memory _symbol)` - Get FTSO price

**Current Status**: ✅ Fully implemented, deployed

**Deployed Address**: `0x05108Aa7A166B1f9A32B9bbCb0D335cd1441Ad67` (Coston2)

---

## Oracle System

### Oracle Node (`oracle/node/`)

**Language**: Go

**Key Files**:
- `main_enhanced.go` - Main oracle node service
- `relay.go` - Contract interaction
- `scorer.go` - Deterministic scoring logic
- `monitor.go` - Event monitoring

**Current Capabilities**:
- ✅ Monitors `RedemptionRequested` events
- ✅ Calculates deterministic scores
- ✅ Submits predictions to `OracleRelay`
- ✅ Integrates with deployed contracts

**Gap**: Not running as a service (manual execution only)

---

## Frontend Implementation

### Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Web3**: Wagmi + Viem
- **Wallet**: RainbowKit
- **UI Components**: shadcn/ui

### Pages

#### 1. Landing Page (`frontend/app/page.tsx`)
- Hero section with neural network animation
- Features timeline
- FDC messaging
- **Status**: ✅ Implemented

#### 2. Redemption Page (`frontend/app/redeem/page.tsx`)
- FXRP balance display
- Approval flow (unlimited approval)
- Redemption request
- Status tracking (live updates every 10s)
- Receipt display
- **Status**: ✅ Implemented

**Features**:
- Gas estimation with 50% buffer
- Automatic allowance refresh after approval
- Real-time redemption status polling
- Price locked display
- Receipt NFT display

**Gap**: No XRPL address input, no XRPL payment tracking

#### 3. Status Page (`frontend/app/status/page.tsx`)
- System health metrics
- Contract addresses
- Statistics
- **Status**: ✅ Implemented

### Components

- `Header` - Navigation bar
- `TextScramble` - Animated text effects
- `RealTimeAnalytics` - Analytics display
- `RadialOrbitalTimeline` - Features timeline

### Contract Integration

**File**: `frontend/lib/contracts.ts`

**Current Contracts**:
- FLIPCore: `0x1151473d15F012d0Dd54f8e707dB6708BD25981F`
- EscrowVault: `0x96f78a441cd5F495BdE362685B200c285e445073`
- SettlementReceipt: `0x17A223eB9D0d74265da99Ccbb994B6Ea75E4Ecb7`
- LiquidityProviderRegistry: `0x3A6aEa499Df3e330E9BBFfeF9Fe5393FA6227E36`
- FXRP: `0x0b6A3645c240605887a5532109323A3E12273dc7`

**Gap**: No minting page, no XRPL integration

---

## Data Pipeline

### Structure (`data-pipeline/`)

**Collectors** (`collector/`):
- `ftso_history.py` - FTSO price history
- `fassets_redemptions.py` - FAssets redemption events
- `fdc_attestations.py` - FDC attestation data

**Ingest** (`ingest/`):
- `flare_rpc.go` - Flare RPC client
- `ftso_feeds.go` - FTSO feed ingestion
- `fdc_attestations.go` - FDC attestation ingestion

**Storage** (`storage/`):
- Time-series database for historical analysis

**Status**: ✅ Implemented, but not actively running

---

## Deployment Status

### Coston2 Testnet Deployment

**Deployment Script**: `script/Deploy.s.sol`

**All Contracts Deployed**:
- ✅ FLIPCore
- ✅ EscrowVault
- ✅ SettlementReceipt
- ✅ LiquidityProviderRegistry
- ✅ OperatorRegistry
- ✅ PriceHedgePool
- ✅ OracleRelay
- ✅ FtsoV2Adapter

**Configuration**:
- All contracts properly configured with dependencies
- FTSO Registry: `0x3d893C53D9e8056135C26C8c638B76C8b60Df726`
- State Connector: Placeholder (not yet integrated)

**Verification**: ⚠️ Contracts not verified on explorer (API key not set)

**Documentation**: See `COSTON2_DEPLOYED_ADDRESSES.md`

---

## Known Gaps & Limitations

### Critical Gaps (Blocking Full Functionality)

#### 1. **No Actual Fund Transfers**

**Problem**: Contracts emit events but don't transfer funds

**Affected Contracts**:
- `LiquidityProviderRegistry.depositLiquidity()` - Accepts `msg.value` but doesn't store it
- `EscrowVault.createEscrow()` - Creates escrow record but doesn't receive funds
- `SettlementReceipt.redeemNow()` - Emits event but doesn't transfer funds

**Impact**: LPs can't actually provide liquidity, users can't receive funds

**Fix Required**: Implement actual fund transfers in all three contracts

---

#### 2. **No Agent Implementation**

**Problem**: No service that actually pays XRP to users

**Missing**:
- `agent/` directory doesn't exist
- No XRPL payment service
- No FDC proof submission

**Impact**: Users burn FXRP but never receive XRP

**Fix Required**: Build agent service in Go that:
- Monitors `EscrowCreated` events
- Sends XRP payments to users
- Submits FDC proofs

---

#### 3. **No FDC Integration**

**Problem**: FDC attestation functions exist but are never called

**Missing**:
- No FDC proof fetching
- No FDC proof submission
- No FDC monitoring

**Impact**: Redemptions can't finalize

**Fix Required**: Implement FDC proof flow

---

#### 4. **No Minting Flow**

**Problem**: Users can't get FXRP to use with FLIP

**Missing**:
- No minting frontend page
- No Flare AssetManager integration
- No XRPL wallet connection

**Impact**: Users can't mint FXRP, can only redeem (if they have it)

**Fix Required**: Build minting wizard with Flare FAssets integration

---

#### 5. **No XRPL Integration**

**Problem**: No way to interact with XRP Ledger

**Missing**:
- No XRPL wallet connection
- No XRPL payment monitoring
- No XRPL balance display

**Impact**: Can't show users their XRP balance or payment status

**Fix Required**: Integrate xrpl.js and Xaman SDK

---

### Non-Critical Gaps

#### 6. **Oracle Not Running as Service**

**Status**: Oracle code exists but not deployed as a service

**Fix**: Deploy oracle node as a background service

---

#### 7. **No LP Dashboard**

**Status**: No frontend for LPs to manage positions

**Fix**: Build LP dashboard page

---

#### 8. **Contracts Not Verified**

**Status**: Contracts deployed but not verified on explorer

**Fix**: Set up verification API key and verify contracts

---

## Code Statistics

### Smart Contracts

- **Total Contracts**: 9 core contracts + 8 interfaces
- **Total Lines**: ~3,500 lines of Solidity
- **Test Coverage**: ~80% (unit tests exist)
- **Gas Optimizations**: Applied (removed redundant calls)

### Frontend

- **Pages**: 3 (landing, redeem, status)
- **Components**: 11 shadcn components
- **Lines of Code**: ~1,500 lines TypeScript/TSX

### Oracle

- **Language**: Go
- **Files**: 6 Go files
- **Lines**: ~800 lines

---

## Testing Status

### Unit Tests

- ✅ FLIPCore tests
- ✅ EscrowVault tests
- ✅ SettlementReceipt tests
- ✅ LiquidityProviderRegistry tests
- ✅ DeterministicScoring tests

### Integration Tests

- ⏳ End-to-end redemption flow (partial)
- ⏳ LP matching flow (partial)
- ⏳ FDC attestation flow (not implemented)

### Testnet Deployment

- ✅ All contracts deployed
- ✅ Basic functionality verified
- ⏳ Full flow not tested

---

## Documentation Status

### Complete Documentation

- ✅ Architecture docs
- ✅ Mathematical proofs
- ✅ Whitepaper alignment
- ✅ Contract specifications
- ✅ LP guide
- ✅ Escrow model explanation

### Missing Documentation

- ⏳ Agent setup guide
- ⏳ FDC integration guide
- ⏳ Minting guide
- ⏳ End-to-end testing guide

---

## Summary

### What Works

1. ✅ **Smart Contract Architecture**: All contracts deployed and configured
2. ✅ **Redemption Request Flow**: Users can request redemptions
3. ✅ **Oracle Integration**: Oracle nodes can submit predictions
4. ✅ **Frontend UI**: Basic redemption interface works
5. ✅ **Mathematical Model**: Deterministic scoring implemented
6. ✅ **Escrow Logic**: Escrow creation and status tracking works

### What Doesn't Work

1. ❌ **Actual Fund Transfers**: Funds don't move
2. ❌ **XRP Payments**: No agent to pay users
3. ❌ **FDC Finalization**: FDC proofs never submitted
4. ❌ **Minting**: Users can't get FXRP
5. ❌ **XRPL Integration**: No XRPL connection

### Overall Assessment

**Current State**: ~60% complete

- **Architecture**: 100% ✅
- **Contracts**: 90% ✅ (logic complete, transfers missing)
- **Frontend**: 50% ⏳ (redemption works, minting missing)
- **Agent**: 0% ❌ (doesn't exist)
- **FDC Integration**: 10% ⏳ (functions exist, not called)
- **XRPL Integration**: 0% ❌ (doesn't exist)

**Next Steps**: See `IMPLEMENTATION_VS_PLAN.md` for detailed comparison and implementation plan.

---

**Last Updated**: January 2026  
**Version**: FLIP v2.0 Current State Assessment

