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
 * @title ContractIntegrationTest
 * @notice Tests contract interactions and fund flows
 */
contract ContractIntegrationTest is Test {
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

    function setUp() public {
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

        fAsset = new MockFAsset();

        vm.deal(user, 10000 ether);
        vm.deal(lp, 20000 ether);
        vm.deal(operator, 10000 ether);

        fAsset.mint(user, 10000 ether);

        vm.prank(operator);
        operatorRegistry.stake{value: 1000 ether}(1000 ether);
    }

    function testLPFundsActuallyStored() public {
        uint256 depositAmount = 5000 ether;
        
        vm.startPrank(lp);
        lpRegistry.depositLiquidity{value: depositAmount}(
            address(fAsset),
            depositAmount,
            10000, // 1%
            3600 // 1 hour
        );
        vm.stopPrank();

        // Check LP balance in registry
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(lp, address(fAsset));
        assertTrue(position.active, "LP should be active");
        assertEq(position.depositedAmount, depositAmount, "Deposited amount should match");
        assertEq(position.availableAmount, depositAmount, "Available amount should match");

        // Check contract balance (funds should be stored)
        uint256 contractBalance = address(lpRegistry).balance;
        assertEq(contractBalance, depositAmount, "Contract should hold LP funds");
    }

    function testLPFundsTransferredToEscrow() public {
        uint256 depositAmount = 10000 ether;
        uint256 redemptionAmount = 1000 ether;

        // LP deposits (use lower haircut to allow matching)
        vm.startPrank(lp);
        lpRegistry.depositLiquidity{value: depositAmount}(
            address(fAsset),
            depositAmount,
            500, // 0.05% (lower than suggestedHaircut to allow matching)
            3600
        );
        vm.stopPrank();

        // User requests redemption
        vm.startPrank(user);
        fAsset.approve(address(flipCore), redemptionAmount);
        uint256 redemptionId = flipCore.requestRedemption(
            redemptionAmount,
            address(fAsset),
            "rTEST"
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

        // Check EscrowVault received funds
        uint256 escrowBalance = address(escrowVault).balance;
        assertEq(escrowBalance, redemptionAmount, "EscrowVault should hold matched LP funds");

        // Check LP available decreased
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(lp, address(fAsset));
        assertEq(position.availableAmount, depositAmount - redemptionAmount, "LP available should decrease");
    }

    function testReceiptRedemptionPaysUser() public {
        uint256 depositAmount = 10000 ether;
        uint256 redemptionAmount = 1000 ether;

        // Setup (use lower haircut to allow matching)
        vm.startPrank(lp);
        lpRegistry.depositLiquidity{value: depositAmount}(
            address(fAsset),
            depositAmount,
            500, // 0.05% (lower than suggestedHaircut to allow matching)
            3600
        );
        vm.stopPrank();

        vm.startPrank(user);
        fAsset.approve(address(flipCore), redemptionAmount);
        uint256 redemptionId = flipCore.requestRedemption(
            redemptionAmount,
            address(fAsset),
            "rTEST"
        );
        vm.stopPrank();

        vm.prank(operator);
        flipCore.finalizeProvisional(
            redemptionId,
            5000,
            995000,
            200000 ether
        );

        // Ensure escrow has funds (LP match should have transferred, but ensure it for test)
        EscrowVault.Escrow memory escrow = escrowVault.getEscrow(redemptionId);
        if (!escrow.lpFunded) {
            // If no LP matched, fund escrow for user-wait path
            vm.deal(address(escrowVault), redemptionAmount);
        }
        vm.deal(user, 0); // Ensure user starts with 0 balance

        // User redeems receipt
        uint256 userBalanceBefore = user.balance;
        vm.startPrank(user);
        settlementReceipt.redeemNow(1); // First receipt
        vm.stopPrank();

        // User should receive FLR (with haircut)
        uint256 userBalanceAfter = user.balance;
        uint256 haircut = (redemptionAmount * 500) / 1000000; // 0.05% (matching LP's minHaircut)
        uint256 expectedPayout = redemptionAmount - haircut;
        
        assertEq(
            userBalanceAfter - userBalanceBefore,
            expectedPayout,
            "User should receive FLR minus haircut"
        );
    }

    function testFDCConfirmationRequired() public {
        // Test that FDC confirmation is required for finalization
        uint256 redemptionAmount = 1000 ether;

        vm.startPrank(user);
        fAsset.approve(address(flipCore), redemptionAmount);
        uint256 redemptionId = flipCore.requestRedemption(
            redemptionAmount,
            address(fAsset),
            "rTEST"
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

        // Check status is EscrowCreated, not Finalized
        (, , , , , , FLIPCore.RedemptionStatus status, , , ) = flipCore.redemptions(redemptionId);
        assertEq(
            uint8(status),
            uint8(FLIPCore.RedemptionStatus.EscrowCreated),
            "Should be EscrowCreated, not Finalized"
        );

        // Fund escrow vault (user-wait path, no LP match, so escrow needs funds for release)
        vm.deal(address(escrowVault), redemptionAmount);
        vm.deal(user, 0); // Ensure user starts with 0 balance

        // FDC confirms
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 0, true);

        // Now should be finalized
        (, , , , , , FLIPCore.RedemptionStatus finalStatus, , , ) = flipCore.redemptions(redemptionId);
        assertEq(
            uint8(finalStatus),
            uint8(FLIPCore.RedemptionStatus.Finalized),
            "Should be finalized after FDC confirmation"
        );
    }

    function testXRPLAddressStored() public {
        string memory xrplAddr = "rTEST_USER_ADDRESS_123456789012345678901234";
        uint256 redemptionAmount = 1000 ether;

        vm.startPrank(user);
        fAsset.approve(address(flipCore), redemptionAmount);
        uint256 redemptionId = flipCore.requestRedemption(
            redemptionAmount,
            address(fAsset),
            xrplAddr
        );
        vm.stopPrank();

        // Check XRPL address is stored
        (, , , , , , , , , string memory storedAddr) = flipCore.redemptions(redemptionId);
        assertEq(keccak256(bytes(storedAddr)), keccak256(bytes(xrplAddr)), "XRPL address should be stored");
    }

    // Helper removed - use lpRegistry.getPosition() directly
}

