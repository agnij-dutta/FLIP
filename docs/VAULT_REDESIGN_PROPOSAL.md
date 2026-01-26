# BlazeFLIPVault Redesign: Using Existing BlazeSwap Liquidity

## Problem

Currently, both the LP dashboard and BlazeFLIPVault require FLR deposits:
- **LP Dashboard**: LPs deposit FLR directly to provide liquidity
- **BlazeFLIPVault**: Requires FLR deposits to provide backstop liquidity

This is inefficient because BlazeSwap already has liquidity pools (FLR/FXRP) that could be used directly.

## Solution: Capital-Efficient Backstop

### For Redemptions (FXRP → FLR)

**Current Flow:**
1. User redeems FXRP
2. EscrowVault holds FXRP
3. Vault needs FLR to send to user
4. Vault must hold FLR capital

**New Flow:**
1. User redeems FXRP
2. EscrowVault holds FXRP
3. **Vault swaps FXRP → FLR via BlazeSwap** (using existing pool liquidity)
4. Vault sends FLR to user
5. **No vault capital needed!**

### For Minting (Need FXRP)

**Current Flow:**
1. User needs FXRP
2. Vault needs FLR to swap to FXRP
3. Vault must hold FLR capital

**New Flow Options:**

**Option A: Protocol-Owned Liquidity**
- Use protocol fees/reserves to swap FLR → FXRP
- Vault routes through BlazeSwap
- No user deposits needed

**Option B: Optional Capital Mode**
- Vault can hold capital for yield optimization (deploy to FLIP)
- When capital unavailable, route through BlazeSwap using existing pools
- Best of both worlds: yield when possible, liquidity when needed

## Implementation Changes

### 1. Modify `provideBackstopLiquidity` for Redemptions

Instead of requiring FLR in vault, swap FXRP from EscrowVault:

```solidity
function provideBackstopLiquidity(
    address _asset,  // FXRP token address
    uint256 _amount,  // FLR amount needed
    uint256 _requestedHaircut
) external override onlyLPRegistry nonReentrant returns (bool success, uint256 providedAmount) {
    if (!backstopEnabled) return (false, 0);
    if (_amount > backstopMaxPerTx) return (false, 0);
    if (_requestedHaircut < minHaircut) return (false, 0);
    
    address escrow = lpRegistry.escrowVault();
    require(escrow != address(0), "BlazeFLIPVault: escrow not set");
    
    // Check if EscrowVault has FXRP we can swap
    uint256 fxrpBalance = IERC20(_asset).balanceOf(escrow);
    if (fxrpBalance == 0) {
        // Fallback: use vault capital if available
        if (address(this).balance >= _amount) {
            payable(escrow).transfer(_amount);
            return (true, _amount);
        }
        return (false, 0);
    }
    
    // Calculate how much FXRP needed to get _amount FLR
    address[] memory path = new address[](2);
    path[0] = _asset;  // FXRP
    path[1] = wcflr;   // WCFLR
    
    uint256[] memory amountsIn = blazeRouter.getAmountsIn(_amount, path);
    uint256 fxrpNeeded = amountsIn[0];
    
    // Apply slippage buffer
    uint256 fxrpWithSlippage = fxrpNeeded + (fxrpNeeded * maxSlippageBps) / 10000;
    
    if (fxrpBalance < fxrpWithSlippage) {
        // Not enough FXRP in escrow, try vault capital fallback
        if (address(this).balance >= _amount) {
            payable(escrow).transfer(_amount);
            return (true, _amount);
        }
        return (false, 0);
    }
    
    // Transfer FXRP from EscrowVault to vault (temporary)
    require(
        IERC20(_asset).transferFrom(escrow, address(this), fxrpWithSlippage),
        "BlazeFLIPVault: transfer FXRP failed"
    );
    
    // Approve router
    IERC20(_asset).approve(address(blazeRouter), fxrpWithSlippage);
    
    // Swap FXRP → FLR
    uint256 minOut = _amount - (_amount * maxSlippageBps) / 10000;
    uint256[] memory amounts = blazeRouter.swapExactTokensForETH(
        fxrpWithSlippage,
        minOut,
        path,
        escrow,  // Send FLR to EscrowVault
        block.timestamp + 300
    );
    
    uint256 flrReceived = amounts[amounts.length - 1];
    emit BackstopProvided(_asset, flrReceived, _requestedHaircut);
    return (true, flrReceived);
}
```

**Note**: This requires EscrowVault to approve the vault to spend its FXRP. We'd need to add an approval mechanism.

### 2. Modify `provideBackstopERC20Liquidity` for Minting

Use protocol reserves or optional capital:

```solidity
function provideBackstopERC20Liquidity(
    address _token,
    uint256 _amount,
    uint256 _requestedHaircut
) external override onlyLPRegistry nonReentrant returns (bool success, uint256 providedAmount) {
    if (!backstopEnabled) return (false, 0);
    if (_requestedHaircut < minHaircut) return (false, 0);
    require(_token == fxrpToken, "BlazeFLIPVault: unsupported token");
    
    address escrow = lpRegistry.escrowVault();
    require(escrow != address(0), "BlazeFLIPVault: escrow not set");
    
    // Try to use vault capital first (if available)
    address[] memory path = new address[](2);
    path[0] = wcflr;
    path[1] = fxrpToken;
    
    uint256[] memory amountsIn = blazeRouter.getAmountsIn(_amount, path);
    uint256 flrNeeded = amountsIn[0];
    uint256 flrWithSlippage = flrNeeded + (flrNeeded * maxSlippageBps) / 10000;
    
    if (address(this).balance >= flrWithSlippage && flrWithSlippage <= backstopMaxPerTx) {
        // Use vault capital
        uint256 minOut = _amount - (_amount * maxSlippageBps) / 10000;
        uint256[] memory amounts = blazeRouter.swapExactETHForTokens{value: flrWithSlippage}(
            minOut,
            path,
            escrow,
            block.timestamp + 300
        );
        uint256 fxrpReceived = amounts[amounts.length - 1];
        emit BackstopERC20Provided(_token, fxrpReceived, flrWithSlippage);
        return (true, fxrpReceived);
    }
    
    // Fallback: Could use protocol reserves or return false
    // For now, return false if no capital available
    return (false, 0);
}
```

## Benefits

1. **Capital Efficiency**: No need for large vault deposits
2. **Uses Existing Liquidity**: Leverages BlazeSwap pools
3. **Optional Yield Mode**: Vault can still hold capital for yield optimization
4. **Better UX**: Faster execution when liquidity exists

## Trade-offs

1. **Slippage**: Swaps have slippage (but we already account for this)
2. **EscrowVault Permissions**: Need approval mechanism for FXRP swaps
3. **Minting Challenge**: Still need FLR source for minting (protocol fees?)

## Recommendation

Implement **Option B (Optional Capital Mode)**:
- Vault can accept deposits for yield optimization (deploy 30% to FLIP)
- When capital unavailable, route through BlazeSwap
- Best of both worlds: yield when possible, liquidity when needed

