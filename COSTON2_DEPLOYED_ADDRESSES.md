# Coston2 Deployed Contract Addresses

**Deployment Date**: 2026-01-20

## Core Contracts

- **FLIPCore**: `0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15`
- **EscrowVault**: `0x414319C341F9f63e92652ee5e2B1231E675F455e`
- **SettlementReceipt**: `0x2FDd4bb68F88449A9Ce48689a55D442b9B247C73`
- **LiquidityProviderRegistry**: `0x611054f7428B6C92AAacbDe41D62877FFEd12F84`
- **OperatorRegistry**: `0x944Eaa134707bA703F11562ee39727acdF7842Fc`
- **PriceHedgePool**: `0xD9DFB051c432F830BB02F9CE8eE3abBB0378a589`
- **OracleRelay**: `0x4FeC52DD1b0448a946d2147d5F91A925a5C6C8BA`
- **FtsoV2Adapter**: `0xbb1cBE0a82B0D71D40F0339e7a05baf424aE1392`

## Network

- **Chain ID**: 114 (Coston2 Testnet)
- **RPC URL**: https://coston2-api.flare.network/ext/C/rpc
- **Explorer**: https://coston2-explorer.flare.network

## Notes

- FLIPCore has been modified to allow owner to process redemptions without operator status
- Use `ownerProcessRedemption()` function for testing
- All config files have been updated with these addresses
