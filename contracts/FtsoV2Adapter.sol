// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IFtsoV2.sol";
import "./interfaces/IFtsoRegistry.sol";

/**
 * @title FtsoV2Adapter
 * @notice Adapter to convert between IFtsoRegistry (string symbols) and IFtsoV2 (bytes21 feed IDs)
 * @dev Maps asset addresses to feed IDs and converts between interfaces
 */
contract FtsoV2Adapter is IFtsoRegistry {
    IFtsoV2 public immutable ftsoV2;
    
    // Mapping from asset address to feed ID (bytes21)
    mapping(address => bytes21) public assetToFeedId;
    
    // Owner for configuration
    address public owner;
    
    event FeedIdSet(address indexed asset, bytes21 feedId);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "FtsoV2Adapter: not owner");
        _;
    }
    
    constructor(address _ftsoV2) {
        ftsoV2 = IFtsoV2(_ftsoV2);
        owner = msg.sender;
        
        // Set default feed IDs for common assets
        // XRP/USD: 0x015852502f55534400000000000000000000000000
        // FLR/USD: 0x01464c522f55534400000000000000000000000000
        // BTC/USD: 0x014254432f55534400000000000000000000000000
    }
    
    /**
     * @notice Set feed ID for an asset
     * @param _asset Asset address
     * @param _feedId Feed ID (bytes21)
     */
    function setFeedId(address _asset, bytes21 _feedId) external onlyOwner {
        assetToFeedId[_asset] = _feedId;
        emit FeedIdSet(_asset, _feedId);
    }
    
    /**
     * @notice Get FTSO contract address by symbol (not used, returns zero)
     * @dev Required by IFtsoRegistry interface but not used
     */
    function getFtsoBySymbol(string memory) external pure returns (address) {
        return address(0);
    }
    
    /**
     * @notice Get current price with decimals for a symbol
     * @param _symbol Asset symbol (e.g., "XRP/USD")
     * @return _price Current price (with decimals)
     * @return _timestamp Timestamp of the price update
     * @dev This function is for backward compatibility
     *      In production, use getFeedById directly with bytes21 feed ID
     */
    function getCurrentPriceWithDecimals(string memory _symbol)
        external
        view
        returns (uint256 _price, uint256 _timestamp)
    {
        // Convert symbol to feed ID (simplified - in production use mapping)
        bytes21 feedId = _symbolToFeedId(_symbol);
        (uint256 value, int8 decimals, uint64 timestamp) = ftsoV2.getFeedById(feedId);
        
        // Adjust for decimals
        if (decimals >= 0) {
            _price = value * (10 ** uint8(decimals));
        } else {
            _price = value / (10 ** uint8(-decimals));
        }
        
        _timestamp = uint256(timestamp);
    }
    
    /**
     * @notice Get price for an asset address (uses feed ID mapping)
     * @param _asset Asset address
     * @return price Current price (scaled to 18 decimals)
     * @return timestamp Timestamp
     */
    function getPriceForAsset(address _asset)
        external
        view
        returns (uint256 price, uint256 timestamp)
    {
        bytes21 feedId = assetToFeedId[_asset];
        require(feedId != bytes21(0), "FtsoV2Adapter: feed ID not set");
        
        (uint256 value, int8 decimals, uint64 ts) = ftsoV2.getFeedById(feedId);
        
        // Normalize to 18 decimals
        if (decimals >= 0) {
            if (uint8(decimals) < 18) {
                price = value * (10 ** (18 - uint8(decimals)));
            } else {
                price = value / (10 ** (uint8(decimals) - 18));
            }
        } else {
            price = value * (10 ** (18 + uint8(-decimals)));
        }
        
        timestamp = uint256(ts);
    }
    
    /**
     * @notice Convert symbol string to feed ID (bytes21)
     * @param _symbol Asset symbol
     * @return feedId Feed ID
     * @dev Simplified conversion - in production use proper mapping
     */
    function _symbolToFeedId(string memory _symbol) internal pure returns (bytes21) {
        // Common feed IDs
        bytes memory symbolBytes = bytes(_symbol);
        
        // XRP/USD
        if (keccak256(symbolBytes) == keccak256("XRP/USD")) {
            return bytes21(0x015852502f55534400000000000000000000000000);
        }
        // FLR/USD
        if (keccak256(symbolBytes) == keccak256("FLR/USD")) {
            return bytes21(0x01464c522f55534400000000000000000000000000);
        }
        // BTC/USD
        if (keccak256(symbolBytes) == keccak256("BTC/USD")) {
            return bytes21(0x014254432f55534400000000000000000000000000);
        }
        // ETH/USD
        if (keccak256(symbolBytes) == keccak256("ETH/USD")) {
            return bytes21(0x014554482f55534400000000000000000000000000);
        }
        
        // Default to XRP/USD
        return bytes21(0x015852502f55534400000000000000000000000000);
    }
}

