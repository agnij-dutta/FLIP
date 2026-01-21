# FLIP - Flare Liquidity-Optimized Interoperability Protocol

## Overview

FLIP is a **conditional settlement acceleration layer** for Flare's FAssets. It solves the speed problem (FAsset redemptions take 3-5 minutes due to FDC latency) by providing near-instant user experience while preserving Flare's trust-minimized security model.

**Key Innovation**: FLIP v2 uses an escrow-based conditional settlement model instead of prefunded insurance pools, achieving 10-20x capital efficiency.

**NOT a bridge** - it's a settlement acceleration layer using State Connector (FDC) as the final arbiter.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         ON-CHAIN LAYER (Solidity 0.8.24)            │
│  FLIPCore → EscrowVault → SettlementReceipt (NFT)   │
│  LiquidityProviderRegistry | DeterministicScoring   │
│  OperatorRegistry | PriceHedgePool | OracleRelay    │
└─────────────────────────────────────────────────────┘
         ↕ (Events & RPC)
┌─────────────────────────────────────────────────────┐
│         AGENT LAYER (Go)                            │
│  EventMonitor → PaymentProcessor → FDCSubmitter     │
└─────────────────────────────────────────────────────┘
         ↕ (XRPL RPC)
┌─────────────────────────────────────────────────────┐
│         FRONTEND (Next.js 14 + Wagmi + Viem)        │
│  Redeem | Mint | LP Dashboard | Status Tracking     │
└─────────────────────────────────────────────────────┘
```

## Project Structure

```
FLIP/
├── contracts/           # Solidity smart contracts
│   ├── FLIPCore.sol    # Main orchestration (redemptions, LP matching, FDC)
│   ├── EscrowVault.sol # Per-redemption escrows with timeout protection
│   ├── SettlementReceipt.sol # ERC-721 NFTs for redemption claims
│   ├── LiquidityProviderRegistry.sol # LP deposits and matching
│   ├── DeterministicScoring.sol # On-chain risk scoring
│   ├── OperatorRegistry.sol # Staking and slashing
│   ├── PriceHedgePool.sol # FTSO price locking
│   ├── OracleRelay.sol # Advisory predictions
│   └── interfaces/     # IFAsset, IStateConnector, FTSO interfaces
├── agent/              # Go agent service
│   ├── event_monitor.go # Listens to EscrowCreated events
│   ├── payment_processor.go # Sends XRP payments on XRPL
│   ├── fdc_submitter.go # Fetches/submits FDC proofs
│   └── config.yaml     # Runtime configuration
├── oracle/node/        # Go oracle service
│   ├── scorer.go       # Deterministic scoring
│   └── relay.go        # Submits predictions to OracleRelay
├── frontend/           # Next.js 14 + React 18
│   ├── app/            # Pages: redeem, mint, lp, status
│   └── lib/contracts.ts # Contract addresses and ABIs
├── tests/              # Foundry tests (68/68 passing)
├── script/             # Deployment scripts (Foundry)
└── docs/               # Architecture and design docs
```

## Key Technologies

- **Contracts**: Solidity 0.8.24, Foundry (Forge), Hardhat
- **Agent/Oracle**: Go 1.21+
- **Frontend**: Next.js 14, TypeScript, Tailwind, Wagmi 2.0, Viem 2.0, RainbowKit, XRPL.js
- **Testing**: Foundry (forge test)

## Deployed Addresses (Coston2 Testnet - Chain ID: 114)

| Contract | Address |
|----------|---------|
| FLIPCore | `0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15` |
| EscrowVault | `0x414319C341F9f63e92652ee5e2B1231E675F455e` |
| SettlementReceipt | `0x2FDd4bb68F88449A9Ce48689a55D442b9B247C73` |
| LiquidityProviderRegistry | `0x611054f7428B6C92AAacbDe41D62877FFEd12F84` |
| OperatorRegistry | `0x944Eaa134707bA703F11562ee39727acdF7842Fc` |
| PriceHedgePool | `0xD9DFB051c432F830BB02F9CE8eE3abBB0378a589` |
| OracleRelay | `0x4FeC52DD1b0448a946d2147d5F91A925a5C6C8BA` |
| FtsoV2Adapter | `0xbb1cBE0a82B0D71D40F0339e7a05baf424aE1392` |
| FXRP (Asset) | `0x0b6A3645c240605887a5532109323A3E12273dc7` |

## Redemption Flow

1. User calls `FLIPCore.requestRedemption(amount, asset, xrplAddress)`
2. Oracle calculates deterministic score, submits prediction if >= 99.7%
3. Operator calls `finalizeProvisional()` → LP matched → Escrow created
4. Agent listens to `EscrowCreated` event
5. Agent sends XRP payment to user's XRPL address
6. Agent fetches FDC proof and calls `handleFDCAttestation()`
7. FDC verified → Escrow released
8. User redeems NFT receipt (`redeemNow()` or `redeemAfterFDC()`)

## Common Commands

```bash
# Build contracts
forge build

# Run tests
forge test

# Run specific test
forge test --match-test testFunctionName -vvv

# Deploy to Coston2
forge script script/Deploy.s.sol --rpc-url https://coston2-api.flare.network/ext/C/rpc --broadcast

# Start agent
cd agent && ./flip-agent

# Start frontend
cd frontend && npm run dev
```

## Environment Variables

Agent requires in `agent/config.yaml`:
- Flare RPC URL
- XRPL websocket URL
- Private keys for signing
- Contract addresses

Frontend requires:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

## Key Design Decisions

1. **Escrow-based vs Prefunded Insurance**: Per-redemption escrows are 10-20x more capital efficient
2. **Deterministic Scoring vs ML**: On-chain transparent scoring with formula: `Score = BaseScore × Stability × Amount × Time × Agent`
3. **State Connector as Final Arbiter**: Oracle predictions are advisory-only; FDC decides escrow release
4. **Market-based LPs**: LPs set their own haircut rates and compete for redemptions
5. **600-second Timeout**: Prevents indefinite locks; worst case is bounded delay, not insolvency

## Important Files to Understand

- `contracts/FLIPCore.sol` - Core logic, start here
- `contracts/EscrowVault.sol` - How escrows work
- `agent/event_monitor.go` - How agent processes events
- `frontend/lib/contracts.ts` - All contract interfaces
- `COSTON2_DEPLOYED_ADDRESSES.md` - Current deployment
- `docs/ESCROW_MODEL.md` - Escrow architecture details
- `docs/MATHEMATICAL_PROOFS.md` - Formal guarantees

## Current Status

- **Branch**: `integration`
- **Test Coverage**: 100% (68/68 tests passing)
- **Network**: Deployed on Coston2 testnet
- **Status**: Production ready (v2.0)
