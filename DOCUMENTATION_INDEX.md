# FLIP v2 Documentation Index

## Overview

This index provides quick access to all FLIP v2 documentation, organized by topic.

---

## 📚 Core Documentation

### Architecture & Design
- **`docs/architecture.md`** - System architecture (v2 escrow-based model)
- **`docs/ESCROW_MODEL.md`** - Escrow flow and mechanics
- **`docs/LIQUIDITY_PROVIDER_GUIDE.md`** - LP strategy and API guide
- **`WHITEPAPER_ALIGNMENT.md`** - Detailed whitepaper alignment analysis

### Mathematical Model
- **`docs/MATHEMATICAL_MODEL.md`** - Deterministic scoring model
- **`docs/MVP_IMPLEMENTATION_NOTES.md`** - MVP vs full implementation differences
- **`docs/WHITEPAPER_MVP_ALIGNMENT.md`** - Quick reference for alignment

### Implementation Status
- **`PROJECT_STATUS.md`** - Overall project completion status
- **`WHITEPAPER_ALIGNMENT.md`** - Mathematical guarantees alignment

---

## 🔍 Quick Reference

### For Developers
1. **Architecture**: `docs/architecture.md`
2. **Contracts**: `contracts/` directory
3. **Tests**: `tests/` directory
4. **Deployment**: `scripts/deploy-*.sh`

### For LPs
1. **LP Guide**: `docs/LIQUIDITY_PROVIDER_GUIDE.md`
2. **API Reference**: See guide for contract interfaces

### For Researchers
1. **Mathematical Model**: `docs/MATHEMATICAL_MODEL.md`
2. **Whitepaper Alignment**: `WHITEPAPER_ALIGNMENT.md`
3. **MVP Notes**: `docs/MVP_IMPLEMENTATION_NOTES.md`

---

## 📋 Key Documents by Topic

### Understanding the System
- Start here: `docs/architecture.md`
- Escrow model: `docs/ESCROW_MODEL.md`
- Mathematical model: `docs/MATHEMATICAL_MODEL.md`

### Implementation Details
- Project status: `PROJECT_STATUS.md`
- MVP notes: `docs/MVP_IMPLEMENTATION_NOTES.md`
- Whitepaper alignment: `WHITEPAPER_ALIGNMENT.md`

### User Guides
- LP guide: `docs/LIQUIDITY_PROVIDER_GUIDE.md`
- Frontend setup: `FRONTEND_SETUP.md`

### Deployment
- Coston2: `scripts/deploy-coston2.sh`
- Songbird: `scripts/deploy-songbird.sh`
- Flare: `scripts/deploy-flare.sh`

---

## 🎯 Documentation Highlights

### ✅ What's Documented
- Complete architecture (v2 escrow-based)
- Escrow flow and mechanics
- LP system and economics
- Mathematical model (deterministic scoring)
- MVP implementation notes
- Whitepaper alignment analysis

### ⚠️ Key Notes
- **MVP Implementation**: Uses conservative approximations (see `MVP_IMPLEMENTATION_NOTES.md`)
- **Theoretical Gaps**: Documented in `WHITEPAPER_ALIGNMENT.md`
- **Safety**: All safety guarantees are enforced (99.7% threshold, worst-case bounds)

---

## 📖 Reading Order

### For New Readers
1. `docs/architecture.md` - Understand the system
2. `docs/ESCROW_MODEL.md` - Understand escrow flow
3. `docs/MATHEMATICAL_MODEL.md` - Understand scoring

### For Implementers
1. `PROJECT_STATUS.md` - What's complete
2. `docs/MVP_IMPLEMENTATION_NOTES.md` - MVP vs full spec
3. `WHITEPAPER_ALIGNMENT.md` - Mathematical alignment

### For LPs
1. `docs/LIQUIDITY_PROVIDER_GUIDE.md` - Complete LP guide

---

## 🔗 Related Files

### Contracts
- `contracts/FLIPCore.sol` - Main contract
- `contracts/EscrowVault.sol` - Escrow vault
- `contracts/SettlementReceipt.sol` - Receipt NFT
- `contracts/LiquidityProviderRegistry.sol` - LP registry
- `contracts/DeterministicScoring.sol` - Scoring library

### Tests
- `tests/contracts/` - Unit tests
- `tests/integration/` - Integration tests
- `tests/stress/` - Stress tests

### Scripts
- `scripts/deploy-*.sh` - Deployment scripts
- `scripts/test-contracts.sh` - Test runner

---

## 📝 Documentation Standards

All documentation follows these principles:
1. **Clarity**: Clear explanations for technical and non-technical readers
2. **Completeness**: Cover all aspects of the system
3. **Accuracy**: Match actual implementation
4. **Transparency**: Document gaps and approximations

---

**Last Updated**: $(date)
**Version**: FLIP v2.0

