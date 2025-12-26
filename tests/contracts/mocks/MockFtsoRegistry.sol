// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../../contracts/interfaces/IFtsoRegistry.sol";

contract MockFtsoRegistry is IFtsoRegistry {
    mapping(string => address) public ftsoAddresses;
    mapping(string => uint256) public prices;
    mapping(string => uint256) public timestamps;

    constructor() {
        // Set default prices
        prices["XRP/USD"] = 1000000; // 1.0 USD scaled
        prices["BTC/USD"] = 50000000000; // 50000 USD scaled
        timestamps["XRP/USD"] = block.timestamp;
        timestamps["BTC/USD"] = block.timestamp;
    }

    function getFtsoBySymbol(string memory _symbol) external view override returns (address) {
        return ftsoAddresses[_symbol];
    }

    function getCurrentPriceWithDecimals(string memory _symbol)
        external
        view
        override
        returns (uint256 _price, uint256 _timestamp)
    {
        return (prices[_symbol], timestamps[_symbol]);
    }

    function setPrice(string memory _symbol, uint256 _price) external {
        prices[_symbol] = _price;
        timestamps[_symbol] = block.timestamp;
    }
}



