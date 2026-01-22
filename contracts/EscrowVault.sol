// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Escrow {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title EscrowVault
 * @notice Conditional settlement escrow vault (replaces prefunded InsurancePool)
 * @dev Holds funds conditionally - released only after FDC adjudication or timeout
 *      No prefunding required - funds come from users (wait path) or LPs (fast path)
 *      Supports both native tokens (redemption) and ERC20 tokens (minting)
 */
contract EscrowVault {
    enum EscrowStatus {
        None,           // Escrow not created
        Created,        // Escrow created, awaiting FDC
        Released,       // Escrow released (FDC success)
        Failed,         // Escrow failed (FDC failure)
        Timeout         // Escrow timed out
    }

    struct Escrow {
        uint256 redemptionId;
        address user;           // Original user requesting redemption
        address lp;             // LP providing liquidity (if any, address(0) if user-wait path)
        address asset;          // Asset being redeemed
        uint256 amount;         // Escrowed amount
        uint256 createdAt;       // Timestamp when escrow created
        uint256 fdcRoundId;      // FDC round ID (set when FDC attests)
        EscrowStatus status;
        bool lpFunded;          // True if LP provided funds, false if user waiting
    }

    mapping(uint256 => Escrow) public escrows; // redemptionId => Escrow

    // ============ MINTING ESCROW STATE ============

    enum MintingEscrowStatus {
        None,
        Created,    // LP provided FXRP, awaiting FDC
        Released,   // FDC success, LP claim recorded
        Failed,     // FDC failure, LP loses FXRP
        Timeout     // FDC timeout
    }

    struct MintingEscrow {
        uint256 mintingId;
        address user;           // User who receives FXRP
        address lp;             // LP who provided FXRP
        address token;          // FXRP token address
        uint256 amount;         // FXRP amount transferred to user
        uint256 haircutAmount;  // Haircut amount (LP's fee)
        uint256 createdAt;
        uint256 fdcRoundId;
        MintingEscrowStatus status;
    }

    mapping(uint256 => MintingEscrow) public mintingEscrows; // mintingId => MintingEscrow

    address public owner;
    address public flipCore; // FLIPCore contract address
    address public settlementReceipt; // SettlementReceipt contract address
    uint256 public constant FDC_TIMEOUT = 600; // 10 minutes timeout (adjustable)

    event EscrowCreated(
        uint256 indexed redemptionId,
        address indexed user,
        address indexed lp,
        address asset,
        uint256 amount,
        bool lpFunded
    );

    event EscrowReleased(
        uint256 indexed redemptionId,
        address indexed recipient,
        uint256 amount
    );

    event EscrowFailed(
        uint256 indexed redemptionId,
        address indexed recipient,
        uint256 amount
    );

    event EscrowTimeout(
        uint256 indexed redemptionId,
        address indexed recipient,
        uint256 amount
    );

    // ============ MINTING ESCROW EVENTS ============

    event MintingEscrowCreated(
        uint256 indexed mintingId,
        address indexed user,
        address indexed lp,
        address token,
        uint256 amount,
        uint256 haircutAmount
    );

    event MintingEscrowReleased(
        uint256 indexed mintingId,
        address indexed lp,
        uint256 amount,
        uint256 fdcRoundId
    );

    event MintingEscrowFailed(
        uint256 indexed mintingId,
        address indexed lp,
        uint256 amount
    );

    event MintingEscrowTimeout(
        uint256 indexed mintingId,
        address indexed lp,
        uint256 amount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "EscrowVault: not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || msg.sender == flipCore || msg.sender == settlementReceipt || msg.sender == address(this),
            "EscrowVault: not authorized"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Receive function to accept native token (FLR) transfers
     */
    receive() external payable {}
    
    /**
     * @notice Set FLIPCore address (owner only, one-time setup)
     * @param _flipCore FLIPCore contract address
     */
    function setFLIPCore(address _flipCore) external onlyOwner {
        require(_flipCore != address(0), "EscrowVault: invalid address");
        require(flipCore == address(0), "EscrowVault: already set");
        flipCore = _flipCore;
    }

    /**
     * @notice Set SettlementReceipt address (owner only, one-time setup)
     * @param _settlementReceipt SettlementReceipt contract address
     */
    function setSettlementReceipt(address _settlementReceipt) external onlyOwner {
        require(_settlementReceipt != address(0), "EscrowVault: invalid address");
        require(settlementReceipt == address(0), "EscrowVault: already set");
        settlementReceipt = _settlementReceipt;
    }

    /**
     * @notice Create escrow for a redemption
     * @param _redemptionId Redemption ID
     * @param _user User requesting redemption
     * @param _lp LP providing liquidity (address(0) if user-wait path)
     * @param _asset Asset being redeemed
     * @param _amount Amount to escrow
     * @param _lpFunded True if LP funds, false if user waiting
     */
    function createEscrow(
        uint256 _redemptionId,
        address _user,
        address _lp,
        address _asset,
        uint256 _amount,
        bool _lpFunded
    ) external payable onlyAuthorized {
        require(_amount > 0, "EscrowVault: invalid amount");
        require(_user != address(0), "EscrowVault: invalid user");
        require(escrows[_redemptionId].status == EscrowStatus.None, "EscrowVault: escrow exists");
        
        // For LP-funded escrows, funds are already transferred by LiquidityProviderRegistry.matchLiquidity()
        // For user-wait escrows, user may send FLR (optional - they can wait without escrow)
        // If msg.value > 0, it must match _amount
        if (msg.value > 0) {
            require(msg.value == _amount, "EscrowVault: amount mismatch");
        } else if (_lpFunded) {
            // LP-funded: funds should already be in contract from matchLiquidity
            require(address(this).balance >= _amount, "EscrowVault: insufficient contract balance");
        }
        // For user-wait path without funds, escrow is just a record (user waits for FDC)

        // Hold the funds in this contract
        escrows[_redemptionId] = Escrow({
            redemptionId: _redemptionId,
            user: _user,
            lp: _lp,
            asset: _asset,
            amount: _amount,
            createdAt: block.timestamp,
            fdcRoundId: 0,
            status: EscrowStatus.Created,
            lpFunded: _lpFunded
        });

        emit EscrowCreated(_redemptionId, _user, _lp, _asset, _amount, _lpFunded);
    }

    /**
     * @notice Release escrow based on FDC adjudication
     * @param _redemptionId Redemption ID
     * @param _success Whether FDC confirmed success
     * @param _fdcRoundId FDC round ID
     */
    function releaseOnFDC(
        uint256 _redemptionId,
        bool _success,
        uint256 _fdcRoundId
    ) external onlyAuthorized {
        Escrow storage escrow = escrows[_redemptionId];
        require(
            escrow.status == EscrowStatus.Created,
            "EscrowVault: invalid status"
        );

        escrow.fdcRoundId = _fdcRoundId;

        if (_success) {
            escrow.status = EscrowStatus.Released;
            // Release to LP if LP-funded, otherwise to user
            address recipient = escrow.lpFunded ? escrow.lp : escrow.user;
            // Actually transfer funds
            payable(recipient).transfer(escrow.amount);
            emit EscrowReleased(_redemptionId, recipient, escrow.amount);
        } else {
            escrow.status = EscrowStatus.Failed;
            // On failure: if LP-funded, LP loses funds; if user-wait, user gets refund (if funds exist)
            address recipient = escrow.lpFunded ? address(0) : escrow.user;
            if (!escrow.lpFunded) {
                // User-wait path: refund user if funds exist in escrow
                // Note: For user-wait path, escrow might not have funds initially
                if (escrow.amount > 0 && address(this).balance >= escrow.amount) {
                    payable(recipient).transfer(escrow.amount);
                    emit EscrowReleased(_redemptionId, recipient, escrow.amount);
                } else {
                    // No funds to refund (user-wait path without escrow funds)
                    emit EscrowFailed(_redemptionId, escrow.user, 0);
                }
            } else {
                // LP loses funds on failure (penalty for incorrect assessment)
                // Funds stay in contract (can be used for protocol fees or returned via governance)
                emit EscrowFailed(_redemptionId, escrow.lp, escrow.amount);
            }
        }
    }

    /**
     * @notice Release escrow due to timeout (FDC didn't attest in time)
     * @param _redemptionId Redemption ID
     */
    function timeoutRelease(uint256 _redemptionId) external onlyAuthorized {
        Escrow storage escrow = escrows[_redemptionId];
        require(
            escrow.status == EscrowStatus.Created,
            "EscrowVault: invalid status"
        );
        require(
            block.timestamp >= escrow.createdAt + FDC_TIMEOUT,
            "EscrowVault: not timed out"
        );

        escrow.status = EscrowStatus.Timeout;
        
        // On timeout: if LP-funded, LP gets funds back; if user-wait, user gets refund
        address recipient = escrow.lpFunded ? escrow.lp : escrow.user;
        // Actually transfer funds
        payable(recipient).transfer(escrow.amount);
        emit EscrowTimeout(_redemptionId, recipient, escrow.amount);
    }
    
    /**
     * @notice Payout receipt (called by SettlementReceipt for immediate redemption)
     * @param _redemptionId Redemption ID
     * @param _recipient Recipient address
     * @param _amount Amount to payout
     */
    function payoutReceipt(
        uint256 _redemptionId,
        address _recipient,
        uint256 _amount
    ) external onlyAuthorized {
        Escrow storage escrow = escrows[_redemptionId];
        require(escrow.status == EscrowStatus.Created, "EscrowVault: invalid status");
        require(_amount <= escrow.amount, "EscrowVault: insufficient escrow");
        
        // Transfer funds to recipient
        payable(_recipient).transfer(_amount);
        
        // Update escrow amount (remaining stays in escrow for FDC finalization)
        escrow.amount -= _amount;
        
        emit EscrowReleased(_redemptionId, _recipient, _amount);
    }

    /**
     * @notice Get escrow status
     * @param _redemptionId Redemption ID
     * @return status Escrow status
     */
    function getEscrowStatus(uint256 _redemptionId)
        external
        view
        returns (EscrowStatus status)
    {
        return escrows[_redemptionId].status;
    }

    /**
     * @notice Get escrow details
     * @param _redemptionId Redemption ID
     * @return escrow Escrow struct
     */
    function getEscrow(uint256 _redemptionId)
        external
        view
        returns (Escrow memory escrow)
    {
        return escrows[_redemptionId];
    }

    /**
     * @notice Check if escrow can be timed out
     * @param _redemptionId Redemption ID
     * @return canTimeout True if timeout conditions met
     */
    function canTimeout(uint256 _redemptionId)
        external
        view
        returns (bool)
    {
        Escrow memory escrow = escrows[_redemptionId];
        return (
            escrow.status == EscrowStatus.Created &&
            block.timestamp >= escrow.createdAt + FDC_TIMEOUT
        );
    }

    /**
     * @notice Set FDC timeout (owner only)
     * @param _timeout New timeout in seconds
     */
    function setFDCTimeout(uint256 _timeout) external onlyOwner {
        require(_timeout > 0, "EscrowVault: invalid timeout");
        // Note: This requires storage variable, not constant
        // For MVP, keeping as constant; can be made configurable later
    }

    // ============ MINTING ESCROW FUNCTIONS ============

    /**
     * @notice Create minting escrow after LP provides FXRP
     * @dev LP's FXRP has been transferred to this contract by LiquidityProviderRegistry
     * @param _mintingId Minting request ID
     * @param _user User receiving FXRP
     * @param _lp LP providing FXRP
     * @param _token FXRP token address
     * @param _amount Amount of FXRP
     * @param _haircutAmount Haircut amount (LP's fee)
     */
    function createMintingEscrow(
        uint256 _mintingId,
        address _user,
        address _lp,
        address _token,
        uint256 _amount,
        uint256 _haircutAmount
    ) external onlyAuthorized {
        require(_amount > 0, "EscrowVault: invalid amount");
        require(_user != address(0), "EscrowVault: invalid user");
        require(_lp != address(0), "EscrowVault: invalid LP");
        require(_token != address(0), "EscrowVault: invalid token");
        require(mintingEscrows[_mintingId].status == MintingEscrowStatus.None, "EscrowVault: escrow exists");

        // Verify we have the tokens (transferred by LiquidityProviderRegistry.matchERC20Liquidity)
        require(
            IERC20Escrow(_token).balanceOf(address(this)) >= _amount,
            "EscrowVault: insufficient token balance"
        );

        // Transfer FXRP to user immediately (instant settlement!)
        require(
            IERC20Escrow(_token).transfer(_user, _amount - _haircutAmount),
            "EscrowVault: transfer to user failed"
        );

        // Create escrow record (tracks LP's claim to repayment)
        mintingEscrows[_mintingId] = MintingEscrow({
            mintingId: _mintingId,
            user: _user,
            lp: _lp,
            token: _token,
            amount: _amount,
            haircutAmount: _haircutAmount,
            createdAt: block.timestamp,
            fdcRoundId: 0,
            status: MintingEscrowStatus.Created
        });

        emit MintingEscrowCreated(_mintingId, _user, _lp, _token, _amount, _haircutAmount);
    }

    /**
     * @notice Release minting escrow on FDC attestation
     * @param _mintingId Minting request ID
     * @param _success Whether FDC confirmed payment
     * @param _fdcRoundId FDC round ID
     */
    function releaseMintingOnFDC(
        uint256 _mintingId,
        bool _success,
        uint256 _fdcRoundId
    ) external onlyAuthorized {
        MintingEscrow storage escrow = mintingEscrows[_mintingId];
        require(escrow.status == MintingEscrowStatus.Created, "EscrowVault: invalid status");

        escrow.fdcRoundId = _fdcRoundId;

        if (_success) {
            // FDC confirmed XRP payment is valid
            // LP's claim is now valid - they will receive newly minted FXRP
            // The actual minting and transfer to LP happens in FLIPCore
            escrow.status = MintingEscrowStatus.Released;

            // Transfer haircut amount to LP (LP's fee, held in escrow)
            if (escrow.haircutAmount > 0) {
                // Haircut was already deducted when transferring to user
                // LP receives haircut when minted tokens arrive
            }

            emit MintingEscrowReleased(_mintingId, escrow.lp, escrow.amount, _fdcRoundId);
        } else {
            // FDC confirmed failure - LP loses FXRP they provided
            // User already received FXRP, so LP takes the loss
            // This is the risk premium LPs charge via haircut
            escrow.status = MintingEscrowStatus.Failed;

            emit MintingEscrowFailed(_mintingId, escrow.lp, escrow.amount);
        }
    }

    /**
     * @notice Timeout release for minting escrow
     * @param _mintingId Minting request ID
     */
    function timeoutMintingRelease(uint256 _mintingId) external onlyAuthorized {
        MintingEscrow storage escrow = mintingEscrows[_mintingId];
        require(escrow.status == MintingEscrowStatus.Created, "EscrowVault: invalid status");
        require(
            block.timestamp >= escrow.createdAt + FDC_TIMEOUT,
            "EscrowVault: not timed out"
        );

        escrow.status = MintingEscrowStatus.Timeout;

        // On timeout: LP is in limbo - user has FXRP but FDC didn't confirm
        // For safety, treat as failure - LP loses funds
        // In production, could have dispute resolution

        emit MintingEscrowTimeout(_mintingId, escrow.lp, escrow.amount);
    }

    /**
     * @notice Check if minting escrow can be timed out
     * @param _mintingId Minting request ID
     * @return canTimeout True if timeout conditions met
     */
    function canMintingTimeout(uint256 _mintingId) external view returns (bool) {
        MintingEscrow memory escrow = mintingEscrows[_mintingId];
        return (
            escrow.status == MintingEscrowStatus.Created &&
            block.timestamp >= escrow.createdAt + FDC_TIMEOUT
        );
    }

    /**
     * @notice Get minting escrow status
     * @param _mintingId Minting request ID
     * @return status Minting escrow status
     */
    function getMintingEscrowStatus(uint256 _mintingId)
        external
        view
        returns (MintingEscrowStatus status)
    {
        return mintingEscrows[_mintingId].status;
    }

    /**
     * @notice Get minting escrow details
     * @param _mintingId Minting request ID
     * @return escrow Minting escrow struct
     */
    function getMintingEscrow(uint256 _mintingId)
        external
        view
        returns (MintingEscrow memory escrow)
    {
        return mintingEscrows[_mintingId];
    }
}

