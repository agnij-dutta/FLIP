# Coston2 Deployed Contract Addresses

**Deployment Date**: 2026-01-23
**Version**: FLIP v5 (BlazeSwap Backstop)

## Core Contracts

- **FLIPCore**: `0x5743737990221c92769D3eF641de7B633cd0E519`
- **EscrowVault**: `0xF3995d7766D807EFeE60769D45973FfC176E1b0c`
- **SettlementReceipt**: `0x159dCc41173bFA5924DdBbaAf14615E66aa7c6Ec`
- **LiquidityProviderRegistry**: `0xbc8423cd34653b1D64a8B54C4D597d90C4CEe100`
- **OperatorRegistry**: `0x1e6DDfcA83c483c79C82230Ea923C57c1ef1A626`
- **PriceHedgePool**: `0x4d4B47B0EA1Ca02Cc382Ace577A20580864a24e2`
- **OracleRelay**: `0x4FcF689B7E70ad80714cA7e977Eb9de85064759d`
- **FtsoV2Adapter**: `0x82B8723D957Eb2a2C214637552255Ded46e2664D`

## BlazeSwap Backstop

- **BlazeFLIPVault**: `0x678D95C2d75289D4860cdA67758CB9BFdac88611`
- **BlazeSwap Router**: `0x8D29b61C41CF318d15d031BE2928F79630e068e6`
- **WCFLR**: `0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273`

## Tokens

- **FXRP**: `0x0b6A3645c240605887a5532109323A3E12273dc7` (FAsset from Asset Manager)

## Vault State (at deployment)

- Initial Deposit: 100 C2FLR
- Deployed to FLIP: 30 C2FLR (30% allocation)
- Idle Balance: 70 C2FLR
- Backstop: Active
- Deposit Lockup: 5 min (testnet)
- Max Slippage: 1%
- Max Per Tx: 50 FLR

## Network

- **Chain ID**: 114 (Coston2 Testnet)
- **RPC URL**: https://coston2-api.flare.network/ext/C/rpc
- **Explorer**: https://coston2-explorer.flare.network

## Integration Wiring

- `LPRegistry.backstopVault()` → BlazeFLIPVault
- `LPRegistry.escrowVault()` → EscrowVault
- `LPRegistry.flipCore()` → FLIPCore
- `BlazeFLIPVault.fxrpToken()` → FXRP (real FAsset)
- `BlazeFLIPVault.blazeRouter()` → BlazeSwap Router
- `EscrowVault.flipCore()` → FLIPCore
- `SettlementReceipt.flipCore()` → FLIPCore

## Notes

- FLIPCore allows owner to process redemptions via `ownerProcessRedemption()` for testing
- LPRegistry has backstop fallback: when no direct LP matches, BlazeFLIPVault provides JIT liquidity
- BlazeFLIPVault uses BlazeSwap for FLR→FXRP swaps when ERC20 backstop is needed
- All config files and frontend updated with these addresses

## Previous Deployments

- **v4** (2026-01-21): `FLIPCore: 0x06A84C4e441eDF8B8E1895d3166d140760FF2a39` (no backstop)
- **v3** (2026-01-20): `FLIPCore: 0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15` (initial escrow model)
