// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/FLIPCore.sol";
import "../../contracts/EscrowVault.sol";
import "../../contracts/SettlementReceipt.sol";
import "../../contracts/LiquidityProviderRegistry.sol";
import "../../contracts/PriceHedgePool.sol";
import "../../contracts/OperatorRegistry.sol";
import "../contracts/mocks/MockFtsoRegistry.sol";
import "../contracts/mocks/MockStateConnector.sol";
import "../contracts/mocks/MockFAsset.sol";

/**
 * @title EscrowStressTest
 * @notice Stress tests for escrow-based flow: concurrent escrows, LP exhaustion, timeouts, Firelight triggers
 */
contract EscrowStressTest is Test {
    FLIPCore public flipCore;
    EscrowVault public escrowVault;
    SettlementReceipt public settlementReceipt;
    LiquidityProviderRegistry public lpRegistry;
    PriceHedgePool public priceHedgePool;
    OperatorRegistry public operatorRegistry;
    MockFtsoRegistry public ftsoRegistry;
    MockStateConnector public stateConnector;
    MockFAsset public fAsset;

    address public operator = address(0x2);
    address[] public users;
    address[] public lps;

    uint256 constant NUM_USERS = 10;
    uint256 constant NUM_LPS = 5;
    uint256 constant REDEMPTION_AMOUNT = 100 ether;

    function setUp() public {
        // Deploy contracts
        ftsoRegistry = new MockFtsoRegistry();
        stateConnector = new MockStateConnector();
        escrowVault = new EscrowVault();
        settlementReceipt = new SettlementReceipt(address(escrowVault));
        lpRegistry = new LiquidityProviderRegistry();
        priceHedgePool = new PriceHedgePool(address(ftsoRegistry));
        operatorRegistry = new OperatorRegistry(1000 ether);

        flipCore = new FLIPCore(
            address(ftsoRegistry),
            address(stateConnector),
            address(escrowVault),
            address(settlementReceipt),
            address(lpRegistry),
            address(priceHedgePool),
            address(operatorRegistry)
        );
        
        // Set FLIPCore addresses
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(flipCore));
        
        vm.prank(address(lpRegistry.owner()));
        lpRegistry.setFLIPCore(address(flipCore));

        // Deploy mock FAsset
        fAsset = new MockFAsset();
        
        // Setup operator
        vm.deal(operator, 100000 ether);
        vm.prank(operator);
        operatorRegistry.stake{value: 200000 ether}(200000 ether);
        
        // Create users
        for (uint256 i = 0; i < NUM_USERS; i++) {
            address user = address(uint160(0x1000 + i));
            users.push(user);
            vm.deal(user, 10000 ether);
            fAsset.mint(user, 10000 ether);
        }
        
        // Create LPs
        for (uint256 i = 0; i < NUM_LPS; i++) {
            address lp = address(uint160(0x2000 + i));
            lps.push(lp);
            vm.deal(lp, 50000 ether);
            
            // Each LP deposits 10000 ether with 1% min haircut
            vm.prank(lp);
            lpRegistry.depositLiquidity{value: 10000 ether}(
                address(fAsset),
                10000 ether,
                10000, // 1% min haircut
                3600   // 1 hour max delay
            );
        }
    }

    /**
     * @notice Test multiple concurrent escrows
     */
    function testConcurrentEscrows() public {
        uint256[] memory redemptionIds = new uint256[](NUM_USERS);
        
        // All users request redemptions simultaneously
        for (uint256 i = 0; i < NUM_USERS; i++) {
            vm.startPrank(users[i]);
            fAsset.mint(users[i], REDEMPTION_AMOUNT);
            redemptionIds[i] = flipCore.requestRedemption(REDEMPTION_AMOUNT, address(fAsset));
            vm.stopPrank();
        }
        
        // All redemptions should be pending
        for (uint256 i = 0; i < NUM_USERS; i++) {
            assertEq(
                uint8(flipCore.getRedemptionStatus(redemptionIds[i])),
                uint8(FLIPCore.RedemptionStatus.Pending),
                "All should be pending"
            );
        }
        
        // Finalize all provisionally
        for (uint256 i = 0; i < NUM_USERS; i++) {
            vm.prank(operator);
            flipCore.finalizeProvisional(
                redemptionIds[i],
                5000,      // Low volatility
                995000,    // High success rate
                200000 ether
            );
        }
        
        // All should have escrows created
        for (uint256 i = 0; i < NUM_USERS; i++) {
            assertEq(
                uint8(flipCore.getRedemptionStatus(redemptionIds[i])),
                uint8(FLIPCore.RedemptionStatus.EscrowCreated),
                "All should have escrows"
            );
            
            EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionIds[i]);
            assertEq(
                uint8(escrowStatus),
                uint8(EscrowVault.EscrowStatus.Created),
                "Escrow should be created"
            );
        }
    }

    /**
     * @notice Test LP capital exhaustion
     */
    function testLPExhaustion() public {
        // Total LP capital: 5 LPs * 10000 ether = 50000 ether
        // Request redemptions exceeding LP capacity
        
        uint256[] memory redemptionIds = new uint256[](6); // 6 redemptions = 600 ether > 500 ether LP capacity
        
        // First 5 redemptions should match LPs
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(users[i]);
            fAsset.mint(users[i], REDEMPTION_AMOUNT);
            redemptionIds[i] = flipCore.requestRedemption(REDEMPTION_AMOUNT, address(fAsset));
            vm.stopPrank();
            
            vm.prank(operator);
            flipCore.finalizeProvisional(redemptionIds[i], 5000, 995000, 200000 ether);
            
            // Check if LP-funded
            EscrowVault.Escrow memory escrow = escrowVault.getEscrow(redemptionIds[i]);
            assertTrue(escrow.lpFunded, "First 5 should be LP-funded");
        }
        
        // 6th redemption should fall back to user-wait path
        vm.startPrank(users[5]);
        fAsset.mint(users[5], REDEMPTION_AMOUNT);
        redemptionIds[5] = flipCore.requestRedemption(REDEMPTION_AMOUNT, address(fAsset));
        vm.stopPrank();
        
        vm.prank(operator);
        flipCore.finalizeProvisional(redemptionIds[5], 5000, 995000, 200000 ether);
        
        // Should be user-wait path (no LP)
        EscrowVault.Escrow memory escrow6 = escrowVault.getEscrow(redemptionIds[5]);
        assertFalse(escrow6.lpFunded, "6th should be user-wait path");
        assertEq(escrow6.lp, address(0), "No LP should be matched");
    }

    /**
     * @notice Test FDC timeout scenarios
     */
    function testFDCTimeout() public {
        uint256 redemptionId;
        
        // Request redemption
        vm.startPrank(users[0]);
        fAsset.mint(users[0], REDEMPTION_AMOUNT);
        redemptionId = flipCore.requestRedemption(REDEMPTION_AMOUNT, address(fAsset));
        vm.stopPrank();
        
        // Finalize provisional
        vm.prank(operator);
        flipCore.finalizeProvisional(redemptionId, 5000, 995000, 200000 ether);
        
        // Fast forward past timeout (600 seconds)
        vm.warp(block.timestamp + 601);
        
        // Check timeout
        vm.prank(operator);
        flipCore.checkTimeout(redemptionId);
        
        assertEq(
            uint8(flipCore.getRedemptionStatus(redemptionId)),
            uint8(FLIPCore.RedemptionStatus.Timeout),
            "Should be timed out"
        );
        
        EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionId);
        assertEq(
            uint8(escrowStatus),
            uint8(EscrowVault.EscrowStatus.Timeout),
            "Escrow should be timed out"
        );
    }

    /**
     * @notice Test multiple timeouts
     */
    function testMultipleTimeouts() public {
        uint256[] memory redemptionIds = new uint256[](5);
        
        // Create 5 redemptions
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(users[i]);
            fAsset.mint(users[i], REDEMPTION_AMOUNT);
            redemptionIds[i] = flipCore.requestRedemption(REDEMPTION_AMOUNT, address(fAsset));
            vm.stopPrank();
            
            vm.prank(operator);
            flipCore.finalizeProvisional(redemptionIds[i], 5000, 995000, 200000 ether);
        }
        
        // Fast forward past timeout
        vm.warp(block.timestamp + 601);
        
        // All should timeout
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(operator);
            flipCore.checkTimeout(redemptionIds[i]);
            
            assertEq(
                uint8(flipCore.getRedemptionStatus(redemptionIds[i])),
                uint8(FLIPCore.RedemptionStatus.Timeout),
                "All should timeout"
            );
        }
    }

    /**
     * @notice Test FDC failure scenarios
     */
    function testFDCFailures() public {
        uint256[] memory redemptionIds = new uint256[](5);
        
        // Create 5 redemptions
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(users[i]);
            fAsset.mint(users[i], REDEMPTION_AMOUNT);
            redemptionIds[i] = flipCore.requestRedemption(REDEMPTION_AMOUNT, address(fAsset));
            vm.stopPrank();
            
            vm.prank(operator);
            flipCore.finalizeProvisional(redemptionIds[i], 5000, 995000, 200000 ether);
        }
        
        // FDC confirms failures for all
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(operator);
            flipCore.handleFDCAttestation(redemptionIds[i], i + 1, false);
            
            assertEq(
                uint8(flipCore.getRedemptionStatus(redemptionIds[i])),
                uint8(FLIPCore.RedemptionStatus.Failed),
                "All should be failed"
            );
            
            EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionIds[i]);
            assertEq(
                uint8(escrowStatus),
                uint8(EscrowVault.EscrowStatus.Failed),
                "Escrows should be failed"
            );
        }
    }

    /**
     * @notice Test mixed success/failure scenarios
     */
    function testMixedFDCOutcomes() public {
        uint256[] memory redemptionIds = new uint256[](10);
        
        // Create 10 redemptions
        for (uint256 i = 0; i < 10; i++) {
            vm.startPrank(users[i % NUM_USERS]);
            fAsset.mint(users[i % NUM_USERS], REDEMPTION_AMOUNT);
            redemptionIds[i] = flipCore.requestRedemption(REDEMPTION_AMOUNT, address(fAsset));
            vm.stopPrank();
            
            vm.prank(operator);
            flipCore.finalizeProvisional(redemptionIds[i], 5000, 995000, 200000 ether);
        }
        
        // First 5 succeed, last 5 fail
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(operator);
            flipCore.handleFDCAttestation(redemptionIds[i], i + 1, true);
            
            assertEq(
                uint8(flipCore.getRedemptionStatus(redemptionIds[i])),
                uint8(FLIPCore.RedemptionStatus.Finalized),
                "First 5 should succeed"
            );
        }
        
        for (uint256 i = 5; i < 10; i++) {
            vm.prank(operator);
            flipCore.handleFDCAttestation(redemptionIds[i], i + 1, false);
            
            assertEq(
                uint8(flipCore.getRedemptionStatus(redemptionIds[i])),
                uint8(FLIPCore.RedemptionStatus.Failed),
                "Last 5 should fail"
            );
        }
    }

    /**
     * @notice Test receipt redemption under stress
     */
    function testReceiptRedemptionStress() public {
        uint256[] memory redemptionIds = new uint256[](5);
        uint256[] memory receiptIds = new uint256[](5);
        
        // Create redemptions and finalize
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(users[i]);
            fAsset.mint(users[i], REDEMPTION_AMOUNT);
            redemptionIds[i] = flipCore.requestRedemption(REDEMPTION_AMOUNT, address(fAsset));
            vm.stopPrank();
            
            vm.prank(operator);
            flipCore.finalizeProvisional(redemptionIds[i], 5000, 995000, 200000 ether);
            
            receiptIds[i] = settlementReceipt.redemptionToTokenId(redemptionIds[i]);
        }
        
        // All users redeem immediately
        for (uint256 i = 0; i < 5; i++) {
            vm.startPrank(users[i]);
            settlementReceipt.redeemNow(receiptIds[i]);
            vm.stopPrank();
            
            assertEq(
                uint8(flipCore.getRedemptionStatus(redemptionIds[i])),
                uint8(FLIPCore.RedemptionStatus.ReceiptRedeemed),
                "Should be redeemed"
            );
        }
    }

    /**
     * @notice Test LP withdrawal and re-deposit
     */
    function testLPWithdrawalRedeposit() public {
        address lp = lps[0];
        
        // LP withdraws half
        vm.prank(lp);
        lpRegistry.withdrawLiquidity(address(fAsset), 5000 ether);
        
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(lp, address(fAsset));
        assertEq(position.availableAmount, 5000 ether, "Should have 5000 ether left");
        
        // LP re-deposits
        vm.deal(lp, 5000 ether);
        vm.prank(lp);
        lpRegistry.depositLiquidity{value: 5000 ether}(
            address(fAsset),
            5000 ether,
            10000, // 1% min haircut
            3600   // 1 hour max delay
        );
        
        position = lpRegistry.getPosition(lp, address(fAsset));
        assertEq(position.availableAmount, 10000 ether, "Should be back to 10000 ether");
    }
}

