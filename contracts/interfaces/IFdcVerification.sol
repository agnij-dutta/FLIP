// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFdcVerification
 * @notice Interface for FDC Verification contract (matches Flare's actual FDC)
 * @dev FDC provides cross-chain attestations with Merkle proof verification
 */
interface IFdcVerification {
    /**
     * @notice Verify an EVM transaction proof
     * @param _proof Transaction proof data
     * @return True if proof is valid
     */
    function verifyEVMTransaction(bytes calldata _proof) external view returns (bool);
    
    /**
     * @notice Get the current FDC round ID
     * @return Current round ID
     */
    function getCurrentRound() external view returns (uint256);
}

