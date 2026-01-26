# FLIP Liquidity System

## Architecture Overview

FLIP uses a two-tier liquidity system to guarantee instant settlements for FAsset redemptions:

```
User requests redemption
         │
         ▼
┌─────────────────────────────┐
│  Tier 1: Direct LP Match    │
│  LiquidityProviderRegistry  │
│  (Market-based opt-in LPs)  │
└────────────┬────────────────┘
             │ No match found
             ▼
┌─────────────────────────────┐
│  Tier 2: Backstop Vault     │
│  BlazeFLIPVault             │
│  (JIT liquidity via         │
│   BlazeSwap AMM)            │
└─────────────────────────────┘
```

**Tier 1** provides capital-efficient, market-priced liquidity from individual LPs who set their own parameters. **Tier 2** recycles existing Flare AMM liquidity into instant FAsset settlements when no direct LP is available, ensuring redemptions never fail due to lack of liquidity.

---

## Tier 1: Direct LP System (LiquidityProviderRegistry)

### How It Works

Individual LPs deposit FLR (for redemptions) or ERC20 tokens like FXRP (for minting) into the LiquidityProviderRegistry with custom parameters:

- **minHaircut**: Minimum fee the LP will accept (scaled: 1000000 = 100%, 10000 = 1%)
- **maxDelay**: Maximum time LP will tolerate before FDC confirmation (seconds)

When FLIPCore processes a redemption, it calls `matchLiquidity()` which:
1. Iterates active LPs for the requested asset
2. Filters by `minHaircut <= requestedHaircut` and `availableAmount >= amount`
3. Selects the LP with the lowest haircut (best price for user)
4. Transfers matched funds to EscrowVault
5. LP earns the haircut fee on successful settlement

### LP Position Lifecycle

```
Deposit → Active Position → Matched (funds in escrow) → Settlement → Fee Earned
                                                              │
                                                              ▼
                                                    FDC Success: LP keeps haircut
                                                    FDC Failure: LP capital returned
                                                    Timeout: LP capital returned
```

### Native Token Liquidity (Redemptions)

```solidity
// Deposit 100 FLR for FXRP redemptions, accepting 1% haircut, 1hr max delay
lpRegistry.depositLiquidity{value: 100 ether}(
    fxrpAddress,    // asset
    100 ether,      // amount
    10000,          // 1% min haircut
    3600            // 1 hour max delay
);
```

When a user redeems FXRP, the registry matches an LP whose FLR is sent to escrow. The user receives ~99% immediately via their Settlement Receipt NFT. After FDC confirms the XRP payment on XRPL, the LP earns the 1% haircut.

### ERC20 Token Liquidity (Minting)

```solidity
// Deposit 1000 FXRP for minting liquidity
IERC20(fxrpAddress).approve(address(lpRegistry), 1000 ether);
lpRegistry.depositERC20Liquidity(
    fxrpAddress,    // token
    1000 ether,     // amount
    10000,          // 1% min haircut
    3600            // 1 hour max delay
);
```

When a user sends XRP to mint FXRP, the registry matches an ERC20 LP whose FXRP is sent to the user immediately. The LP earns the haircut after FDC confirms the XRP deposit.

### Matching Algorithm

```
matchLiquidity(asset, amount, requestedHaircut):
    for each active LP:
        if LP.minHaircut <= requestedHaircut AND LP.available >= amount:
            track as candidate (prefer lowest haircut)

    if candidate found:
        transfer LP funds to EscrowVault
        return (LP address, amount)

    // FALLBACK: try backstop vault
    if backstopVault != address(0):
        return backstopVault.provideBackstopLiquidity(asset, amount, haircut)

    return (address(0), 0)  // no match
```

### Haircut Clearing Condition

From the whitepaper (Appendix A), LPs participate when:

```
H >= r * T
```

Where:
- H = haircut rate offered
- r = LP's annualized opportunity cost
- T = escrow duration (fraction of year)

Example: With r=5% APY and T=600s (10 min = 0.0000190 years), minimum rational haircut is 0.000095%. In practice, LPs set 0.1%-1% (1000-10000 scaled), earning far above opportunity cost.

---

## Tier 2: BlazeSwap Backstop Vault (BlazeFLIPVault)

### Concept

The BlazeFLIPVault is a shared liquidity vault that provides just-in-time (JIT) backstop liquidity when no direct LP matches a redemption or minting request. It recycles existing Flare AMM (BlazeSwap) liquidity into FLIP settlements.

Depositors earn a proportional share of all haircut fees from backstop settlements.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BlazeFLIPVault                        │
│                                                         │
│  ┌─────────────┐     ┌──────────────┐                  │
│  │ Idle FLR    │     │ Deployed to  │                  │
│  │ (70%)       │     │ FLIP LP      │                  │
│  │             │     │ Registry     │                  │
│  │             │     │ (30%)        │                  │
│  └──────┬──────┘     └──────────────┘                  │
│         │                                               │
│         │  Backstop Call                                 │
│         ▼                                               │
│  ┌──────────────────────┐                               │
│  │ Native Backstop      │ FLR → EscrowVault directly   │
│  └──────────────────────┘                               │
│  ┌──────────────────────┐                               │
│  │ ERC20 Backstop (JIT) │ FLR → BlazeSwap → FXRP      │
│  │                      │ → EscrowVault                │
│  └──────────────────────┘                               │
│                                                         │
│  Share Accounting (ERC4626-style)                       │
│  Haircut Distribution (proportional to shares)          │
└─────────────────────────────────────────────────────────┘
```

### How It Works

#### Depositing
Users deposit FLR into the vault and receive shares proportional to their contribution. Share price increases as haircut fees accumulate.

```
sharesReceived = depositAmount * totalShares / totalAssets
```

#### Allocation
The vault owner deploys a configurable percentage (default 30%) of assets into the FLIP LiquidityProviderRegistry as native liquidity. The remaining 70% stays idle for backstop calls.

#### Native Token Backstop (Redemptions)
When `matchLiquidity()` finds no direct LP, it calls:
```solidity
vault.provideBackstopLiquidity(asset, amount, haircut)
```
The vault checks:
1. Backstop is enabled
2. Amount <= backstopMaxPerTx (50 FLR default)
3. Haircut >= vault's minHaircut (0.1% default)
4. Vault has sufficient idle FLR

If all pass, the vault transfers FLR directly to EscrowVault.

#### ERC20 Token Backstop (Minting)
When `matchERC20Liquidity()` finds no direct LP, it calls:
```solidity
vault.provideBackstopERC20Liquidity(token, amount, haircut)
```
The vault:
1. Quotes FLR needed via `blazeRouter.getAmountsIn()`
2. Applies slippage buffer (default 1%)
3. Swaps FLR → FXRP on BlazeSwap
4. Sends FXRP directly to EscrowVault

This is the JIT (just-in-time) swap that recycles AMM liquidity.

#### Earnings Distribution
When a backstop settlement succeeds, the LPRegistry (or any caller) calls:
```solidity
vault.recordHaircutEarnings{value: fee}(fee)
```
The fee is distributed to all vault depositors proportionally via `haircutsPerShare` accumulator:
```
haircutsPerShare += fee * 1e18 / totalShares
userEarnings = userShares * (haircutsPerShare - userDebt) / 1e18
```

#### Rebalancing
The vault supports permissionless rebalancing. Anyone can call `rebalance()` which:
- If under-deployed: pushes idle FLR into FLIP LP Registry
- If over-deployed: pulls back excess from FLIP LP Registry
- Threshold: rebalance triggers when drift exceeds 10% of target

### Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| allocationRatio | 300000 (30%) | % of vault deployed to FLIP |
| minHaircut | 1000 (0.1%) | Min haircut vault accepts |
| maxDelay | 600 (10 min) | Max delay for LP deposits |
| maxSlippageBps | 100 (1%) | Max slippage on BlazeSwap swaps |
| backstopMaxPerTx | 50 ether | Max FLR per backstop call |
| minDepositDelay | 300 (5 min) | Anti-flashloan lockup |
| rebalanceThreshold | 100000 (10%) | Drift before rebalance triggers |
| backstopEnabled | true | Kill switch for backstop |

### Security Features

1. **Reentrancy Guard**: All state-changing functions protected
2. **Anti-Flashloan Lockup**: Deposits locked for `minDepositDelay` before withdrawal
3. **Backstop Max Per Tx**: Caps exposure per single call
4. **Slippage Protection**: BlazeSwap swaps have configurable slippage bounds
5. **Owner Controls**: Pause, parameter updates, allocation management
6. **onlyLPRegistry**: Backstop functions only callable by the registry

### Vault Depositor Economics

**Revenue**: Share of all haircut fees from backstop settlements

**Example**:
- Vault TVL: 10,000 FLR
- Your deposit: 1,000 FLR (10% of shares)
- Daily backstop volume: 5,000 FLR
- Average haircut: 0.3%
- Daily fees: 5,000 * 0.003 = 15 FLR
- Your daily earnings: 15 * 10% = 1.5 FLR
- Annualized: 1.5 * 365 = 547.5 FLR on 1,000 FLR deposit = **54.75% APY**

Note: Actual returns depend on backstop utilization rate and haircut levels.

**Risks**:
- Funds temporarily locked in FLIP escrow (up to 10 min timeout)
- Slippage on BlazeSwap JIT swaps
- Anti-flashloan lockup on deposits
- If vault is paused, no backstop earnings
- Smart contract risk

---

## Liquidity Flow Diagrams

### Redemption Flow (FXRP → XRP)

```
User holds FXRP
      │
      ▼ requestRedemption()
┌─────────────┐
│  FLIPCore   │
└──────┬──────┘
       │ matchLiquidity()
       ▼
┌───────────────────┐
│  LP Registry      │──────── Direct LP found? ─── YES ──→ LP funds escrow
│                   │                                        User gets Receipt
│                   │                                        LP earns haircut
│                   │
│  backstopVault?   │──────── No LP found ────────────────→ BlazeFLIPVault
└───────────────────┘                                        sends FLR to escrow
                                                             User gets Receipt
                                                             Vault earns haircut
```

### Minting Flow (XRP → FXRP)

```
User sends XRP on XRPL
      │
      ▼ requestMinting()
┌─────────────┐
│  FLIPCore   │
└──────┬──────┘
       │ matchERC20Liquidity()
       ▼
┌───────────────────┐
│  LP Registry      │──────── Direct ERC20 LP? ── YES ──→ LP's FXRP to escrow
│                   │                                      User gets FXRP
│                   │                                      LP earns haircut
│                   │
│  backstopVault?   │──────── No LP found ────────────────→ BlazeFLIPVault
└───────────────────┘                                        swaps FLR→FXRP
                                                             on BlazeSwap
                                                             FXRP to escrow
                                                             Vault earns haircut
```

---

## Comparison: Direct LP vs Vault Backstop

| Feature | Direct LP (Tier 1) | Vault Backstop (Tier 2) |
|---------|--------------------|-----------------------|
| Capital Source | Individual LP deposits | Shared vault pool |
| Matching | First to meet parameters | Fallback when no LP matches |
| Token Support | Native FLR + ERC20 | Native FLR + JIT swap for ERC20 |
| Fee Distribution | Directly to matched LP | Proportional to vault shares |
| Parameters | Per-LP (haircut, delay) | Global vault config |
| Capital Efficiency | High (LP controls) | Moderate (30% deployed, 70% idle) |
| Minimum Commitment | Any amount | Any amount (shares) |
| Lockup | None (withdraw anytime) | minDepositDelay (anti-flashloan) |
| Risk | Per-redemption exposure | Shared across all backstops |
| AMM Dependency | None | BlazeSwap (for ERC20 JIT) |

---

## Contract Addresses (Coston2)

| Contract | Address |
|----------|---------|
| LiquidityProviderRegistry | `0xbc8423cd34653b1D64a8B54C4D597d90C4CEe100` |
| BlazeFLIPVault | `0x678D95C2d75289D4860cdA67758CB9BFdac88611` |
| BlazeSwap Router | `0x8D29b61C41CF318d15d031BE2928F79630e068e6` |
| FXRP | `0x0b6A3645c240605887a5532109323A3E12273dc7` |
| EscrowVault | `0xF3995d7766D807EFeE60769D45973FfC176E1b0c` |

---

## Frontend Integration

### LP Dashboard (`/lp`)
- Deposit/withdraw native FLR liquidity to LPRegistry
- View position: deposited, available, earned
- Set haircut and delay parameters

### Vault Dashboard (`/vault`)
- Deposit/withdraw FLR to BlazeFLIPVault
- View vault stats: total assets, deployed, idle, share price
- View personal position: shares, underlying value, pending earnings
- Claim accumulated haircut earnings
- Trigger permissionless rebalance

---

## API Reference

### LiquidityProviderRegistry

```solidity
// Native liquidity (redemptions)
function depositLiquidity(address _asset, uint256 _amount, uint256 _minHaircut, uint256 _maxDelay) external payable;
function withdrawLiquidity(address _asset, uint256 _amount) external;
function matchLiquidity(address _asset, uint256 _amount, uint256 _requestedHaircut) external returns (address lp, uint256 availableAmount);
function getPosition(address _lp, address _asset) external view returns (LPPosition memory);

// ERC20 liquidity (minting)
function depositERC20Liquidity(address _token, uint256 _amount, uint256 _minHaircut, uint256 _maxDelay) external;
function withdrawERC20Liquidity(address _token, uint256 _amount) external;
function matchERC20Liquidity(address _token, uint256 _amount, uint256 _requestedHaircut) external returns (address lp, uint256 availableAmount);
function getERC20Position(address _lp, address _token) external view returns (LPPosition memory);

// Backstop
function setBackstopVault(address _backstopVault) external; // owner only
```

### BlazeFLIPVault

```solidity
// Depositor functions
function deposit() external payable returns (uint256 sharesReceived);
function withdraw(uint256 _shares) external returns (uint256 amountReceived);
function claimEarnings() external returns (uint256 earned);

// View functions
function sharePrice() external view returns (uint256);
function balanceOfUnderlying(address _depositor) external view returns (uint256);
function getPendingEarnings(address _depositor) external view returns (uint256);
function getVaultStats() external view returns (
    uint256 totalAssets, uint256 totalShares, uint256 deployedToFlip,
    uint256 deployedToMinting, uint256 idleBalance, uint256 targetDeployment,
    bool needsRebalance
);

// Allocation (owner)
function deployToFlip() external;
function deployToMinting(uint256 _flrAmount) external;
function pullBackFromFlip(uint256 _amount) external;

// Permissionless
function rebalance() external;

// Backstop (onlyLPRegistry)
function provideBackstopLiquidity(address _asset, uint256 _amount, uint256 _requestedHaircut) external returns (bool success, uint256 providedAmount);
function provideBackstopERC20Liquidity(address _token, uint256 _amount, uint256 _requestedHaircut) external returns (bool success, uint256 providedAmount);

// Earnings
function recordHaircutEarnings(uint256 _amount) external payable;
```

---

## LP Strategy Guide

### For Direct LPs (Tier 1)

**Conservative**: 2% haircut, 6hr delay, small amounts
- Lower match rate, higher per-tx fee, less timeout risk

**Balanced**: 1% haircut, 1hr delay, medium amounts
- Moderate matches, good fee/risk ratio

**Aggressive**: 0.3% haircut, 30min delay, large amounts
- High match rate, volume-driven returns, higher timeout risk

### For Vault Depositors (Tier 2)

**Passive yield**: Deposit FLR, earn proportional backstop fees
- No parameter management needed
- Returns depend on backstop utilization
- Anti-flashloan lockup applies
- Monitor share price for accrued earnings

**Active management**: Monitor rebalance needs, claim earnings regularly
- Call `rebalance()` when vault drifts from target
- Claim earnings to compound elsewhere
- Watch backstop utilization metrics

---

## Risk Matrix

| Risk | Direct LP | Vault Depositor | Mitigation |
|------|-----------|-----------------|------------|
| FDC Failure | Capital returned, no fee | Shared loss across vault | Monitor FDC success rate |
| Timeout | Capital locked, no fee | Funds in escrow temporarily | Set appropriate maxDelay |
| Slippage | N/A | JIT swap slippage on ERC20 | maxSlippageBps cap (1%) |
| Flash Loan | N/A | Share price manipulation | minDepositDelay lockup |
| Smart Contract | Per-position exposure | Vault-wide exposure | Audits, pause mechanism |
| Capital Idle | LP controls when matched | 70% idle for backstop | Rebalance mechanism |
| Backstop Overuse | N/A | High volume drains idle | backstopMaxPerTx cap |
