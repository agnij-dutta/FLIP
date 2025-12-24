# FAssets Interface (IFAsset, IAgentVault)

FAsset (simplified):
- `requestRedemption(uint256 amount) returns (uint256 redemptionId)`
- `getRedemption(uint256 redemptionId) -> (address agent, uint256 amount, uint256 startTime)`
- `burn(uint256 amount)`

Agent Vault (conceptual hooks to monitor collateral/health):
- Collateral ratios and liquidation thresholds (refer to FAssets docs)
- Events to track agent performance and liquidations

Integration Notes:
- Redemption events: `RedemptionRequested`, `RedemptionCompleted`, `RedemptionFailed`
- Monitor agent performance for ML features and risk flags
- Assets: FXRP, FBTC, FDOGE (extendable)
