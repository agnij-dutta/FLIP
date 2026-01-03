// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/FLIPCore.sol";
import "../../contracts/InsurancePool.sol";
import "../../contracts/PriceHedgePool.sol";
import "../../contracts/OperatorRegistry.sol";
import "../../contracts/DeterministicScoring.sol";
import "./mocks/MockFtsoRegistry.sol";
import "./mocks/MockStateConnector.sol";
import "./mocks/MockFAsset.sol";

contract FLIPCoreTest is Test {
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
        // Deploy mocks
        ftsoRegistry = new MockFtsoRegistry();
        stateConnector = new MockStateConnector();
        insurancePool = new InsurancePool();
        priceHedgePool = new PriceHedgePool(address(ftsoRegistry));
        operatorRegistry = new OperatorRegistry(1000 ether);

        // Deploy FLIPCore (no OracleRelay needed)
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
        
        // Mint FAsset tokens to user
        fAsset.mint(user, 10000 ether);
        
        // Register operator (automatic on first stake)
        vm.prank(operator);
        operatorRegistry.stake{value: 1000 ether}(1000 ether);
    }

    function testRequestRedemption() public {
        uint256 amount = 100 ether;
        
        // User must approve or have balance
        vm.startPrank(user);
        fAsset.mint(user, amount); // Ensure user has tokens
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();

        assertEq(redemptionId, 0, "First redemption should be ID 0");
        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)), 
            uint8(FLIPCore.RedemptionStatus.Pending),
            "Should be pending"
        );
    }

    function testFinalizeProvisional() public {
        uint256 amount = 100 ether;
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();

        // Fund insurance pool
        vm.deal(address(insurancePool), 10000 ether);
        insurancePool.replenishPool{value: 10000 ether}();

        // Calculate score parameters (high confidence scenario)
        uint256 priceVolatility = 5000; // 0.5% (very low volatility)
        uint256 agentSuccessRate = 995000; // 99.5% success rate
        uint256 agentStake = 200000 ether; // High stake

        // Finalize provisional with deterministic scoring
        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            priceVolatility,
            agentSuccessRate,
            agentStake
        );

        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)), 
            uint8(FLIPCore.RedemptionStatus.ProvisionallySettled),
            "Should be provisionally settled"
        );
    }

    function testEvaluateRedemption() public {
        uint256 amount = 100 ether;
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();

        // Test evaluation with high confidence parameters
        uint256 priceVolatility = 5000; // 0.5%
        uint256 agentSuccessRate = 995000; // 99.5%
        uint256 agentStake = 200000 ether;

        (uint8 decision, uint256 score) = flipCore.evaluateRedemption(
            redemptionId,
            priceVolatility,
            agentSuccessRate,
            agentStake
        );

        // Should be high confidence (decision = 2 = ProvisionalSettle)
        assertGe(score, 997000, "Score should be >= 99.7%");
        assertEq(decision, 2, "Decision should be ProvisionalSettle");
    }

    function testEvaluateRedemption_LowConfidence() public {
        uint256 amount = 100000 ether; // Large amount
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();

        // Test evaluation with low confidence parameters
        uint256 priceVolatility = 60000; // 6% (high volatility)
        uint256 agentSuccessRate = 900000; // 90%
        uint256 agentStake = 50000 ether; // Low stake

        (uint8 decision, uint256 score) = flipCore.evaluateRedemption(
            redemptionId,
            priceVolatility,
            agentSuccessRate,
            agentStake
        );

        // Should be low confidence (decision = 0 = QueueFDC)
        assertLt(score, 950000, "Score should be < 95%");
        assertEq(decision, 0, "Decision should be QueueFDC");
    }

    function testFinalizeProvisional_RejectsLowScore() public {
        uint256 amount = 100 ether;
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();

        // Fund insurance pool
        vm.deal(address(insurancePool), 10000 ether);
        insurancePool.replenishPool{value: 10000 ether}();

        // Low confidence parameters
        uint256 priceVolatility = 60000; // 6%
        uint256 agentSuccessRate = 900000; // 90%
        uint256 agentStake = 50000 ether;

        // Should revert - score too low
        vm.prank(operator);
        vm.expectRevert("FLIPCore: score too low for provisional settlement");
        flipCore.finalizeProvisional(
            redemptionId,
            priceVolatility,
            agentSuccessRate,
            agentStake
        );
    }

    function testClaimFailure() public {
        uint256 amount = 100 ether;
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));
        vm.stopPrank();

        // Fund insurance pool
        vm.deal(address(insurancePool), 10000 ether);
        insurancePool.replenishPool{value: 10000 ether}();

        // Finalize provisional with high confidence parameters
        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            5000, // 0.5% volatility
            995000, // 99.5% agent success rate
            200000 ether // High stake
        );

        // FDC confirms failure
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 1, false);

        assertEq(uint8(flipCore.getRedemptionStatus(redemptionId)), uint8(FLIPCore.RedemptionStatus.InsuranceClaimed));
    }
}



