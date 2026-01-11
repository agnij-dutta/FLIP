// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFtsoV2
 * @notice Interface for FTSOv2 contract (matches Flare's actual FTSOv2)
 * @dev FTSOv2 uses bytes21 feed IDs instead of string symbols
 *      Feed IDs: https://dev.flare.network/ftso/feeds
 */
interface IFtsoV2 {
    /**
     * @notice Get feed value by feed ID
     * @param _feedId Feed ID (bytes21, e.g., XRP/USD: 0x015852502f55534400000000000000000000000000)
     * @return value Feed value
     * @return decimals Number of decimals (int8, can be negative)
     * @return timestamp Timestamp of the price update
     */
    function getFeedById(bytes21 _feedId)
        external
        view
        returns (uint256 value, int8 decimals, uint64 timestamp);

    /**
     * @notice Get feed value in Wei (no decimals adjustment needed)
     * @param _feedId Feed ID (bytes21)
     * @return value Feed value in Wei
     * @return timestamp Timestamp of the price update
     */
    function getFeedByIdInWei(bytes21 _feedId)
        external
        view
        returns (uint256 value, uint64 timestamp);

    /**
     * @notice Get multiple feed values
     * @param _feedIds Array of feed IDs
     * @return values Array of feed values
     * @return decimalsArray Array of decimals
     * @return timestamp Timestamp (same for all feeds)
     */
    function getFeedsById(bytes21[] calldata _feedIds)
        external
        view
        returns (
            uint256[] memory values,
            int8[] memory decimalsArray,
            uint64 timestamp
        );
}

