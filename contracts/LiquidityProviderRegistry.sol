// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LiquidityProviderRegistry
 * @notice Market-based opt-in liquidity provider system
 * @dev LPs deposit liquidity with constraints (minHaircut, maxDelay) and earn settlement spreads
 */
contract LiquidityProviderRegistry {
    struct LPPosition {
        address lp;
        address asset;
        uint256 depositedAmount;
        uint256 availableAmount;
        uint256 minHaircut;      // Scaled: 1000000 = 100%
        uint256 maxDelay;         // Seconds
        uint256 totalEarned;      // Total haircut fees earned
        bool active;
    }
    
    // LP positions: (lp, asset) => position
    mapping(address => mapping(address => LPPosition)) public positions;
    // List of active LPs per asset
    mapping(address => address[]) public activeLPs;
    // LP address => asset => index in activeLPs array
    mapping(address => mapping(address => uint256)) public lpIndex;
    
    address public owner;
    address public flipCore; // FLIPCore contract address
    
    event LiquidityDeposited(
        address indexed lp,
        address indexed asset,
        uint256 amount,
        uint256 minHaircut,
        uint256 maxDelay
    );
    
    event LiquidityWithdrawn(
        address indexed lp,
        address indexed asset,
        uint256 amount
    );
    
    event LiquidityMatched(
        address indexed lp,
        address indexed asset,
        uint256 amount,
        uint256 haircut
    );
    
    event SettlementRecorded(
        address indexed lp,
        address indexed asset,
        uint256 amount,
        uint256 haircutEarned
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "LiquidityProviderRegistry: not owner");
        _;
    }
    
    modifier onlyAuthorized() {
        require(
            msg.sender == owner || msg.sender == flipCore,
            "LiquidityProviderRegistry: not authorized"
        );
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Set FLIPCore address (owner only, one-time setup)
     * @param _flipCore FLIPCore contract address
     */
    function setFLIPCore(address _flipCore) external onlyOwner {
        require(_flipCore != address(0), "LiquidityProviderRegistry: invalid address");
        require(flipCore == address(0), "LiquidityProviderRegistry: already set");
        flipCore = _flipCore;
    }
    
    /**
     * @notice Deposit liquidity as LP
     * @param _asset Asset to provide liquidity for
     * @param _amount Amount to deposit
     * @param _minHaircut Minimum haircut LP accepts (scaled: 1000000 = 100%)
     * @param _maxDelay Maximum delay LP tolerates (seconds)
     */
    function depositLiquidity(
        address _asset,
        uint256 _amount,
        uint256 _minHaircut,
        uint256 _maxDelay
    ) external payable {
        require(_asset != address(0), "LiquidityProviderRegistry: invalid asset");
        require(_amount > 0, "LiquidityProviderRegistry: invalid amount");
        require(msg.value >= _amount, "LiquidityProviderRegistry: insufficient payment");
        require(_minHaircut <= 1000000, "LiquidityProviderRegistry: invalid haircut");
        require(_maxDelay > 0, "LiquidityProviderRegistry: invalid delay");
        
        LPPosition storage position = positions[msg.sender][_asset];
        
        if (!position.active) {
            // New position - add to active LPs list
            position.active = true;
            lpIndex[msg.sender][_asset] = activeLPs[_asset].length;
            activeLPs[_asset].push(msg.sender);
        }
        
        position.lp = msg.sender;
        position.asset = _asset;
        position.depositedAmount += _amount;
        position.availableAmount += _amount;
        position.minHaircut = _minHaircut; // Update to latest preference
        position.maxDelay = _maxDelay;     // Update to latest preference
        
        emit LiquidityDeposited(msg.sender, _asset, _amount, _minHaircut, _maxDelay);
    }
    
    /**
     * @notice Withdraw liquidity
     * @param _asset Asset to withdraw
     * @param _amount Amount to withdraw
     */
    function withdrawLiquidity(address _asset, uint256 _amount) external {
        require(_amount > 0, "LiquidityProviderRegistry: invalid amount");
        
        LPPosition storage position = positions[msg.sender][_asset];
        require(position.active, "LiquidityProviderRegistry: no position");
        require(position.availableAmount >= _amount, "LiquidityProviderRegistry: insufficient available");
        
        position.availableAmount -= _amount;
        position.depositedAmount -= _amount;
        
        // If position fully withdrawn, remove from active list
        if (position.depositedAmount == 0) {
            position.active = false;
            _removeLP(_asset, msg.sender);
        }
        
        // In production, transfer funds back to LP
        // For now, emit event - actual transfer handled by EscrowVault/FLIPCore
        
        emit LiquidityWithdrawn(msg.sender, _asset, _amount);
    }
    
    /**
     * @notice Match liquidity for a redemption
     * @param _asset Asset being redeemed
     * @param _amount Amount needed
     * @param _requestedHaircut Requested haircut (scaled: 1000000 = 100%)
     * @return lp Matched LP address (address(0) if no match)
     * @return availableAmount Available amount from matched LP
     */
    function matchLiquidity(
        address _asset,
        uint256 _amount,
        uint256 _requestedHaircut
    ) external onlyAuthorized returns (address lp, uint256 availableAmount) {
        address[] memory lps = activeLPs[_asset];
        
        // Find best LP match:
        // 1. minHaircut <= requestedHaircut
        // 2. availableAmount >= amount
        // 3. Prefer lower haircut (better UX)
        address bestLP = address(0);
        uint256 bestHaircut = 1000001; // Higher than max
        
        for (uint256 i = 0; i < lps.length; i++) {
            LPPosition memory pos = positions[lps[i]][_asset];
            
            if (
                pos.active &&
                pos.availableAmount >= _amount &&
                pos.minHaircut <= _requestedHaircut &&
                pos.minHaircut < bestHaircut
            ) {
                bestLP = lps[i];
                bestHaircut = pos.minHaircut;
            }
        }
        
        if (bestLP != address(0)) {
            LPPosition storage matchedPos = positions[bestLP][_asset];
            matchedPos.availableAmount -= _amount;
            
            emit LiquidityMatched(bestLP, _asset, _amount, bestHaircut);
            return (bestLP, _amount);
        }
        
        return (address(0), 0);
    }
    
    /**
     * @notice Record settlement and distribute fees to LP
     * @param _lp LP address
     * @param _asset Asset
     * @param _amount Amount settled
     * @param _haircutEarned Haircut fee earned (scaled: 1000000 = 100%)
     */
    function recordSettlement(
        address _lp,
        address _asset,
        uint256 _amount,
        uint256 _haircutEarned
    ) external onlyAuthorized {
        LPPosition storage position = positions[_lp][_asset];
        require(position.active, "LiquidityProviderRegistry: position not active");
        
        uint256 feeAmount = (_amount * _haircutEarned) / 1000000;
        position.totalEarned += feeAmount;
        
        emit SettlementRecorded(_lp, _asset, _amount, _haircutEarned);
    }
    
    /**
     * @notice Get LP position
     * @param _lp LP address
     * @param _asset Asset
     * @return position LP position struct
     */
    function getPosition(address _lp, address _asset)
        external
        view
        returns (LPPosition memory position)
    {
        return positions[_lp][_asset];
    }
    
    /**
     * @notice Get number of active LPs for an asset
     * @param _asset Asset
     * @return count Number of active LPs
     */
    function getActiveLPCount(address _asset) external view returns (uint256 count) {
        return activeLPs[_asset].length;
    }
    
    /**
     * @notice Get active LP at index
     * @param _asset Asset
     * @param _index Index
     * @return lp LP address
     */
    function getActiveLP(address _asset, uint256 _index) external view returns (address lp) {
        require(_index < activeLPs[_asset].length, "LiquidityProviderRegistry: index out of bounds");
        return activeLPs[_asset][_index];
    }
    
    /**
     * @notice Remove LP from active list
     * @param _asset Asset
     * @param _lp LP address to remove
     */
    function _removeLP(address _asset, address _lp) internal {
        uint256 index = lpIndex[_lp][_asset];
        uint256 lastIndex = activeLPs[_asset].length - 1;
        
        if (index != lastIndex) {
            address lastLP = activeLPs[_asset][lastIndex];
            activeLPs[_asset][index] = lastLP;
            lpIndex[lastLP][_asset] = index;
        }
        
        activeLPs[_asset].pop();
        delete lpIndex[_lp][_asset];
    }
}


