// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/FLIPCore.sol";
import "../../contracts/InsurancePool.sol";
import "../../contracts/PriceHedgePool.sol";
import "../../contracts/OperatorRegistry.sol";
import "../contracts/mocks/MockFtsoRegistry.sol";
import "../contracts/mocks/MockStateConnector.sol";
import "../contracts/mocks/MockFAsset.sol";

/**
 * @title FullFlowTest
 * @notice Integration test for complete FLIP redemption flow
 */
contract FullFlowTest is Test {
    FLIPCore public flipCore;
    InsurancePool public insurancePool;
    PriceHedgePool public priceHedgePool;
    OperatorRegistry public operatorRegistry;
    MockFtsoRegistry public ftsoRegistry;
    MockStateConnector public stateConnector;
    MockFAsset public fAsset;

    address public user = address(0x1);
    address public operator = address(0x2);

    function setUp() public {
        // Deploy all contracts
        ftsoRegistry = new MockFtsoRegistry();
        stateConnector = new MockStateConnector();
        insurancePool = new InsurancePool();
        priceHedgePool = new PriceHedgePool(address(ftsoRegistry));
        operatorRegistry = new OperatorRegistry(1000 ether);

        flipCore = new FLIPCore(
            address(ftsoRegistry),
            address(stateConnector),
            address(insurancePool),
            address(priceHedgePool),
            address(operatorRegistry)
        );

        // Deploy mock FAsset
        fAsset = new MockFAsset();
        
        // Setup
        vm.deal(user, 10000 ether);
        vm.deal(operator, 10000 ether);
        vm.deal(address(this), 100000 ether);
        
        // Fund insurance pool (as owner)
        insurancePool.replenishPool{value: 100000 ether}();
        
        // Register operator (automatic on first stake)
        vm.prank(operator);
        operatorRegistry.stake{value: 200000 ether}(200000 ether);
    }

    /**
     * @notice Test complete flow: Request → High Confidence → Provisional → FDC Success
     */
    function testFullFlow_ProvisionalSuccess() public {
        uint256 amount = 100 ether;

        // 1. User requests redemption
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();
        
        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)),
            uint8(FLIPCore.RedemptionStatus.Pending),
            "Should be pending"
        );

        // 2. Evaluate redemption (high confidence)
        (uint8 decision, uint256 score) = flipCore.evaluateRedemption(
            redemptionId,
            5000, // 0.5% volatility (very low)
            995000, // 99.5% agent success rate
            200000 ether // High stake
        );

        assertEq(decision, 2, "Should be ProvisionalSettle");
        assertGe(score, 997000, "Score should be >= 99.7%");

        // 3. Finalize provisional settlement
        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            5000,
            995000,
            200000 ether
        );

        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)),
            uint8(FLIPCore.RedemptionStatus.ProvisionallySettled),
            "Should be provisionally settled"
        );

        // 4. FDC confirms success
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 1, true);

        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)),
            uint8(FLIPCore.RedemptionStatus.Finalized),
            "Should be finalized"
        );
    }

    /**
     * @notice Test flow: Request → High Confidence → Provisional → FDC Failure → Insurance
     */
    function testFullFlow_ProvisionalFailure() public {
        uint256 amount = 100 ether;

        // 1. Request redemption
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();

        // 2. Finalize provisional (high confidence)
        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            5000,
            995000,
            200000 ether
        );

        // 3. FDC confirms failure
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 1, false);

        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)),
            uint8(FLIPCore.RedemptionStatus.InsuranceClaimed),
            "Should trigger insurance claim"
        );
    }

    /**
     * @notice Test flow: Request → Low Confidence → Queue FDC → FDC Success
     */
    function testFullFlow_QueueFDC() public {
        uint256 amount = 100000 ether; // Large amount

        // 1. Request redemption
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();

        // 2. Evaluate (low confidence)
        (uint8 decision, uint256 score) = flipCore.evaluateRedemption(
            redemptionId,
            60000, // 6% volatility (high)
            900000, // 90% agent success rate
            50000 ether // Low stake
        );

        assertEq(decision, 0, "Should be QueueFDC");
        assertLt(score, 950000, "Score should be < 95%");

        // 3. Queue for FDC (no provisional)
        vm.prank(operator);
        flipCore.queueForFDC(redemptionId);

        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)),
            uint8(FLIPCore.RedemptionStatus.QueuedForFDC),
            "Should be queued for FDC"
        );

        // 4. FDC confirms success
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 1, true);

        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)),
            uint8(FLIPCore.RedemptionStatus.Finalized),
            "Should be finalized"
        );
    }

    /**
     * @notice Test multiple redemptions with different scores
     */
    function testMultipleRedemptions() public {
        // Redemption 1: High confidence
        vm.startPrank(user);
        fAsset.mint(user, 100 ether);
        uint256 redemptionId1 = flipCore.requestRedemption(100 ether, address(fAsset));
        vm.stopPrank();
        
        (uint8 decision1, ) = flipCore.evaluateRedemption(
            redemptionId1,
            5000, // Very low volatility
            995000, // Very high agent rate
            200000 ether
        );
        assertEq(decision1, 2, "Redemption 1 should be high confidence");

        // Redemption 2: Medium confidence
        vm.startPrank(user);
        fAsset.mint(user, 5000 ether);
        uint256 redemptionId2 = flipCore.requestRedemption(5000 ether, address(fAsset));
        vm.stopPrank();
        
        (uint8 decision2, ) = flipCore.evaluateRedemption(
            redemptionId2,
            30000, // Medium volatility
            970000, // Medium agent rate
            150000 ether
        );
        assertEq(decision2, 1, "Redemption 2 should be medium confidence");

        // Redemption 3: Low confidence
        vm.startPrank(user);
        fAsset.mint(user, 100000 ether);
        uint256 redemptionId3 = flipCore.requestRedemption(100000 ether, address(fAsset));
        vm.stopPrank();
        
        (uint8 decision3, ) = flipCore.evaluateRedemption(
            redemptionId3,
            60000, // High volatility
            900000, // Low agent rate
            50000 ether
        );
        assertEq(decision3, 0, "Redemption 3 should be low confidence");
    }
}

