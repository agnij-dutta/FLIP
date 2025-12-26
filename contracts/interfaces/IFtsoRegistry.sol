// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFtsoRegistry
 * @notice Interface for FTSOv2 Registry contract
 * @dev Registry manages all FTSO feeds and provides symbol-based lookups
 */
interface IFtsoRegistry {
    /**
     * @notice Get FTSO contract address by symbol
     * @param _symbol Asset symbol (e.g., "XRP/USD", "BTC/USD")
     * @return FTSO contract address for the given symbol
     */
    function getFtsoBySymbol(string memory _symbol) external view returns (address);

    /**
     * @notice Get current price with decimals for a symbol
     * @param _symbol Asset symbol (e.g., "XRP/USD", "BTC/USD")
     * @return _price Current price (with decimals)
     * @return _timestamp Timestamp of the price update
     */
    function getCurrentPriceWithDecimals(string memory _symbol)
        external
        view
        returns (uint256 _price, uint256 _timestamp);
}



