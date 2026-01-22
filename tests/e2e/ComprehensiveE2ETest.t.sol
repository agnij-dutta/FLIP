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
import "../contracts/mocks/MockFtsoRegistry.sol";
import "../contracts/mocks/MockStateConnector.sol";
import "../contracts/mocks/MockFAsset.sol";

/**
 * @title ComprehensiveE2ETest
 * @notice End-to-end test of complete FLIP flow:
 *         1. Mint FXRP (simulated)
 *         2. User requests redemption
 *         3. LP provides liquidity
 *         4. Oracle processes and creates escrow
 *         5. Settlement executor pays XRP (simulated)
 *         6. FDC confirms payment
 *         7. User redeems receipt
 */
contract ComprehensiveE2ETest is Test {
    FLIPCore public flipCore;
    EscrowVault public escrowVault;
    SettlementReceipt public settlementReceipt;
    LiquidityProviderRegistry public lpRegistry;
    PriceHedgePool public priceHedgePool;
    OperatorRegistry public operatorRegistry;
    MockFtsoRegistry public ftsoRegistry;
    MockStateConnector public stateConnector;
    MockFAsset public fAsset;

    address public user = address(0x1001); // Use non-precompile address
    address public lp = address(0x2002);
    address public operator = address(0x3003);
    address public executor = address(0x4004);

    uint256 public constant INITIAL_FXRP = 10000 ether;
    uint256 public constant REDEMPTION_AMOUNT = 100 ether;
    uint256 public constant LP_DEPOSIT = 10000 ether; // FLR
    uint256 public constant MIN_HAIRCUT = 10000; // 1% (scaled: 1000000 = 100%)
    uint256 public constant MAX_DELAY = 3600; // 1 hour

    string public constant XRPL_ADDRESS = "rTEST_USER_ADDRESS_123456789012345678901234";

    function setUp() public {
        // Deploy mocks
        ftsoRegistry = new MockFtsoRegistry();
        stateConnector = new MockStateConnector();
        escrowVault = new EscrowVault();
        settlementReceipt = new SettlementReceipt(address(escrowVault));
        lpRegistry = new LiquidityProviderRegistry();
        priceHedgePool = new PriceHedgePool(address(ftsoRegistry));
        operatorRegistry = new OperatorRegistry(1000 ether);

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

        // Set FLIPCore in dependencies
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(flipCore));

        vm.prank(address(escrowVault.owner()));
        escrowVault.setSettlementReceipt(address(settlementReceipt));

        vm.prank(address(lpRegistry.owner()));
        lpRegistry.setFLIPCore(address(flipCore));
        vm.prank(address(lpRegistry.owner()));
        lpRegistry.setEscrowVault(address(escrowVault));

        vm.prank(address(settlementReceipt.owner()));
        settlementReceipt.setFLIPCore(address(flipCore));

        // Deploy mock FAsset
        fAsset = new MockFAsset();

        // Setup balances
        vm.deal(user, 10000 ether);
        vm.deal(lp, 20000 ether);
        vm.deal(operator, 10000 ether);
        vm.deal(executor, 10000 ether);

        // Mint FXRP to user (simulating minting flow)
        fAsset.mint(user, INITIAL_FXRP);

        // Register operator
        vm.prank(operator);
        operatorRegistry.stake{value: 1000 ether}(1000 ether);
    }

    function testCompleteFlow() public {
        // Step 1: User has FXRP (already minted in setUp)
        uint256 userBalanceBefore = fAsset.balanceOf(user);
        assertEq(userBalanceBefore, INITIAL_FXRP, "User should have FXRP");

        // Step 2: LP deposits liquidity
        // Use lower minHaircut (500 = 0.05%) to allow matching with suggestedHaircut (1000 = 0.1%)
        vm.startPrank(lp);
        lpRegistry.depositLiquidity{value: LP_DEPOSIT}(
            address(fAsset),
            LP_DEPOSIT,
            500, // 0.05% (lower than suggestedHaircut to allow matching)
            MAX_DELAY
        );
        vm.stopPrank();

        // Verify LP position
        (bool active, uint256 deposited, uint256 available) = _getLPPosition(lp, address(fAsset));
        assertTrue(active, "LP position should be active");
        assertEq(deposited, LP_DEPOSIT, "LP should have deposited");
        assertEq(available, LP_DEPOSIT, "LP should have available liquidity");

        // Step 3: User requests redemption
        vm.startPrank(user);
        fAsset.approve(address(flipCore), REDEMPTION_AMOUNT);
        uint256 redemptionId = flipCore.requestRedemption(
            REDEMPTION_AMOUNT,
            address(fAsset),
            XRPL_ADDRESS
        );
        vm.stopPrank();

        // Verify redemption created
        assertEq(redemptionId, 0, "First redemption should be ID 0");
        (address redemptionUser, , uint256 redemptionAmount, , , , FLIPCore.RedemptionStatus status, , , ) = 
            flipCore.redemptions(redemptionId);
        assertEq(redemptionUser, user, "Redemption user should match");
        assertEq(redemptionAmount, REDEMPTION_AMOUNT, "Redemption amount should match");
        assertEq(uint8(status), uint8(FLIPCore.RedemptionStatus.Pending), "Should be pending");

        // Verify FXRP burned (sent to dead address)
        uint256 userBalanceAfter = fAsset.balanceOf(user);
        assertEq(userBalanceAfter, INITIAL_FXRP - REDEMPTION_AMOUNT, "User FXRP should decrease");
        uint256 deadBalance = fAsset.balanceOf(0x000000000000000000000000000000000000dEaD);
        assertEq(deadBalance, REDEMPTION_AMOUNT, "Dead address should have burned tokens");

        // Step 4: Oracle processes and finalizes provisional
        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            5000, // Low volatility (0.5%)
            995000, // High executor success rate (99.5%)
            200000 ether // High executor stake
        );

        // Verify escrow created
        EscrowVault.Escrow memory escrow = escrowVault.getEscrow(redemptionId);
        assertEq(escrow.redemptionId, redemptionId, "Escrow redemption ID should match");
        assertEq(escrow.user, user, "Escrow user should match");
        assertEq(escrow.amount, REDEMPTION_AMOUNT, "Escrow amount should match");
        assertTrue(escrow.lpFunded, "Escrow should be LP-funded");

        // Verify LP funds transferred to EscrowVault
        uint256 escrowVaultBalance = address(escrowVault).balance;
        assertEq(escrowVaultBalance, REDEMPTION_AMOUNT, "EscrowVault should hold LP funds");

        // Verify LP available amount decreased
        (, , uint256 lpAvailableAfter) = _getLPPosition(lp, address(fAsset));
        assertEq(lpAvailableAfter, LP_DEPOSIT - REDEMPTION_AMOUNT, "LP available should decrease");

        // Verify receipt minted
        uint256 receiptBalance = settlementReceipt.balanceOf(user);
        assertEq(receiptBalance, 1, "User should have 1 receipt");

        // Step 5: User redeems receipt IMMEDIATELY (before FDC confirms) - fast lane with haircut
        vm.startPrank(user);
        uint256 receiptId = 1; // First receipt
        uint256 userBalanceBeforeRedeem = user.balance;
        
        settlementReceipt.redeemNow(receiptId);
        vm.stopPrank();

        // Verify user received FLR (with haircut)
        uint256 userBalanceAfterRedeem = user.balance;
        uint256 expectedAmount = REDEMPTION_AMOUNT - (REDEMPTION_AMOUNT * 500 / 1000000); // 500 = 0.05% haircut
        assertEq(
            userBalanceAfterRedeem - userBalanceBeforeRedeem,
            expectedAmount,
            "User should receive FLR minus haircut"
        );

        // Step 6: Settlement executor pays XRP (simulated - in production, executor sends XRP to XRPL)
        // This is simulated by FDC attestation

        // Step 7: FDC confirms payment (simulated)
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 0, true);

        // Verify redemption finalized
        (, , , , , , FLIPCore.RedemptionStatus finalStatus, , , ) = flipCore.redemptions(redemptionId);
        assertEq(uint8(finalStatus), uint8(FLIPCore.RedemptionStatus.Finalized), "Should be finalized");

        // Verify receipt marked as redeemed
        SettlementReceipt.ReceiptMetadata memory metadata = 
            settlementReceipt.getReceiptMetadata(receiptId);
        assertEq(metadata.redemptionId, redemptionId, "Receipt redemption ID should match");
        assertTrue(metadata.redeemed, "Receipt should be redeemed");

        // Step 8: Verify final state
        // Escrow should be released
        EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionId);
        assertEq(
            uint8(escrowStatus),
            uint8(EscrowVault.EscrowStatus.Released),
            "Escrow should be released"
        );

        // Final balances
        assertEq(
            fAsset.balanceOf(user),
            INITIAL_FXRP - REDEMPTION_AMOUNT,
            "User FXRP should be reduced"
        );
    }

    function testFlowWithoutLP() public {
        // Test user-wait path when no LP available

        // Step 1: User requests redemption (no LP deposited)
        vm.startPrank(user);
        fAsset.approve(address(flipCore), REDEMPTION_AMOUNT);
        uint256 redemptionId = flipCore.requestRedemption(
            REDEMPTION_AMOUNT,
            address(fAsset),
            XRPL_ADDRESS
        );
        vm.stopPrank();

        // Step 2: Oracle processes (no LP match)
        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            5000, // Low volatility
            995000, // High executor success rate
            200000 ether // High executor stake
        );

        // Verify escrow created but not LP-funded
        EscrowVault.Escrow memory escrow = escrowVault.getEscrow(redemptionId);
        assertFalse(escrow.lpFunded, "Escrow should not be LP-funded");

        // Verify receipt minted
        uint256 receiptBalance = settlementReceipt.balanceOf(user);
        assertEq(receiptBalance, 1, "User should have receipt");

        // User must wait for FDC confirmation (no immediate redemption)
        // In production, user would wait for executor to pay and FDC to confirm
    }

    function testFDCConfirmationFlow() public {
        // Test complete flow with FDC confirmation

        // Setup: LP deposits, user requests redemption
        vm.startPrank(lp);
        lpRegistry.depositLiquidity{value: LP_DEPOSIT}(
            address(fAsset),
            LP_DEPOSIT,
            500, // 0.05% (lower than suggestedHaircut to allow matching)
            MAX_DELAY
        );
        vm.stopPrank();

        vm.startPrank(user);
        fAsset.approve(address(flipCore), REDEMPTION_AMOUNT);
        uint256 redemptionId = flipCore.requestRedemption(
            REDEMPTION_AMOUNT,
            address(fAsset),
            XRPL_ADDRESS
        );
        vm.stopPrank();

        // Oracle processes
        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            5000,
            995000,
            200000 ether
        );

        // FDC confirms payment
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 0, true);

        // Verify finalization
        (, , , , , , FLIPCore.RedemptionStatus finalStatus, , , ) = flipCore.redemptions(redemptionId);
        assertEq(uint8(finalStatus), uint8(FLIPCore.RedemptionStatus.Finalized), "Should be finalized");
    }

    function testFDCFailureFlow() public {
        // Test FDC failure scenario

        // Setup
        vm.startPrank(lp);
        lpRegistry.depositLiquidity{value: LP_DEPOSIT}(
            address(fAsset),
            LP_DEPOSIT,
            500, // 0.05% (lower than suggestedHaircut to allow matching)
            MAX_DELAY
        );
        vm.stopPrank();

        vm.startPrank(user);
        fAsset.approve(address(flipCore), REDEMPTION_AMOUNT);
        uint256 redemptionId = flipCore.requestRedemption(
            REDEMPTION_AMOUNT,
            address(fAsset),
            XRPL_ADDRESS
        );
        vm.stopPrank();

        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            5000,
            995000,
            200000 ether
        );

        // FDC confirms failure (executor didn't pay)
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 0, false);

        // Verify redemption failed
        (, , , , , , FLIPCore.RedemptionStatus finalStatus, , , ) = flipCore.redemptions(redemptionId);
        assertEq(uint8(finalStatus), uint8(FLIPCore.RedemptionStatus.Failed), "Should be failed");

        // LP should get funds back (or lose them depending on escrow logic)
        EscrowVault.EscrowStatus escrowStatus = escrowVault.getEscrowStatus(redemptionId);
        assertEq(
            uint8(escrowStatus),
            uint8(EscrowVault.EscrowStatus.Failed),
            "Escrow should be failed"
        );
    }

    // Helper function
    function _getLPPosition(address _lp, address _asset)
        internal
        view
        returns (bool active, uint256 deposited, uint256 available)
    {
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(_lp, _asset);
        return (position.active, position.depositedAmount, position.availableAmount);
    }
}

