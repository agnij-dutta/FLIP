# Security Audit Plan

Scope:
- Smart contracts: FLIPCore, InsurancePool, PriceHedgePool, OperatorRegistry, OracleRelay, interfaces
- Oracle node: signing, replay protection, endpoint auth
- Data pipeline: integrity of ingested feeds (FTSO/FDC), storage permissions
- Economic risks: insurance solvency, slashing correctness

Targets:
- External audit firms: Trail of Bits / OpenZeppelin / Spearbit (shortlist)
- Static analysis: Slither, Foundry fuzz, Echidna
- Property tests: invariants for pool solvency, no-free-lunch payouts
- Upgradeability/governance: multisig/DAO controls, pause logic

Artifacts needed:
- Specs: `docs/contract-specs.md`, architecture diagrams
- Threat model: oracle manipulation, replay, drift, insolvency, pausing misuse
- Test coverage reports (unit/integration/fuzz)

Timeline:
- Pre-audit: finalize specs, threat model, tests
- Audit window: 2-3 weeks
- Remediation: 1 week
- Re-test: 1 week
