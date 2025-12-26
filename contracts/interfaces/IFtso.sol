// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFtso
 * @notice Interface for Flare Time Series Oracle (FTSOv2) individual feed contracts
 * @dev FTSOv2 provides block-latency price feeds updating every ~1.8 seconds
 *      with ~100 independent data providers selected via VRF
 */
interface IFtso {
    /**
     * @notice Get the current price and timestamp for this FTSO feed
     * @return _price Current price (with decimals)
     * @return _timestamp Timestamp of the price update
     */
    function getCurrentPrice() external view returns (uint256 _price, uint256 _timestamp);

    /**
     * @notice Get price for a specific epoch ID
     * @param _epochId The epoch ID to query
     * @return _price Price at that epoch (with decimals)
     * @return _timestamp Timestamp of the price update
     */
    function getPrice(uint256 _epochId) external view returns (uint256 _price, uint256 _timestamp);

    /**
     * @notice Get price from trusted providers for a specific epoch
     * @param _epochId The epoch ID to query
     * @return _price Price from trusted providers
     */
    function getPriceFromTrustedProviders(uint256 _epochId) external view returns (uint256 _price);
}



