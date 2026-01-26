// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IBlazeSwapRouter.sol";
import "./interfaces/IBlazeFLIPVault.sol";

interface IERC20Vault {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ILPRegistry {
    function depositLiquidity(address _asset, uint256 _amount, uint256 _minHaircut, uint256 _maxDelay) external payable;
    function withdrawLiquidity(address _asset, uint256 _amount) external;
    function depositERC20Liquidity(address _token, uint256 _amount, uint256 _minHaircut, uint256 _maxDelay) external;
    function withdrawERC20Liquidity(address _token, uint256 _amount) external;
    function escrowVault() external view returns (address);
}

/**
 * @title BlazeFLIPVault
 * @notice BlazeSwap-backed liquidity backstop vault for FLIP protocol
 * @dev Accepts FLR deposits, forwards a configurable slice into FLIP's LiquidityProviderRegistry,
 *      and provides just-in-time backstop liquidity via BlazeSwap swaps when no direct LP matches.
 *
 *      Depositors earn FLIP haircut fees proportional to their vault shares.
 *      "Existing Flare AMM liquidity is recycled into instant FAsset redemptions."
 */
contract BlazeFLIPVault is IBlazeFLIPVault {
    // ============ IMMUTABLES ============

    IBlazeSwapRouter public immutable blazeRouter;
    ILPRegistry public immutable lpRegistry;
    address public immutable wcflr;

    // ============ STATE ============

    address public owner;
    address public fxrpToken;

    // Share accounting (ERC4626-style for native tokens)
    uint256 public totalShares;
    mapping(address => uint256) public shares;
    mapping(address => uint256) public depositTimestamp;

    // Deployment tracking
    uint256 public deployedToFlip;      // FLR currently deposited in lpRegistry
    uint256 public deployedToMinting;   // FXRP currently deposited in lpRegistry (ERC20)
    uint256 public totalHaircutsEarned; // Lifetime haircut earnings
    uint256 public pendingHaircuts;     // Undistributed haircut earnings
    uint256 public haircutsPerShare;    // Accumulated haircuts per share (scaled 1e18)
    mapping(address => uint256) public haircutDebt; // Per-depositor tracking for earnings

    // Configuration
    uint256 public allocationRatio;     // % of vault to deploy to FLIP (scaled 1e6, 300000 = 30%)
    uint256 public minHaircut;          // Min haircut vault accepts (scaled 1e6)
    uint256 public maxDelay;            // Max delay for LP deposits (seconds)
    uint256 public maxSlippageBps;      // Max slippage for BlazeSwap swaps (basis points, 100 = 1%)
    uint256 public backstopMaxPerTx;    // Max FLR per single backstop call
    bool public backstopEnabled;        // Whether backstop is active
    uint256 public minDepositDelay;     // Anti-flashloan lockup (seconds)
    uint256 public rebalanceThreshold;  // Re-deploy if off-target by this % (scaled 1e6, 100000 = 10%)
    bool public paused;                 // Emergency pause flag

    // Reentrancy guard
    uint256 private _locked;

    // ============ EVENTS ============

    event Deposited(address indexed depositor, uint256 amount, uint256 sharesReceived);
    event Withdrawn(address indexed depositor, uint256 shares, uint256 amountReceived);
    event DeployedToFlip(uint256 amount);
    event DeployedToMinting(uint256 flrSwapped, uint256 fxrpReceived);
    event PulledBackFromFlip(uint256 amount);
    event BackstopProvided(address indexed asset, uint256 amount, uint256 haircut);
    event BackstopERC20Provided(address indexed token, uint256 amount, uint256 flrUsed);
    event Rebalanced(uint256 deployedAfter, uint256 idleAfter);
    event HaircutEarningsRecorded(uint256 amount);
    event EarningsClaimed(address indexed depositor, uint256 amount);
    event ConfigUpdated(string param);
    event PartialWithdrawal(address indexed depositor, uint256 requested, uint256 received);
    event Paused(bool paused);

    // ============ MODIFIERS ============

    modifier onlyOwner() {
        require(msg.sender == owner, "BlazeFLIPVault: not owner");
        _;
    }

    modifier onlyLPRegistry() {
        require(msg.sender == address(lpRegistry), "BlazeFLIPVault: not lpRegistry");
        _;
    }

    modifier nonReentrant() {
        require(_locked == 0, "BlazeFLIPVault: reentrant");
        _locked = 1;
        _;
        _locked = 0;
    }

    modifier whenNotPaused() {
        require(!paused, "BlazeFLIPVault: paused");
        _;
    }

    // ============ CONSTRUCTOR ============

    constructor(
        address _blazeRouter,
        address _lpRegistry,
        address _fxrpToken
    ) {
        require(_blazeRouter != address(0), "BlazeFLIPVault: invalid router");
        require(_lpRegistry != address(0), "BlazeFLIPVault: invalid registry");

        blazeRouter = IBlazeSwapRouter(_blazeRouter);
        lpRegistry = ILPRegistry(_lpRegistry);
        wcflr = IBlazeSwapRouter(_blazeRouter).wNat();
        fxrpToken = _fxrpToken;
        owner = msg.sender;

        // Defaults
        allocationRatio = 300000;       // 30%
        minHaircut = 1000;              // 0.1%
        maxDelay = 600;                 // 10 minutes
        maxSlippageBps = 100;           // 1%
        backstopMaxPerTx = 50 ether;    // 50 FLR
        backstopEnabled = true;
        minDepositDelay = 3600;         // 1 hour
        rebalanceThreshold = 100000;    // 10%
    }

    receive() external payable {}

    // ============ DEPOSITOR FUNCTIONS ============

    /// @notice Deposit FLR into the vault, receive shares
    function deposit() external payable nonReentrant whenNotPaused returns (uint256 sharesReceived) {
        require(msg.value > 0, "BlazeFLIPVault: zero deposit");

        // Settle any pending earnings before changing share balance
        if (shares[msg.sender] > 0 && haircutsPerShare > haircutDebt[msg.sender]) {
            uint256 pendingEarnings = (shares[msg.sender] * (haircutsPerShare - haircutDebt[msg.sender])) / 1e18;
            if (pendingEarnings > 0 && address(this).balance > msg.value + pendingEarnings) {
                payable(msg.sender).transfer(pendingEarnings);
                emit EarningsClaimed(msg.sender, pendingEarnings);
            }
        }

        uint256 totalAssets = _totalAssets();

        if (totalShares == 0) {
            sharesReceived = msg.value;
        } else {
            // shares = deposit * totalShares / totalAssets (before deposit)
            sharesReceived = (msg.value * totalShares) / totalAssets;
        }

        require(sharesReceived > 0, "BlazeFLIPVault: zero shares");

        shares[msg.sender] += sharesReceived;
        totalShares += sharesReceived;
        depositTimestamp[msg.sender] = block.timestamp;
        haircutDebt[msg.sender] = haircutsPerShare;

        emit Deposited(msg.sender, msg.value, sharesReceived);
    }

    /// @notice Withdraw FLR from vault by burning shares
    /// @param _shares Number of shares to burn
    function withdraw(uint256 _shares) external nonReentrant returns (uint256 amountReceived) {
        require(_shares > 0, "BlazeFLIPVault: zero shares");
        require(shares[msg.sender] >= _shares, "BlazeFLIPVault: insufficient shares");
        require(
            block.timestamp >= depositTimestamp[msg.sender] + minDepositDelay,
            "BlazeFLIPVault: deposit lockup active"
        );

        // Calculate FLR owed
        amountReceived = (_shares * _totalAssets()) / totalShares;

        // Burn shares
        shares[msg.sender] -= _shares;
        totalShares -= _shares;

        // If vault doesn't have enough idle FLR, pull back from FLIP
        uint256 idle = address(this).balance;
        if (idle < amountReceived) {
            uint256 pullNeeded = amountReceived - idle;
            uint256 pullAmount = pullNeeded > deployedToFlip ? deployedToFlip : pullNeeded;
            if (pullAmount > 0) {
                _pullBackInternal(pullAmount);
            }
        }

        // Transfer FLR
        uint256 available = address(this).balance;
        if (amountReceived > available) {
            amountReceived = available; // Cap at available (edge case: funds locked in escrow)
        }
        payable(msg.sender).transfer(amountReceived);

        emit Withdrawn(msg.sender, _shares, amountReceived);
    }

    /// @notice Claim accumulated haircut earnings
    function claimEarnings() external nonReentrant returns (uint256 earned) {
        uint256 owed = (shares[msg.sender] * (haircutsPerShare - haircutDebt[msg.sender])) / 1e18;
        require(owed > 0, "BlazeFLIPVault: no earnings");

        haircutDebt[msg.sender] = haircutsPerShare;

        payable(msg.sender).transfer(owed);
        emit EarningsClaimed(msg.sender, owed);
        return owed;
    }

    /// @notice Get current share price (FLR per share, scaled 1e18)
    function sharePrice() external view returns (uint256) {
        if (totalShares == 0) return 1e18;
        return (_totalAssets() * 1e18) / totalShares;
    }

    /// @notice Get depositor's current FLR value
    function balanceOfUnderlying(address _depositor) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares[_depositor] * _totalAssets()) / totalShares;
    }

    // ============ ALLOCATION FUNCTIONS ============

    /// @notice Deploy idle FLR into FLIP's lpRegistry as native liquidity
    function deployToFlip() external nonReentrant onlyOwner {
        uint256 target = _targetDeployment();
        require(target > deployedToFlip, "BlazeFLIPVault: already at target");

        uint256 toDeploy = target - deployedToFlip;
        uint256 idle = address(this).balance;
        if (toDeploy > idle) {
            toDeploy = idle;
        }
        require(toDeploy > 0, "BlazeFLIPVault: nothing to deploy");

        _deployToFlipInternal(toDeploy);
    }

    /// @notice Swap FLR -> FXRP on BlazeSwap and deposit as minting liquidity
    /// @param _flrAmount Amount of FLR to swap to FXRP
    function deployToMinting(uint256 _flrAmount) external nonReentrant onlyOwner {
        require(fxrpToken != address(0), "BlazeFLIPVault: fxrp not set");
        require(_flrAmount > 0, "BlazeFLIPVault: zero amount");
        require(address(this).balance >= _flrAmount, "BlazeFLIPVault: insufficient idle");

        uint256 fxrpReceived = _swapFLRToFXRP(_flrAmount);
        require(fxrpReceived > 0, "BlazeFLIPVault: swap returned zero");

        // Approve and deposit to lpRegistry as ERC20 LP
        IERC20Vault(fxrpToken).approve(address(lpRegistry), fxrpReceived);
        lpRegistry.depositERC20Liquidity(fxrpToken, fxrpReceived, minHaircut, maxDelay);
        deployedToMinting += fxrpReceived;

        emit DeployedToMinting(_flrAmount, fxrpReceived);
    }

    /// @notice Pull back unmatched FLR from lpRegistry
    /// @param _amount Amount to pull back
    function pullBackFromFlip(uint256 _amount) external nonReentrant onlyOwner {
        _pullBackInternal(_amount);
    }

    /// @notice Auto-rebalance: permissionless, re-deploys if allocation drifts from target
    function rebalance() external nonReentrant {
        uint256 target = _targetDeployment();
        uint256 idle = address(this).balance;

        if (deployedToFlip < target) {
            // Under-deployed: push more to FLIP
            uint256 deficit = target - deployedToFlip;
            uint256 canDeploy = deficit > idle ? idle : deficit;
            if (canDeploy > 0) {
                _deployToFlipInternal(canDeploy);
            }
        } else if (deployedToFlip > target) {
            // Over-deployed: check if significantly above threshold
            uint256 excess = deployedToFlip - target;
            uint256 threshold = (target * rebalanceThreshold) / 1e6;
            if (excess > threshold) {
                _pullBackInternal(excess);
            }
        }

        emit Rebalanced(deployedToFlip, address(this).balance);
    }

    // ============ BACKSTOP FUNCTIONS (called by LPRegistry) ============

    /// @notice Provide just-in-time native token liquidity for a redemption
    function provideBackstopLiquidity(
        address _asset,
        uint256 _amount,
        uint256 _requestedHaircut
    ) external override onlyLPRegistry nonReentrant returns (bool success, uint256 providedAmount) {
        if (!backstopEnabled) return (false, 0);
        if (_amount > backstopMaxPerTx) return (false, 0);
        if (_requestedHaircut < minHaircut) return (false, 0);
        if (address(this).balance < _amount) return (false, 0);

        // Transfer FLR directly to EscrowVault
        address escrow = lpRegistry.escrowVault();
        require(escrow != address(0), "BlazeFLIPVault: escrow not set");
        payable(escrow).transfer(_amount);

        emit BackstopProvided(_asset, _amount, _requestedHaircut);
        return (true, _amount);
    }

    /// @notice Provide just-in-time ERC20 liquidity for minting via BlazeSwap JIT swap
    function provideBackstopERC20Liquidity(
        address _token,
        uint256 _amount,
        uint256 _requestedHaircut
    ) external override onlyLPRegistry nonReentrant returns (bool success, uint256 providedAmount) {
        if (!backstopEnabled) return (false, 0);
        if (_requestedHaircut < minHaircut) return (false, 0);
        require(_token == fxrpToken, "BlazeFLIPVault: unsupported token");

        // Get quote: how much FLR needed for _amount FXRP
        address[] memory path = new address[](2);
        path[0] = wcflr;
        path[1] = fxrpToken;

        uint256[] memory amountsIn = blazeRouter.getAmountsIn(_amount, path);
        uint256 flrNeeded = amountsIn[0];

        // Apply slippage buffer
        uint256 flrWithSlippage = flrNeeded + (flrNeeded * maxSlippageBps) / 10000;
        if (address(this).balance < flrWithSlippage) return (false, 0);
        if (flrWithSlippage > backstopMaxPerTx) return (false, 0);

        // Execute swap: FLR -> FXRP, send directly to EscrowVault
        address escrow = lpRegistry.escrowVault();
        require(escrow != address(0), "BlazeFLIPVault: escrow not set");

        uint256 minOut = _amount - (_amount * maxSlippageBps) / 10000;

        uint256[] memory amounts = blazeRouter.swapExactETHForTokens{value: flrWithSlippage}(
            minOut,
            path,
            escrow, // FXRP sent directly to EscrowVault
            block.timestamp + 300
        );

        uint256 fxrpReceived = amounts[amounts.length - 1];

        emit BackstopERC20Provided(_token, fxrpReceived, flrWithSlippage);
        return (true, fxrpReceived);
    }

    // ============ EARNINGS ============

    /// @notice Record haircut earnings from successful settlement
    function recordHaircutEarnings(uint256 _amount) external payable override {
        require(msg.value == _amount || _amount == 0, "BlazeFLIPVault: amount mismatch");
        if (msg.value == 0) return;

        totalHaircutsEarned += msg.value;
        if (totalShares > 0) {
            haircutsPerShare += (msg.value * 1e18) / totalShares;
        }

        emit HaircutEarningsRecorded(msg.value);
    }

    // ============ OWNER CONFIGURATION ============

    function setAllocationRatio(uint256 _ratio) external onlyOwner {
        require(_ratio <= 1000000, "BlazeFLIPVault: ratio > 100%");
        allocationRatio = _ratio;
        emit ConfigUpdated("allocationRatio");
    }

    function setMinHaircut(uint256 _minHaircut) external onlyOwner {
        require(_minHaircut <= 1000000, "BlazeFLIPVault: invalid haircut");
        minHaircut = _minHaircut;
        emit ConfigUpdated("minHaircut");
    }

    function setMaxDelay(uint256 _maxDelay) external onlyOwner {
        require(_maxDelay > 0, "BlazeFLIPVault: invalid delay");
        maxDelay = _maxDelay;
        emit ConfigUpdated("maxDelay");
    }

    function setMaxSlippageBps(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "BlazeFLIPVault: slippage > 10%");
        maxSlippageBps = _bps;
        emit ConfigUpdated("maxSlippageBps");
    }

    function setBackstopEnabled(bool _enabled) external onlyOwner {
        backstopEnabled = _enabled;
        emit ConfigUpdated("backstopEnabled");
    }

    function setBackstopMaxPerTx(uint256 _max) external onlyOwner {
        backstopMaxPerTx = _max;
        emit ConfigUpdated("backstopMaxPerTx");
    }

    function setFxrpToken(address _token) external onlyOwner {
        require(_token != address(0), "BlazeFLIPVault: invalid token");
        fxrpToken = _token;
        emit ConfigUpdated("fxrpToken");
    }

    function setMinDepositDelay(uint256 _delay) external onlyOwner {
        minDepositDelay = _delay;
        emit ConfigUpdated("minDepositDelay");
    }

    function setRebalanceThreshold(uint256 _threshold) external onlyOwner {
        require(_threshold <= 1000000, "BlazeFLIPVault: invalid threshold");
        rebalanceThreshold = _threshold;
        emit ConfigUpdated("rebalanceThreshold");
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "BlazeFLIPVault: invalid owner");
        owner = _newOwner;
    }

    // ============ VIEW FUNCTIONS ============

    function getVaultStats() external view returns (
        uint256 totalAssetsOut,
        uint256 totalSharesOut,
        uint256 deployedToFlipOut,
        uint256 deployedToMintingOut,
        uint256 idleBalanceOut,
        uint256 targetDeploymentOut,
        bool needsRebalanceOut
    ) {
        totalAssetsOut = _totalAssetsView();
        totalSharesOut = totalShares;
        deployedToFlipOut = deployedToFlip;
        deployedToMintingOut = deployedToMinting;
        idleBalanceOut = address(this).balance;
        targetDeploymentOut = _targetDeploymentView();

        uint256 threshold = (targetDeploymentOut * rebalanceThreshold) / 1e6;
        needsRebalanceOut = (deployedToFlip + threshold < targetDeploymentOut) ||
                            (deployedToFlip > targetDeploymentOut + threshold);
    }

    function getPendingEarnings(address _depositor) external view returns (uint256) {
        return (shares[_depositor] * (haircutsPerShare - haircutDebt[_depositor])) / 1e18;
    }

    // ============ INTERNAL FUNCTIONS ============

    function _totalAssets() internal view returns (uint256) {
        return address(this).balance + deployedToFlip;
    }

    function _totalAssetsView() internal view returns (uint256) {
        return address(this).balance + deployedToFlip;
    }

    function _targetDeployment() internal view returns (uint256) {
        return (_totalAssets() * allocationRatio) / 1e6;
    }

    function _targetDeploymentView() internal view returns (uint256) {
        return (_totalAssetsView() * allocationRatio) / 1e6;
    }

    function _deployToFlipInternal(uint256 _amount) internal {
        // The vault uses a placeholder asset address for generic FLR liquidity
        // In practice, this should be the FXRP address for the redemption path
        require(fxrpToken != address(0), "BlazeFLIPVault: fxrp not set");

        lpRegistry.depositLiquidity{value: _amount}(fxrpToken, _amount, minHaircut, maxDelay);
        deployedToFlip += _amount;

        emit DeployedToFlip(_amount);
    }

    function _pullBackInternal(uint256 _amount) internal {
        require(deployedToFlip >= _amount, "BlazeFLIPVault: pull exceeds deployed");
        require(fxrpToken != address(0), "BlazeFLIPVault: fxrp not set");

        lpRegistry.withdrawLiquidity(fxrpToken, _amount);
        deployedToFlip -= _amount;

        emit PulledBackFromFlip(_amount);
    }

    function _swapFLRToFXRP(uint256 _flrAmount) internal returns (uint256 fxrpReceived) {
        address[] memory path = new address[](2);
        path[0] = wcflr;
        path[1] = fxrpToken;

        // Get expected output
        uint256[] memory expectedAmounts = blazeRouter.getAmountsOut(_flrAmount, path);
        uint256 expectedOut = expectedAmounts[expectedAmounts.length - 1];
        uint256 minOut = expectedOut - (expectedOut * maxSlippageBps) / 10000;

        uint256[] memory amounts = blazeRouter.swapExactETHForTokens{value: _flrAmount}(
            minOut,
            path,
            address(this),
            block.timestamp + 300
        );

        fxrpReceived = amounts[amounts.length - 1];
    }
}
