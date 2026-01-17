// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/SettlementReceipt.sol";
import "../../contracts/EscrowVault.sol";

contract SettlementReceiptTest is Test {
    EscrowVault public escrowVault;
    SettlementReceipt public settlementReceipt;
    
    address public user = address(0x1001); // Use non-precompile address
    address public lp = address(0x2002);
    address public asset = address(0x3003);
    
    function setUp() public {
        escrowVault = new EscrowVault();
        settlementReceipt = new SettlementReceipt(address(escrowVault));
        
        // Set FLIPCore for escrow vault
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(this));
        
        // Set SettlementReceipt in escrow vault
        vm.prank(address(escrowVault.owner()));
        escrowVault.setSettlementReceipt(address(settlementReceipt));
        
        // Set FLIPCore for settlement receipt
        vm.prank(address(settlementReceipt.owner()));
        settlementReceipt.setFLIPCore(address(this));
    }
    
    function testMintReceipt() public {
        uint256 redemptionId = 1;
        uint256 amount = 100 ether;
        uint256 haircutRate = 5000; // 0.5%
        
        // Create escrow first
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        
        // Mint receipt
        uint256 receiptId = settlementReceipt.mintReceipt(
            user,
            redemptionId,
            asset,
            amount,
            haircutRate,
            address(0)
        );
        
        assertEq(receiptId, 1, "First receipt should be ID 1");
        assertEq(settlementReceipt.ownerOf(receiptId), user, "User should own receipt");
        assertEq(settlementReceipt.balanceOf(user), 1, "User should have 1 receipt");
        
        SettlementReceipt.ReceiptMetadata memory metadata = settlementReceipt.getReceiptMetadata(receiptId);
        assertEq(metadata.redemptionId, redemptionId, "Redemption ID should match");
        assertEq(metadata.amount, amount, "Amount should match");
        assertEq(metadata.haircutRate, haircutRate, "Haircut rate should match");
        assertEq(metadata.redeemed, false, "Should not be redeemed");
    }
    
    function testRedeemNow() public {
        uint256 redemptionId = 2;
        uint256 amount = 100 ether;
        uint256 haircutRate = 5000; // 0.5%
        
        // Fund escrow vault (simulating LP transfer)
        vm.deal(address(escrowVault), amount);
        vm.deal(user, 0); // Ensure user starts with 0 balance
        
        escrowVault.createEscrow(redemptionId, user, lp, asset, amount, true);
        
        uint256 receiptId = settlementReceipt.mintReceipt(
            user,
            redemptionId,
            asset,
            amount,
            haircutRate,
            lp
        );
        
        // User redeems immediately
        vm.prank(user);
        settlementReceipt.redeemNow(receiptId);
        
        SettlementReceipt.ReceiptMetadata memory metadata = settlementReceipt.getReceiptMetadata(receiptId);
        assertEq(metadata.redeemed, true, "Should be redeemed");
    }
    
    function testRedeemAfterFDC() public {
        uint256 redemptionId = 3;
        uint256 amount = 100 ether;
        uint256 haircutRate = 5000;
        uint256 fdcRoundId = 12345;
        
        // Fund escrow vault
        vm.deal(address(escrowVault), amount);
        vm.deal(user, 0); // Ensure user starts with 0 balance
        
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        
        uint256 receiptId = settlementReceipt.mintReceipt(
            user,
            redemptionId,
            asset,
            amount,
            haircutRate,
            address(0)
        );
        
        // FDC confirms success
        escrowVault.releaseOnFDC(redemptionId, true, fdcRoundId);
        // updateFDCRoundId should be called by escrow vault, but for testing we call it directly
        // In production, EscrowVault would call this
        vm.prank(address(escrowVault));
        settlementReceipt.updateFDCRoundId(redemptionId, fdcRoundId);
        
        // User redeems after FDC
        vm.prank(user);
        settlementReceipt.redeemAfterFDC(receiptId);
        
        SettlementReceipt.ReceiptMetadata memory metadata = settlementReceipt.getReceiptMetadata(receiptId);
        assertEq(metadata.redeemed, true, "Should be redeemed");
        assertEq(metadata.fdcRoundId, fdcRoundId, "FDC round ID should match");
    }
    
    function testRedeemNow_RequiresLP() public {
        uint256 redemptionId = 4;
        uint256 amount = 100 ether;
        
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        
        uint256 receiptId = settlementReceipt.mintReceipt(
            user,
            redemptionId,
            asset,
            amount,
            0,
            address(0) // No LP
        );
        
        // Should revert - no LP liquidity
        vm.prank(user);
        vm.expectRevert("SettlementReceipt: no LP liquidity");
        settlementReceipt.redeemNow(receiptId);
    }
    
    function testRedeemAfterFDC_RequiresRelease() public {
        uint256 redemptionId = 5;
        uint256 amount = 100 ether;
        
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        
        uint256 receiptId = settlementReceipt.mintReceipt(
            user,
            redemptionId,
            asset,
            amount,
            0,
            address(0)
        );
        
        // Should revert - escrow not released
        vm.prank(user);
        vm.expectRevert("SettlementReceipt: escrow not released");
        settlementReceipt.redeemAfterFDC(receiptId);
    }
    
    function testTransferReceipt() public {
        uint256 redemptionId = 6;
        uint256 amount = 100 ether;
        address recipient = address(0x4);
        
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        
        uint256 receiptId = settlementReceipt.mintReceipt(
            user,
            redemptionId,
            asset,
            amount,
            0,
            address(0)
        );
        
        // Transfer receipt
        vm.prank(user);
        settlementReceipt.transferFrom(user, recipient, receiptId);
        
        assertEq(settlementReceipt.ownerOf(receiptId), recipient, "Recipient should own receipt");
        assertEq(settlementReceipt.balanceOf(user), 0, "User should have 0 receipts");
        assertEq(settlementReceipt.balanceOf(recipient), 1, "Recipient should have 1 receipt");
    }
}


