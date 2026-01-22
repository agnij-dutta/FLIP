# FLIP Protocol - Documentation Index

**Last Updated**: January 2026

This index provides a complete map of all FLIP Protocol documentation, organized by category and purpose.

---

## Master Documents

These are the primary documents that provide comprehensive overviews:

1. **[Implementation Checkpoint](IMPLEMENTATION_CHECKPOINT.md)** ⭐
   - **Purpose**: Comprehensive checkpoint of current implementation
   - **Contents**: Cross-references with plans, architecture overview, contract details, frontend status, agent service, testing status, deployment status, known gaps
   - **Audience**: Developers, auditors, stakeholders
   - **Status**: ✅ Complete

2. **[Architecture](architecture.md)**
   - **Purpose**: Complete system architecture and design
   - **Contents**: System layers, flows, component interactions, safety mechanisms
   - **Audience**: Developers, architects
   - **Status**: ✅ Complete

3. **[Deployment Guide](DEPLOYMENT.md)**
   - **Purpose**: Complete deployment and setup instructions
   - **Contents**: Prerequisites, contract deployment, configuration, agent setup, frontend setup, LP setup, verification, troubleshooting
   - **Audience**: DevOps, developers
   - **Status**: ✅ Complete

---

## Core Protocol Documentation

### Escrow Model

- **[Escrow Model](ESCROW_MODEL.md)**
  - **Purpose**: Explains the escrow-based conditional settlement model
  - **Contents**: Architecture, flows, key differences from v1, safety mechanisms
  - **Audience**: Developers, users, LPs

### Liquidity Providers

- **[Liquidity Provider Guide](LIQUIDITY_PROVIDER_GUIDE.md)**
  - **Purpose**: How to become an LP and earn fees
  - **Contents**: LP registration, matching, settlement, API reference, examples
  - **Audience**: Potential LPs, developers

### Mathematical Foundation

- **[Mathematical Proofs](MATHEMATICAL_PROOFS.md)**
  - **Purpose**: Complete theoretical foundation
  - **Contents**: H ≥ r·T clearing condition, escrow safety, timeout guarantees
  - **Audience**: Researchers, auditors, developers

- **[Mathematical Model](MATHEMATICAL_MODEL.md)**
  - **Purpose**: Mathematical model of the protocol
  - **Contents**: Formulas, equations, invariants
  - **Audience**: Researchers, developers

### Safety & Security

- **[Worst-Case Scenarios](WORST_CASE_SCENARIOS.md)**
  - **Purpose**: Safety analysis and edge cases
  - **Contents**: Failure modes, mitigation strategies, guarantees
  - **Audience**: Auditors, developers, stakeholders

- **[Pause Functionality](PAUSE_FUNCTIONALITY.md)**
  - **Purpose**: Emergency pause mechanism
  - **Contents**: How pause works, when to use it, recovery procedures
  - **Audience**: Operators, developers

- **[Security Audit Plan](security-audit-plan.md)**
  - **Purpose**: Security audit requirements
  - **Contents**: Audit scope, checklist, requirements
  - **Audience**: Auditors, developers

---

## Technical Specifications

### Contract Specifications

- **[Contract Specifications](contract-specs.md)**
  - **Purpose**: All contract interfaces and ABIs
  - **Contents**: Function signatures, events, data structures
  - **Audience**: Developers

### Integration Specifications

- **[FTSO Integration](ftso-spec.md)**
  - **Purpose**: Flare FTSO price feed integration
  - **Contents**: FTSO interface, integration details
  - **Audience**: Developers

- **[FDC Integration](fdc-spec.md)**
  - **Purpose**: Flare State Connector integration
  - **Contents**: FDC interface, proof flow, integration details
  - **Audience**: Developers

- **[FAssets Integration](fassets-spec.md)**
  - **Purpose**: Flare FAssets integration
  - **Contents**: FAssets interface, minting flow, integration details
  - **Audience**: Developers

- **[Flare Integration Notes](FLARE_INTEGRATION_NOTES.md)**
  - **Purpose**: Notes on Flare network integration
  - **Contents**: Network configuration, contract addresses, integration tips
  - **Audience**: Developers

---

## Setup & Testing

### Quick Start

- **[Quick Start](../QUICK_START.md)** (root)
  - **Purpose**: 5-minute test setup
  - **Contents**: Prerequisites, quick test steps, common issues
  - **Audience**: Developers, testers

### Setup Guides

- **[Run Instructions](../RUN_INSTRUCTIONS.md)** (root)
  - **Purpose**: Complete step-by-step guide
  - **Contents**: Full setup, running the flow, verification
  - **Audience**: Developers, testers

- **[Frontend Setup](../FRONTEND_SETUP.md)** (root)
  - **Purpose**: Frontend development setup
  - **Contents**: Installation, configuration, development
  - **Audience**: Frontend developers

- **[Deployment Guide](DEPLOYMENT.md)**
  - **Purpose**: Deployment and configuration
  - **Contents**: Contract deployment, agent setup, LP setup, verification
  - **Audience**: DevOps, developers

### Testing

- **[Testing Guide](../TESTING_GUIDE.md)** (root)
  - **Purpose**: Comprehensive testing procedures
  - **Contents**: Test structure, running tests, test coverage, E2E testing
  - **Audience**: Developers, QA

---

## Reference

### Deployment

- **[Deployed Addresses](../COSTON2_DEPLOYED_ADDRESSES.md)** (root)
  - **Purpose**: Current Coston2 deployment addresses
  - **Contents**: All contract addresses, network info, notes
  - **Audience**: Developers, users

- **[Flare Contract Addresses](FLARE_CONTRACT_ADDRESSES.md)**
  - **Purpose**: Flare network contract addresses
  - **Contents**: FTSO, FDC, FAssets addresses
  - **Audience**: Developers

### Network Configuration

- **[Network Configuration](network-config.md)**
  - **Purpose**: Network configuration details
  - **Contents**: RPC URLs, chain IDs, explorer links
  - **Audience**: Developers

---

## Implementation Status

### Status Documents

- **[Implementation Checkpoint](IMPLEMENTATION_CHECKPOINT.md)** ⭐
  - **Purpose**: Current implementation status
  - **Contents**: Complete status, gaps, next steps
  - **Audience**: All

- **[Current Implementation Map](CURRENT_IMPLEMENTATION_MAP.md)**
  - **Purpose**: Detailed implementation map
  - **Contents**: Code structure, contracts, frontend, gaps
  - **Audience**: Developers

- **[Implementation Status Summary](IMPLEMENTATION_STATUS_SUMMARY.md)**
  - **Purpose**: Quick status summary
  - **Contents**: Current vs target, gaps, plan summary
  - **Audience**: Stakeholders, developers

- **[Implementation vs Plan](IMPLEMENTATION_VS_PLAN.md)**
  - **Purpose**: Comparison with plans
  - **Contents**: Current vs new implementation, gaps
  - **Audience**: Developers, stakeholders

### Project Status

- **[Project Status](../PROJECT_STATUS.md)** (root)
  - **Purpose**: Overall project status
  - **Contents**: Completion breakdown, milestones, features
  - **Audience**: Stakeholders

---

## Development & Research

### MVP Documentation

- **[MVP Implementation Notes](MVP_IMPLEMENTATION_NOTES.md)**
  - **Purpose**: MVP implementation details
  - **Contents**: MVP approach, decisions, trade-offs
  - **Audience**: Developers

- **[MVP No ML](MVP_NO_ML.md)**
  - **Purpose**: MVP without ML
  - **Contents**: Deterministic scoring approach
  - **Audience**: Developers

### Whitepaper Alignment

- **[Whitepaper Alignment](../WHITEPAPER_ALIGNMENT.md)** (root)
  - **Purpose**: Alignment with whitepaper
  - **Contents**: Comparison, alignment score, gaps
  - **Audience**: Stakeholders, researchers

- **[Whitepaper Iteration](WHITEPAPER_ITERATION.md)**
  - **Purpose**: Whitepaper updates needed
  - **Contents**: New sections, updates, additions
  - **Audience**: Researchers, writers

- **[Whitepaper MVP Alignment](WHITEPAPER_MVP_ALIGNMENT.md)**
  - **Purpose**: MVP alignment with whitepaper
  - **Contents**: MVP features, alignment
  - **Audience**: Stakeholders

### Data & Research

- **[Data Collection Notes](DATA_COLLECTION_NOTES.md)**
  - **Purpose**: Data collection approach
  - **Contents**: Data sources, collection methods
  - **Audience**: Data scientists, developers

- **[FDC Enhanced Setup](FDC_ENHANCED_SETUP.md)**
  - **Purpose**: Enhanced FDC setup
  - **Contents**: Advanced FDC configuration
  - **Audience**: Developers

- **[FDC Limitations](FDC_LIMITATIONS.md)**
  - **Purpose**: FDC limitations and workarounds
  - **Contents**: Known limitations, solutions
  - **Audience**: Developers

---

## Legacy Documentation

These documents are kept for reference but may be outdated:

- **[Mathematical Model Old](MATHEMATICAL_MODEL_OLD.md)** - Old version of mathematical model
- **[Launchpad Ready Summary](LAUNCHPAD_READY_SUMMARY.md)** - Launchpad submission summary

---

## Documentation by Audience

### For Developers

**Start Here**:
1. [Implementation Checkpoint](IMPLEMENTATION_CHECKPOINT.md)
2. [Architecture](architecture.md)
3. [Deployment Guide](DEPLOYMENT.md)
4. [Contract Specifications](contract-specs.md)

**Then Read**:
- [Escrow Model](ESCROW_MODEL.md)
- [Liquidity Provider Guide](LIQUIDITY_PROVIDER_GUIDE.md)
- [Testing Guide](../TESTING_GUIDE.md)
- [FDC Integration](fdc-spec.md)
- [FTSO Integration](ftso-spec.md)

### For Users

**Start Here**:
1. [README](../README.md) (root)
2. [Quick Start](../QUICK_START.md) (root)
3. [Liquidity Provider Guide](LIQUIDITY_PROVIDER_GUIDE.md) (if becoming an LP)

### For Auditors

**Start Here**:
1. [Implementation Checkpoint](IMPLEMENTATION_CHECKPOINT.md)
2. [Architecture](architecture.md)
3. [Security Audit Plan](security-audit-plan.md)
4. [Mathematical Proofs](MATHEMATICAL_PROOFS.md)
5. [Worst-Case Scenarios](WORST_CASE_SCENARIOS.md)

### For Stakeholders

**Start Here**:
1. [README](../README.md) (root)
2. [Implementation Checkpoint](IMPLEMENTATION_CHECKPOINT.md)
3. [Project Status](../PROJECT_STATUS.md) (root)
4. [Whitepaper Alignment](../WHITEPAPER_ALIGNMENT.md) (root)

---

## Documentation Maintenance

### Last Updated

- **Implementation Checkpoint**: January 2026
- **Architecture**: January 2026
- **Deployment Guide**: January 2026
- **Most Other Docs**: January 2026

### Update Frequency

- **Master Documents**: Updated after major milestones
- **Implementation Status**: Updated after each deployment
- **Deployed Addresses**: Updated after each deployment
- **Technical Specs**: Updated when contracts change

---

## Quick Links

### Most Important Documents

1. ⭐ **[Implementation Checkpoint](IMPLEMENTATION_CHECKPOINT.md)** - Current state
2. ⭐ **[Architecture](architecture.md)** - System design
3. ⭐ **[Deployment Guide](DEPLOYMENT.md)** - How to deploy
4. **[Quick Start](../QUICK_START.md)** - Get started quickly
5. **[Deployed Addresses](../COSTON2_DEPLOYED_ADDRESSES.md)** - Current addresses

### By Topic

- **Architecture**: [Architecture](architecture.md), [Escrow Model](ESCROW_MODEL.md)
- **Deployment**: [Deployment Guide](DEPLOYMENT.md), [Run Instructions](../RUN_INSTRUCTIONS.md)
- **Testing**: [Testing Guide](../TESTING_GUIDE.md)
- **LPs**: [Liquidity Provider Guide](LIQUIDITY_PROVIDER_GUIDE.md)
- **Math**: [Mathematical Proofs](MATHEMATICAL_PROOFS.md), [Mathematical Model](MATHEMATICAL_MODEL.md)
- **Security**: [Security Audit Plan](security-audit-plan.md), [Worst-Case Scenarios](WORST_CASE_SCENARIOS.md)

---

**Last Updated**: January 2026  
**Maintained By**: FLIP Protocol Team

