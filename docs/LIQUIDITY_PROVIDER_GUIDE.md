# Liquidity Provider Guide

## Overview

Liquidity Providers (LPs) are market participants who provide capital to enable fast-lane redemptions in FLIP. LPs earn spreads (haircuts) in exchange for providing immediate liquidity to users.

## How It Works

### 1. LP Registration

LPs deposit liquidity with specific parameters:
- **Asset**: Which FAsset to provide liquidity for (e.g., FXRP)
- **Amount**: How much capital to deposit
- **Min Haircut**: Minimum haircut LP accepts (e.g., 1% = 10000 scaled)
- **Max Delay**: Maximum delay LP tolerates before FDC (e.g., 3600 seconds = 1 hour)

### 2. LP Matching

When a user requests a fast-lane redemption:
1. FLIPCore calculates suggested haircut based on deterministic scoring
2. FLIPCore queries `lpRegistry.matchLiquidity()` to find matching LP
3. Matching criteria:
   - LP's `minHaircut <= suggestedHaircut`
   - LP's `availableAmount >= redemption amount`
   - LP's `maxDelay >= expected FDC delay`
4. If matched: LP funds escrow, user receives receipt with LP's haircut
5. If not matched: User-wait path (no LP)

### 3. Settlement and Fees

**Success Case**:
- User redeems immediately: LP receives (amount - haircut) immediately, keeps haircut as fee
- User waits for FDC: LP receives full amount after FDC success, keeps haircut as fee

**Failure Case**:
- FDC confirms failure: LP receives full amount back (no haircut earned)
- Timeout: LP receives full amount back (no haircut earned)

## LP Position Structure

```solidity
struct LPPosition {
    address lp;
    address asset;
    uint256 depositedAmount;      // Total deposited
    uint256 availableAmount;       // Currently available
    uint256 minHaircut;            // Minimum haircut (scaled: 1000000 = 100%)
    uint256 maxDelay;              // Maximum delay (seconds)
    uint256 totalEarned;            // Total haircut fees earned
    bool active;                   // Whether position is active
}
```

## API Reference

### Deposit Liquidity

```solidity
function depositLiquidity(
    address _asset,
    uint256 _amount,
    uint256 _minHaircut,
    uint256 _maxDelay
) external payable;
```

**Parameters**:
- `_asset`: FAsset contract address (e.g., FXRP)
- `_amount`: Amount to deposit (in wei)
- `_minHaircut`: Minimum haircut LP accepts (scaled: 10000 = 1%, 1000000 = 100%)
- `_maxDelay`: Maximum delay LP tolerates (seconds)

**Example**:
```solidity
// Deposit 10,000 FXRP with 1% min haircut, 1 hour max delay
lpRegistry.depositLiquidity{value: 10000 ether}(
    address(fxrp),
    10000 ether,
    10000,  // 1% = 10000 scaled
    3600    // 1 hour = 3600 seconds
);
```

### Withdraw Liquidity

```solidity
function withdrawLiquidity(
    address _asset,
    uint256 _amount
) external;
```

**Parameters**:
- `_asset`: FAsset contract address
- `_amount`: Amount to withdraw (in wei)

**Example**:
```solidity
// Withdraw 5,000 FXRP
lpRegistry.withdrawLiquidity(address(fxrp), 5000 ether);
```

### Get Position

```solidity
function getPosition(
    address _lp,
    address _asset
) external view returns (LPPosition memory);
```

**Returns**: LP position struct with all details

**Example**:
```solidity
LPPosition memory position = lpRegistry.getPosition(lpAddress, address(fxrp));
console.log("Available:", position.availableAmount);
console.log("Total Earned:", position.totalEarned);
```

## LP Strategy Guide

### 1. Haircut Strategy

**Low Haircut (0.5-1%)**:
- **Pros**: More matches, higher volume
- **Cons**: Lower per-transaction fee
- **Best For**: High-volume LPs, competitive markets

**Medium Haircut (1-2%)**:
- **Pros**: Balanced risk/reward
- **Cons**: Moderate matches
- **Best For**: Most LPs, general use

**High Haircut (2-5%)**:
- **Pros**: Higher per-transaction fee
- **Cons**: Fewer matches, may miss opportunities
- **Best For**: Risk-averse LPs, low-competition markets

### 2. Delay Strategy

**Short Delay (1-2 hours)**:
- **Pros**: Faster capital turnover
- **Cons**: Higher risk of timeout
- **Best For**: Active LPs, high-confidence markets

**Medium Delay (2-6 hours)**:
- **Pros**: Balanced risk/reward
- **Cons**: Moderate capital efficiency
- **Best For**: Most LPs, general use

**Long Delay (6-24 hours)**:
- **Pros**: Lower timeout risk
- **Cons**: Slower capital turnover
- **Best For**: Conservative LPs, uncertain markets

### 3. Amount Strategy

**Small Amount (< 10,000 tokens)**:
- **Pros**: Lower risk per transaction
- **Cons**: Lower total fees
- **Best For**: New LPs, testing

**Medium Amount (10,000-100,000 tokens)**:
- **Pros**: Balanced risk/reward
- **Cons**: Moderate capital requirements
- **Best For**: Most LPs, general use

**Large Amount (> 100,000 tokens)**:
- **Pros**: Higher total fees
- **Cons**: Higher risk per transaction
- **Best For**: Experienced LPs, high-confidence markets

## Risk Management

### 1. FDC Failure Risk

**Risk**: FDC confirms redemption failure → LP loses haircut fee, capital returned

**Mitigation**:
- Monitor FDC success rates
- Adjust haircut to compensate for failure risk
- Diversify across multiple assets

### 2. Timeout Risk

**Risk**: FDC doesn't attest within timeout → LP capital locked, no fee earned

**Mitigation**:
- Set `maxDelay` appropriately
- Monitor FDC attestation times
- Withdraw if delays become excessive

### 3. Capital Efficiency Risk

**Risk**: Capital sits idle if no matches

**Mitigation**:
- Monitor match rates
- Adjust parameters to increase matches
- Consider multiple assets

### 4. Haircut Mispricing Risk

**Risk**: Haircut too low → insufficient compensation for risk

**Mitigation**:
- Monitor historical success rates
- Adjust haircut based on market conditions
- Use deterministic scoring insights

## LP Economics

### Revenue Model

**Revenue = Haircut Fees Earned**

**Example**:
- LP deposits: 10,000 FXRP
- Haircut: 1% (100 FXRP per 10,000 FXRP redemption)
- Matches per day: 10
- Daily revenue: 10 × 100 = 1,000 FXRP
- Annual revenue: 365 × 1,000 = 365,000 FXRP
- **APY**: 3,650% (assuming 100% match rate, no failures)

**Note**: Actual APY depends on:
- Match rate (not all redemptions match)
- Failure rate (failed redemptions don't earn fees)
- Capital efficiency (idle capital reduces APY)

### Cost Model

**Costs**:
- **Capital Opportunity Cost**: Capital could be used elsewhere
- **Gas Costs**: Deposit/withdraw transactions
- **Risk**: FDC failures, timeouts

### Break-Even Analysis

**Minimum Haircut**:
```
Min Haircut = (Failure Rate × Loss) + (Timeout Rate × Opportunity Cost) + Gas Costs
```

**Example**:
- Failure Rate: 1%
- Loss per failure: 0% (capital returned)
- Timeout Rate: 5%
- Opportunity Cost: 0.1% per hour
- Gas Costs: 0.01%

**Min Haircut** ≈ 0.5% (5000 scaled)

## Best Practices

### 1. Start Small

- Begin with small amounts to test strategy
- Monitor match rates and fees
- Adjust parameters based on results

### 2. Monitor Performance

- Track match rates
- Monitor FDC success rates
- Calculate actual APY

### 3. Diversify

- Provide liquidity for multiple assets
- Spread risk across different parameters
- Don't put all capital in one position

### 4. Stay Active

- Monitor market conditions
- Adjust parameters as needed
- Withdraw if conditions change

### 5. Risk Management

- Set appropriate haircuts
- Monitor timeout rates
- Adjust max delay based on FDC performance

## Integration Examples

### Example 1: Basic LP Setup

```solidity
// 1. Deploy or get LP registry
LiquidityProviderRegistry lpRegistry = LiquidityProviderRegistry(0x...);

// 2. Deposit liquidity
lpRegistry.depositLiquidity{value: 10000 ether}(
    address(fxrp),
    10000 ether,
    10000,  // 1% min haircut
    3600    // 1 hour max delay
);

// 3. Monitor position
LPPosition memory position = lpRegistry.getPosition(msg.sender, address(fxrp));
console.log("Available:", position.availableAmount);
console.log("Total Earned:", position.totalEarned);

// 4. Withdraw when done
lpRegistry.withdrawLiquidity(address(fxrp), 10000 ether);
```

### Example 2: Dynamic Haircut Adjustment

```solidity
// Monitor FDC success rate
uint256 successRate = getFDCSuccessRate();

// Adjust haircut based on success rate
uint256 minHaircut;
if (successRate > 99%) {
    minHaircut = 5000;  // 0.5% - low risk
} else if (successRate > 95%) {
    minHaircut = 10000; // 1% - medium risk
} else {
    minHaircut = 20000; // 2% - high risk
}

// Update position
lpRegistry.withdrawLiquidity(address(fxrp), currentAmount);
lpRegistry.depositLiquidity{value: newAmount}(
    address(fxrp),
    newAmount,
    minHaircut,
    3600
);
```

## FAQ

### Q: What happens if FDC confirms failure?

**A**: LP receives full capital back (no haircut fee earned). The haircut fee is only earned on successful redemptions.

### Q: What happens if FDC times out?

**A**: LP receives full capital back (no haircut fee earned). Timeout occurs after 600 seconds (10 minutes) if FDC doesn't attest.

### Q: Can I change my parameters after depositing?

**A**: Yes, withdraw and re-deposit with new parameters. Note: This may affect matching priority.

### Q: How do I know if my LP is matched?

**A**: Check escrow status - if `lpFunded == true` and `lp == yourAddress`, your LP was matched.

### Q: What's the minimum deposit?

**A**: There's no hard minimum, but very small deposits may not match due to gas costs.

### Q: Can I provide liquidity for multiple assets?

**A**: Yes, create separate positions for each asset.

## Support

For questions or issues:
- Check contract documentation
- Review test files for examples
- Contact FLIP team for support

