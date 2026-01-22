// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title LiquidityProviderRegistry
 * @notice Market-based opt-in liquidity provider system
 * @dev LPs deposit liquidity with constraints (minHaircut, maxDelay) and earn settlement spreads
 *      Supports both native tokens (for redemption) and ERC20 tokens (for minting)
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
    // LP balances: (lp, asset) => balance (actual funds stored)
    mapping(address => mapping(address => uint256)) public lpBalances;
    
    address public owner;
    address public flipCore; // FLIPCore contract address
    address public escrowVault; // EscrowVault contract address

    // ============ ERC20 LIQUIDITY (for minting) ============

    // ERC20 balances: (lp, token) => balance
    mapping(address => mapping(address => uint256)) public erc20Balances;

    // ERC20 positions: (lp, token) => position
    mapping(address => mapping(address => LPPosition)) public erc20Positions;

    // Active ERC20 LPs per token
    mapping(address => address[]) public activeERC20LPs;

    // LP address => token => index in activeERC20LPs array
    mapping(address => mapping(address => uint256)) public erc20LpIndex;

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

    event ERC20LiquidityDeposited(
        address indexed lp,
        address indexed token,
        uint256 amount,
        uint256 minHaircut,
        uint256 maxDelay
    );

    event ERC20LiquidityWithdrawn(
        address indexed lp,
        address indexed token,
        uint256 amount
    );

    event ERC20LiquidityMatched(
        address indexed lp,
        address indexed token,
        uint256 amount,
        uint256 haircut
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
     * @notice Set EscrowVault address (owner only, one-time setup)
     * @param _escrowVault EscrowVault contract address
     */
    function setEscrowVault(address _escrowVault) external onlyOwner {
        require(_escrowVault != address(0), "LiquidityProviderRegistry: invalid address");
        require(escrowVault == address(0), "LiquidityProviderRegistry: already set");
        escrowVault = _escrowVault;
    }
    
    /**
     * @notice Deposit liquidity as LP
     * @param _asset Asset to provide liquidity for
     * @param _amount Amount to deposit
     * @param _minHaircut Minimum haircut LP accepts (scaled: 1000000 = 100%)
     * @param _maxDelay Maximum delay LP tolerates (seconds)
     * 
     * HAIRCUT CLEARING CONDITION (Appendix A):
     * The whitepaper specifies: H ≥ r · T
     * Where: H = haircut, r = LP opportunity cost, T = escrow duration
     * 
     * LPs set minHaircut based on their opportunity cost (r) and expected delay (T).
     * This ensures the clearing condition H ≥ r · T is satisfied for matched LPs.
     * 
     * Example: If LP has r = 5% annual (0.05) and T = 600s (0.000019 years),
     *          then minHaircut should be ≥ 0.05 × 0.000019 ≈ 0.0001% (100 scaled)
     *          In practice, LPs set higher minHaircut to account for risk and profit.
     */
    function depositLiquidity(
        address _asset,
        uint256 _amount,
        uint256 _minHaircut,
        uint256 _maxDelay
    ) external payable {
        require(_asset != address(0), "LiquidityProviderRegistry: invalid asset");
        require(_amount > 0, "LiquidityProviderRegistry: invalid amount");
        require(msg.value == _amount, "LiquidityProviderRegistry: amount mismatch");
        require(_minHaircut <= 1000000, "LiquidityProviderRegistry: invalid haircut");
        require(_maxDelay > 0, "LiquidityProviderRegistry: invalid delay");
        
        // Store the funds
        lpBalances[msg.sender][_asset] += _amount;
        
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
        require(lpBalances[msg.sender][_asset] >= _amount, "LiquidityProviderRegistry: insufficient balance");
        
        // Update balances
        lpBalances[msg.sender][_asset] -= _amount;
        position.availableAmount -= _amount;
        position.depositedAmount -= _amount;
        
        // If position fully withdrawn, remove from active list
        if (position.depositedAmount == 0) {
            position.active = false;
            _removeLP(_asset, msg.sender);
        }
        
        // Transfer funds back to LP
        payable(msg.sender).transfer(_amount);
        
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
            require(lpBalances[bestLP][_asset] >= _amount, "LiquidityProviderRegistry: insufficient LP balance");
            require(matchedPos.availableAmount >= _amount, "LiquidityProviderRegistry: insufficient available");
            
            // Update balances
            lpBalances[bestLP][_asset] -= _amount;
            matchedPos.availableAmount -= _amount;
            
            // Transfer funds to EscrowVault
            require(escrowVault != address(0), "LiquidityProviderRegistry: escrow vault not set");
            payable(escrowVault).transfer(_amount);
            
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

    // ============ ERC20 LIQUIDITY FUNCTIONS (for minting) ============

    /**
     * @notice Deposit ERC20 liquidity (for minting)
     * @param _token ERC20 token address (e.g., FXRP)
     * @param _amount Amount to deposit
     * @param _minHaircut Minimum haircut LP accepts (scaled: 1000000 = 100%)
     * @param _maxDelay Maximum delay LP tolerates (seconds)
     */
    function depositERC20Liquidity(
        address _token,
        uint256 _amount,
        uint256 _minHaircut,
        uint256 _maxDelay
    ) external {
        require(_token != address(0), "LiquidityProviderRegistry: invalid token");
        require(_amount > 0, "LiquidityProviderRegistry: invalid amount");
        require(_minHaircut <= 1000000, "LiquidityProviderRegistry: invalid haircut");
        require(_maxDelay > 0, "LiquidityProviderRegistry: invalid delay");

        // Transfer tokens from LP to registry
        require(
            IERC20(_token).transferFrom(msg.sender, address(this), _amount),
            "LiquidityProviderRegistry: transfer failed"
        );

        // Store the funds
        erc20Balances[msg.sender][_token] += _amount;

        LPPosition storage position = erc20Positions[msg.sender][_token];

        if (!position.active) {
            // New position - add to active LPs list
            position.active = true;
            erc20LpIndex[msg.sender][_token] = activeERC20LPs[_token].length;
            activeERC20LPs[_token].push(msg.sender);
        }

        position.lp = msg.sender;
        position.asset = _token;
        position.depositedAmount += _amount;
        position.availableAmount += _amount;
        position.minHaircut = _minHaircut; // Update to latest preference
        position.maxDelay = _maxDelay;     // Update to latest preference

        emit ERC20LiquidityDeposited(msg.sender, _token, _amount, _minHaircut, _maxDelay);
    }

    /**
     * @notice Withdraw ERC20 liquidity
     * @param _token ERC20 token address
     * @param _amount Amount to withdraw
     */
    function withdrawERC20Liquidity(address _token, uint256 _amount) external {
        require(_amount > 0, "LiquidityProviderRegistry: invalid amount");

        LPPosition storage position = erc20Positions[msg.sender][_token];
        require(position.active, "LiquidityProviderRegistry: no position");
        require(position.availableAmount >= _amount, "LiquidityProviderRegistry: insufficient available");
        require(erc20Balances[msg.sender][_token] >= _amount, "LiquidityProviderRegistry: insufficient balance");

        // Update balances
        erc20Balances[msg.sender][_token] -= _amount;
        position.availableAmount -= _amount;
        position.depositedAmount -= _amount;

        // If position fully withdrawn, remove from active list
        if (position.depositedAmount == 0) {
            position.active = false;
            _removeERC20LP(_token, msg.sender);
        }

        // Transfer tokens back to LP
        require(
            IERC20(_token).transfer(msg.sender, _amount),
            "LiquidityProviderRegistry: transfer failed"
        );

        emit ERC20LiquidityWithdrawn(msg.sender, _token, _amount);
    }

    /**
     * @notice Match ERC20 liquidity for minting
     * @param _token ERC20 token address
     * @param _amount Amount needed
     * @param _requestedHaircut Requested haircut (scaled: 1000000 = 100%)
     * @return lp Matched LP address (address(0) if no match)
     * @return availableAmount Available amount from matched LP
     */
    function matchERC20Liquidity(
        address _token,
        uint256 _amount,
        uint256 _requestedHaircut
    ) external onlyAuthorized returns (address lp, uint256 availableAmount) {
        address[] memory lps = activeERC20LPs[_token];

        // Find best LP match:
        // 1. minHaircut <= requestedHaircut
        // 2. availableAmount >= amount
        // 3. Prefer lower haircut (better UX)
        address bestLP = address(0);
        uint256 bestHaircut = 1000001; // Higher than max

        for (uint256 i = 0; i < lps.length; i++) {
            LPPosition memory pos = erc20Positions[lps[i]][_token];

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
            LPPosition storage matchedPos = erc20Positions[bestLP][_token];
            require(erc20Balances[bestLP][_token] >= _amount, "LiquidityProviderRegistry: insufficient LP balance");
            require(matchedPos.availableAmount >= _amount, "LiquidityProviderRegistry: insufficient available");

            // Update balances
            erc20Balances[bestLP][_token] -= _amount;
            matchedPos.availableAmount -= _amount;

            // Transfer to EscrowVault (for minting escrow)
            require(escrowVault != address(0), "LiquidityProviderRegistry: escrow vault not set");
            require(
                IERC20(_token).transfer(escrowVault, _amount),
                "LiquidityProviderRegistry: transfer to escrow failed"
            );

            emit ERC20LiquidityMatched(bestLP, _token, _amount, bestHaircut);
            return (bestLP, _amount);
        }

        return (address(0), 0);
    }

    /**
     * @notice Get ERC20 LP position
     * @param _lp LP address
     * @param _token Token address
     * @return position LP position struct
     */
    function getERC20Position(address _lp, address _token)
        external
        view
        returns (LPPosition memory position)
    {
        return erc20Positions[_lp][_token];
    }

    /**
     * @notice Get number of active ERC20 LPs for a token
     * @param _token Token address
     * @return count Number of active LPs
     */
    function getActiveERC20LPCount(address _token) external view returns (uint256 count) {
        return activeERC20LPs[_token].length;
    }

    /**
     * @notice Remove LP from active ERC20 list
     * @param _token Token address
     * @param _lp LP address to remove
     */
    function _removeERC20LP(address _token, address _lp) internal {
        uint256 index = erc20LpIndex[_lp][_token];
        uint256 lastIndex = activeERC20LPs[_token].length - 1;

        if (index != lastIndex) {
            address lastLP = activeERC20LPs[_token][lastIndex];
            activeERC20LPs[_token][index] = lastLP;
            erc20LpIndex[lastLP][_token] = index;
        }

        activeERC20LPs[_token].pop();
        delete erc20LpIndex[_lp][_token];
    }
}


