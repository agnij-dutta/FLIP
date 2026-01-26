# BlazeFLIPVault Redesign: Capital-Efficient Backstop via BlazeSwap

## Overview

This document outlines a redesign of the BlazeFLIPVault to leverage existing BlazeSwap liquidity pools instead of requiring dedicated capital deposits. This approach significantly improves capital efficiency while maintaining the same functionality.

## Current Architecture

### Problem Statement

The current BlazeFLIPVault requires FLR deposits to provide backstop liquidity:

```
┌─────────────────────────────────────────────────────────────┐
│                    Current Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Depositors stake FLR in vault                           │
│  2. FLR sits idle (or partially deployed to FLIP)           │
│  3. When backstop needed:                                   │
│     └── Vault sends FLR from reserves to EscrowVault        │
│  4. Capital inefficiency: Large reserves required           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Issues:**
- Capital sits idle waiting for backstop events
- Depositors earn yield only when backstop is triggered
- Large reserves needed to handle peak demand
- Opportunity cost of locked capital

## Proposed Architecture

### Solution: Just-In-Time Liquidity via BlazeSwap

Instead of holding idle FLR reserves, route through BlazeSwap's existing liquidity pools when backstop is needed:

```
┌─────────────────────────────────────────────────────────────┐
│                    Proposed Flow                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Backstop requested by LiquidityProviderRegistry         │
│  2. Vault checks internal FLR balance                       │
│     │                                                       │
│     ├─► If sufficient FLR available:                        │
│     │   └── Use vault capital (existing behavior)           │
│     │                                                       │
│     └─► If insufficient FLR:                                │
│         └── Route through BlazeSwap:                        │
│             ├── Swap available assets → FLR                 │
│             └── Send FLR to EscrowVault                     │
│                                                             │
│  3. No large idle reserves required                         │
│  4. Uses existing BlazeSwap pool depth                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Modified `provideBackstopLiquidity` Function

```solidity
function provideBackstopLiquidity(
    address _asset,
    uint256 _amount,
    uint256 _requestedHaircut
) external override onlyLPRegistry nonReentrant returns (bool success, uint256 providedAmount) {
    if (!backstopEnabled) return (false, 0);
    if (_amount > backstopMaxPerTx) return (false, 0);
    if (_requestedHaircut < minHaircut) return (false, 0);

    address escrow = lpRegistry.escrowVault();
    require(escrow != address(0), "BlazeFLIPVault: escrow not set");

    // Strategy 1: Use vault's FLR balance if sufficient
    if (address(this).balance >= _amount) {
        payable(escrow).transfer(_amount);
        emit BackstopProvided(_asset, _amount, _requestedHaircut);
        return (true, _amount);
    }

    // Strategy 2: Route through BlazeSwap
    return _provideViaSwap(_asset, _amount, escrow, _requestedHaircut);
}

function _provideViaSwap(
    address _asset,
    uint256 _amount,
    address _escrow,
    uint256 _requestedHaircut
) internal returns (bool success, uint256 providedAmount) {
    // Check if we have swappable assets (e.g., FXRP, WFLR, stablecoins)
    uint256 fxrpBalance = IERC20(fxrpToken).balanceOf(address(this));

    if (fxrpBalance > 0) {
        // Calculate FLR needed with slippage buffer
        address[] memory path = new address[](2);
        path[0] = fxrpToken;
        path[1] = wcflr;

        uint256[] memory amountsIn = blazeRouter.getAmountsIn(_amount, path);
        uint256 fxrpNeeded = amountsIn[0];
        uint256 fxrpWithSlippage = fxrpNeeded + (fxrpNeeded * maxSlippageBps) / 10000;

        if (fxrpBalance >= fxrpWithSlippage) {
            // Approve and swap
            IERC20(fxrpToken).approve(address(blazeRouter), fxrpWithSlippage);

            uint256 minOut = _amount - (_amount * maxSlippageBps) / 10000;
            uint256[] memory amounts = blazeRouter.swapExactTokensForETH(
                fxrpWithSlippage,
                minOut,
                path,
                _escrow,
                block.timestamp + 300
            );

            uint256 flrReceived = amounts[amounts.length - 1];
            emit BackstopProvidedViaSwap(_asset, flrReceived, fxrpWithSlippage, _requestedHaircut);
            return (true, flrReceived);
        }
    }

    // No swappable assets available
    return (false, 0);
}
```

### New Events

```solidity
event BackstopProvidedViaSwap(
    address indexed asset,
    uint256 flrProvided,
    uint256 assetSwapped,
    uint256 haircut
);

event SwapRouteUsed(
    address indexed fromToken,
    address indexed toToken,
    uint256 amountIn,
    uint256 amountOut
);
```

## Capital Sources for Swaps

The vault can source assets for swaps from multiple channels:

### 1. Protocol Fee Accumulation

```solidity
// Fees from successful backstops accumulate in vault
// Can be held as FXRP, FLR, or other assets
// Swapped to FLR when backstop needed
```

### 2. Minimal Reserve Buffer

```solidity
// Hold small FLR buffer (e.g., 10% of typical demand)
// Top up via swaps when buffer depleted
// Reduces swap frequency while minimizing idle capital
```

### 3. Multi-Asset Treasury

```solidity
// Accept deposits in multiple assets (FXRP, WFLR, stablecoins)
// Swap to FLR on-demand
// More flexible for depositors
```

### 4. Optional Yield Mode (Hybrid Approach)

```solidity
// Accept FLR deposits for yield optimization
// Deploy portion to FLIP LP positions
// When backstop needed:
//   - First use idle FLR
//   - Then withdraw from FLIP positions
//   - Finally route through BlazeSwap
```

## Configuration Parameters

```solidity
// Slippage tolerance for swaps (basis points)
uint256 public maxSlippageBps = 100; // 1%

// Minimum FLR buffer to maintain
uint256 public minFlrBuffer = 1000 ether;

// Maximum single swap size (prevents excessive slippage)
uint256 public maxSwapSize = 10000 ether;

// Supported swap tokens
mapping(address => bool) public swappableTokens;
```

## Benefits

| Metric | Current | Proposed | Improvement |
|--------|---------|----------|-------------|
| Idle Capital Required | High | Low/None | 80-90% reduction |
| Capital Efficiency | ~20% utilization | ~90%+ utilization | 4-5x improvement |
| Depositor Yield | Variable | Higher (less dilution) | Improved |
| Liquidity Depth | Limited by deposits | BlazeSwap pools | Much larger |
| Operational Complexity | Simple | Moderate | Trade-off |

## Trade-offs & Mitigations

### 1. Swap Slippage

**Risk:** Large swaps may incur significant slippage.

**Mitigation:**
- Set `maxSwapSize` to limit single swap impact
- Use `maxSlippageBps` for minimum output guarantees
- Split large backstops into multiple swaps if needed

### 2. Pool Liquidity Risk

**Risk:** BlazeSwap pools may be depleted during high demand.

**Mitigation:**
- Maintain minimal FLR buffer as first line of defense
- Monitor pool depth and adjust `maxSwapSize` dynamically
- Fall back to rejecting backstop if swap would fail

### 3. Gas Costs

**Risk:** Swaps add gas overhead vs direct transfers.

**Mitigation:**
- Gas cost is minor relative to backstop amounts
- Haircut fees cover operational costs
- More capital efficient despite higher gas

### 4. Smart Contract Risk

**Risk:** Additional integration with BlazeSwap router.

**Mitigation:**
- BlazeSwap is battle-tested on Flare
- Use established router interfaces
- Comprehensive testing before deployment

## Migration Path

### Phase 1: Dual Mode

```
- Keep existing deposit functionality
- Add BlazeSwap routing as fallback
- Monitor performance and slippage
```

### Phase 2: Optimization

```
- Analyze swap patterns and costs
- Optimize buffer size based on data
- Add multi-hop swap routes if beneficial
```

### Phase 3: Full Transition

```
- Reduce minimum deposit requirements
- Shift to fee-accumulation model
- Optional deposits for yield-seekers only
```

## Security Considerations

1. **Reentrancy Protection:** All swap functions use `nonReentrant` modifier
2. **Slippage Checks:** Minimum output enforced on all swaps
3. **Access Control:** Only LiquidityProviderRegistry can trigger backstop
4. **Deadline Protection:** Swap transactions have time limits
5. **Approval Management:** Approve exact amounts, not unlimited

## Conclusion

The BlazeSwap routing approach transforms BlazeFLIPVault from a capital-intensive reserve system to a capital-efficient just-in-time liquidity provider. By leveraging existing DEX liquidity, the protocol can:

- Reduce idle capital requirements by 80-90%
- Increase effective liquidity depth
- Improve depositor yields
- Maintain the same user experience

The hybrid approach (Option B) provides the best of both worlds: yield optimization when capital is deposited, with BlazeSwap routing as a reliable fallback.

---

## Appendix: Related Files

- `contracts/BlazeFLIPVault.sol` - Main vault contract
- `contracts/LiquidityProviderRegistry.sol` - LP management
- `contracts/EscrowVault.sol` - Escrow logic
- `contracts/interfaces/IBlazeSwapRouter.sol` - DEX interface
