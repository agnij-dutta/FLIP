// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/FLIPCore.sol";
import "../../contracts/EscrowVault.sol";
import "../../contracts/SettlementReceipt.sol";
import "../../contracts/LiquidityProviderRegistry.sol";
import "../../contracts/PriceHedgePool.sol";
import "../../contracts/OperatorRegistry.sol";
import "../../contracts/DeterministicScoring.sol";
import "./mocks/MockFtsoRegistry.sol";
import "./mocks/MockStateConnector.sol";
import "./mocks/MockFAsset.sol";

contract FLIPCoreTest is Test {
    FLIPCore public flipCore;
    EscrowVault public escrowVault;
    SettlementReceipt public settlementReceipt;
    LiquidityProviderRegistry public lpRegistry;
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
        escrowVault = new EscrowVault();
        settlementReceipt = new SettlementReceipt(address(escrowVault));
        lpRegistry = new LiquidityProviderRegistry();
        priceHedgePool = new PriceHedgePool(address(ftsoRegistry));
        operatorRegistry = new OperatorRegistry(1000 ether);

        // Set FLIPCore addresses (will be set after FLIPCore deployment)
        // Deploy FLIPCore
        flipCore = new FLIPCore(
            address(ftsoRegistry),
            address(stateConnector),
            address(escrowVault),
            address(settlementReceipt),
            address(lpRegistry),
            address(priceHedgePool),
            address(operatorRegistry)
        );
        
        // Set FLIPCore in escrow vault, LP registry, and settlement receipt
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(flipCore));
        
        vm.prank(address(lpRegistry.owner()));
        lpRegistry.setFLIPCore(address(flipCore));
        
        vm.prank(address(settlementReceipt.owner()));
        settlementReceipt.setFLIPCore(address(flipCore));

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
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset), "rTEST_ADDRESS");
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
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset), "rTEST_ADDRESS");
        vm.stopPrank();

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
            uint8(FLIPCore.RedemptionStatus.EscrowCreated),
            "Should have escrow created"
        );
        
        // Check escrow was created
        EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionId);
        assertEq(uint8(escrowStatus), uint8(EscrowVault.EscrowStatus.Created), "Escrow should be created");
    }

    function testEvaluateRedemption() public {
        uint256 amount = 100 ether;
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset), "rTEST_ADDRESS");
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

        // Should be high confidence (decision = 1 = FastLane)
        assertGe(score, 997000, "Score should be >= 99.7%");
        assertEq(decision, 1, "Decision should be FastLane");
    }

    function testEvaluateRedemption_LowConfidence() public {
        uint256 amount = 100000 ether; // Large amount
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset), "rTEST_ADDRESS");
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
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset), "rTEST_ADDRESS");
        vm.stopPrank();

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

    function testHandleFDCAttestation_Failure() public {
        uint256 amount = 100 ether;
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset), "rTEST_ADDRESS");
        vm.stopPrank();

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

        assertEq(uint8(flipCore.getRedemptionStatus(redemptionId)), uint8(FLIPCore.RedemptionStatus.Failed));
        
        // Check escrow status
        EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionId);
        assertEq(uint8(escrowStatus), uint8(EscrowVault.EscrowStatus.Failed), "Escrow should be failed");
    }
    
    function testHandleFDCAttestation_Success() public {
        uint256 amount = 100 ether;
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset), "rTEST_ADDRESS");
        vm.stopPrank();

        // Finalize provisional
        vm.prank(operator);
        flipCore.finalizeProvisional(redemptionId, 5000, 995000, 200000 ether);

        // FDC confirms success
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 1, true);

        assertEq(uint8(flipCore.getRedemptionStatus(redemptionId)), uint8(FLIPCore.RedemptionStatus.Finalized));
        
        // Check escrow status
        EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionId);
        assertEq(uint8(escrowStatus), uint8(EscrowVault.EscrowStatus.Released), "Escrow should be released");
    }
    
    function testCheckTimeout() public {
        uint256 amount = 100 ether;
        
        vm.startPrank(user);
        fAsset.mint(user, amount);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset), "rTEST_ADDRESS");
        vm.stopPrank();

        // Finalize provisional
        vm.prank(operator);
        flipCore.finalizeProvisional(redemptionId, 5000, 995000, 200000 ether);

        // Fast forward past timeout
        vm.warp(block.timestamp + 601); // 601 seconds > 600 timeout

        // Check timeout
        vm.prank(operator);
        flipCore.checkTimeout(redemptionId);

        assertEq(uint8(flipCore.getRedemptionStatus(redemptionId)), uint8(FLIPCore.RedemptionStatus.Timeout));
        
        // Check escrow status
        EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionId);
        assertEq(uint8(escrowStatus), uint8(EscrowVault.EscrowStatus.Timeout), "Escrow should be timed out");
    }
}



