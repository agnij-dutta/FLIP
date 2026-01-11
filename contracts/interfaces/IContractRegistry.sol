// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IContractRegistry
 * @notice Interface for Flare ContractRegistry
 * @dev Provides access to Flare system contracts
 */
interface IContractRegistry {
    /**
     * @notice Get FTSOv2 contract address
     * @return FTSOv2 contract address
     */
    function getFtsoV2() external view returns (address);
    
    /**
     * @notice Get TestFTSOv2 contract address (for testnets)
     * @return TestFTSOv2 contract address
     */
    function getTestFtsoV2() external view returns (address);
    
    /**
     * @notice Get FDC Verification contract address
     * @return FDC Verification contract address
     */
    function getFdcVerification() external view returns (address);
    
    /**
     * @notice Get State Connector contract address
     * @return State Connector contract address
     */
    function getStateConnector() external view returns (address);
}

