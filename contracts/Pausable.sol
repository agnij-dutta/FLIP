// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Pausable
 * @notice Simple pause mechanism for FLIPCore
 * @dev Allows owner to pause new redemptions while existing escrows continue
 */
contract Pausable {
    bool public paused;
    address public owner;
    
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Pausable: not owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Pausable: paused");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Set owner (for contracts that need to set owner after deployment)
     */
    function setOwner(address _owner) internal {
        owner = _owner;
    }
    
    /**
     * @notice Pause the contract (blocks new redemptions)
     * @dev Existing escrows are unaffected
     */
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }
    
    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }
}

