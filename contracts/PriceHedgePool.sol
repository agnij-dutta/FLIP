// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IFtsoRegistry.sol";

/**
 * @title PriceHedgePool
 * @notice Price Hedge Pool (PHP) with FTSO integration
 * @dev Locks prices at redemption request and hedges against price movements
 */
contract PriceHedgePool {
    struct Hedge {
        address asset;
        uint256 amount;
        uint256 lockedPrice;
        uint256 lockedAt;
        bool settled;
    }

    IFtsoRegistry public immutable ftsoRegistry;
    mapping(uint256 => Hedge) public hedges;
    uint256 public nextHedgeId;
    uint256 public constant HEDGE_TOLERANCE_PERCENT = 10000; // 1% = 10000/1000000
    uint256 public poolBalance; // FLR/stables for hedging

    event PriceLocked(uint256 indexed hedgeId, address asset, uint256 price, uint256 amount);
    event HedgeSettled(uint256 indexed hedgeId, int256 priceDelta, uint256 payout);

    constructor(address _ftsoRegistry) {
        ftsoRegistry = IFtsoRegistry(_ftsoRegistry);
    }

    /**
     * @notice Lock price for an asset at redemption request
     * @param _asset Asset address
     * @param _amount Amount being hedged
     * @return lockedPrice Locked price from FTSO
     * @return hedgeId Hedge ID
     */
    function lockPrice(address _asset, uint256 _amount)
        external
        returns (uint256 lockedPrice, uint256 hedgeId)
    {
        string memory symbol = _getAssetSymbol(_asset);
        (uint256 price, uint256 timestamp) = ftsoRegistry.getCurrentPriceWithDecimals(symbol);

        hedgeId = nextHedgeId++;
        
        hedges[hedgeId] = Hedge({
            asset: _asset,
            amount: _amount,
            lockedPrice: price,
            lockedAt: timestamp,
            settled: false
        });

        emit PriceLocked(hedgeId, _asset, price, _amount);
        return (price, hedgeId);
    }

    /**
     * @notice Check if price movement is within tolerance
     * @param _hedgeId Hedge ID
     * @return withinTolerance True if price moved within 1% tolerance
     */
    function checkHedgeTolerance(uint256 _hedgeId) external view returns (bool withinTolerance) {
        Hedge memory hedge = hedges[_hedgeId];
        require(!hedge.settled, "PriceHedgePool: hedge already settled");

        string memory symbol = _getAssetSymbol(hedge.asset);
        (uint256 currentPrice, ) = ftsoRegistry.getCurrentPriceWithDecimals(symbol);

        uint256 priceDelta = currentPrice > hedge.lockedPrice
            ? currentPrice - hedge.lockedPrice
            : hedge.lockedPrice - currentPrice;
        
        uint256 tolerance = (hedge.lockedPrice * HEDGE_TOLERANCE_PERCENT) / 1000000;
        
        return priceDelta <= tolerance;
    }

    /**
     * @notice Settle hedge and pay out if price moved beyond tolerance
     * @param _hedgeId Hedge ID
     */
    function settleHedge(uint256 _hedgeId) external {
        Hedge storage hedge = hedges[_hedgeId];
        require(!hedge.settled, "PriceHedgePool: hedge already settled");

        string memory symbol = _getAssetSymbol(hedge.asset);
        (uint256 currentPrice, ) = ftsoRegistry.getCurrentPriceWithDecimals(symbol);

        int256 priceDelta;
        if (currentPrice > hedge.lockedPrice) {
            priceDelta = int256(currentPrice - hedge.lockedPrice);
        } else {
            priceDelta = -int256(hedge.lockedPrice - currentPrice);
        }

        uint256 tolerance = (hedge.lockedPrice * HEDGE_TOLERANCE_PERCENT) / 1000000;
        uint256 absDelta = uint256(priceDelta < 0 ? -priceDelta : priceDelta);

        uint256 payout = 0;
        if (absDelta > tolerance) {
            // Price moved beyond tolerance - calculate payout
            uint256 excessDelta = absDelta - tolerance;
            payout = (hedge.amount * excessDelta) / hedge.lockedPrice;
            
            require(poolBalance >= payout, "PriceHedgePool: insufficient pool");
            poolBalance -= payout;
        }

        hedge.settled = true;
        emit HedgeSettled(_hedgeId, priceDelta, payout);
    }

    /**
     * @notice Fund the hedge pool
     */
    function fundPool() external payable {
        poolBalance += msg.value;
    }

    /**
     * @notice Get asset symbol for FTSO lookup
     */
    function _getAssetSymbol(address _asset) internal pure returns (string memory) {
        // In production, this would be a mapping
        return "XRP/USD"; // Default, should be configurable
    }
}



