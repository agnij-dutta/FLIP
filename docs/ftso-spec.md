# FTSOv2 Interface (IFtso, IFtsoRegistry)

Key functions:
- `getCurrentPrice() -> (uint256 price, uint256 timestamp)`
- `getPrice(uint256 epochId) -> (uint256 price, uint256 timestamp)`
- `getPriceFromTrustedProviders(uint256 epochId) -> uint256 price`
- Registry: `getFtsoBySymbol(string symbol) -> address`
- Registry: `getCurrentPriceWithDecimals(string symbol) -> (uint256 price, uint256 timestamp)`

Notes:
- Block-latency feeds update every ~1.8 seconds (per block)
- ~100 independent providers, VRF-based selection
- Incremental delta updates with 1/2^18 precision
- Scaling feeds (90s epochs) for anchoring/validation
- Volatility incentive mechanism during high volatility
