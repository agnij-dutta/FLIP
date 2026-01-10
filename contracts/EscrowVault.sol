// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title EscrowVault
 * @notice Conditional settlement escrow vault (replaces prefunded InsurancePool)
 * @dev Holds funds conditionally - released only after FDC adjudication or timeout
 *      No prefunding required - funds come from users (wait path) or LPs (fast path)
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
    address public owner;
    address public flipCore; // FLIPCore contract address
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

    modifier onlyOwner() {
        require(msg.sender == owner, "EscrowVault: not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || msg.sender == flipCore || msg.sender == address(this),
            "EscrowVault: not authorized"
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
        require(_flipCore != address(0), "EscrowVault: invalid address");
        require(flipCore == address(0), "EscrowVault: already set");
        flipCore = _flipCore;
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
    ) external onlyAuthorized {
        require(_amount > 0, "EscrowVault: invalid amount");
        require(_user != address(0), "EscrowVault: invalid user");
        require(escrows[_redemptionId].status == EscrowStatus.None, "EscrowVault: escrow exists");

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
            emit EscrowReleased(_redemptionId, recipient, escrow.amount);
        } else {
            escrow.status = EscrowStatus.Failed;
            // On failure: if LP-funded, LP loses funds; if user-wait, user gets refund
            address recipient = escrow.lpFunded ? address(0) : escrow.user;
            if (!escrow.lpFunded) {
                emit EscrowReleased(_redemptionId, recipient, escrow.amount);
            } else {
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
        
        // On timeout: if LP-funded, LP gets funds back; if user-wait, user waits longer
        // In production, this might trigger Firelight or other resolution
        address recipient = escrow.lpFunded ? escrow.lp : escrow.user;
        emit EscrowTimeout(_redemptionId, recipient, escrow.amount);
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
        returns (bool canTimeout)
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
}

