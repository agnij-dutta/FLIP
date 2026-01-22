// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/EscrowVault.sol";

contract EscrowVaultTest is Test {
    EscrowVault public escrowVault;
    
    address public user = address(0x1001); // Use non-precompile address
    address public lp = address(0x2002);
    address public asset = address(0x3003);
    
    function setUp() public {
        escrowVault = new EscrowVault();
    }
    
    function testCreateEscrow() public {
        uint256 redemptionId = 1;
        uint256 amount = 100 ether;
        
        // Set FLIPCore (simulate)
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(this));
        
        escrowVault.createEscrow(
            redemptionId,
            user,
            address(0), // No LP (user-wait path)
            asset,
            amount,
            false // lpFunded = false
        );
        
        EscrowVault.EscrowStatus status = escrowVault.getEscrowStatus(redemptionId);
        assertEq(uint8(status), uint8(EscrowVault.EscrowStatus.Created), "Escrow should be created");
        
        EscrowVault.Escrow memory escrow = escrowVault.getEscrow(redemptionId);
        assertEq(escrow.user, user, "User should match");
        assertEq(escrow.amount, amount, "Amount should match");
        assertEq(escrow.lpFunded, false, "Should be user-wait path");
    }
    
    function testCreateEscrow_LPFunded() public {
        uint256 redemptionId = 2;
        uint256 amount = 100 ether;
        
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(this));
        
        // Fund escrow vault first (simulating LP transfer)
        vm.deal(address(escrowVault), amount);
        
        escrowVault.createEscrow(
            redemptionId,
            user,
            lp,
            asset,
            amount,
            true // lpFunded = true
        );
        
        EscrowVault.Escrow memory escrow = escrowVault.getEscrow(redemptionId);
        assertEq(escrow.lp, lp, "LP should match");
        assertEq(escrow.lpFunded, true, "Should be LP-funded");
    }
    
    function testReleaseOnFDC_Success() public {
        uint256 redemptionId = 3;
        uint256 amount = 100 ether;
        uint256 fdcRoundId = 12345;
        
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(this));
        
        // Fund escrow vault
        vm.deal(address(escrowVault), amount);
        vm.deal(user, 0); // Ensure user starts with 0 balance
        
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        escrowVault.releaseOnFDC(redemptionId, true, fdcRoundId);
        
        EscrowVault.EscrowStatus status = escrowVault.getEscrowStatus(redemptionId);
        assertEq(uint8(status), uint8(EscrowVault.EscrowStatus.Released), "Escrow should be released");
        
        EscrowVault.Escrow memory escrow = escrowVault.getEscrow(redemptionId);
        assertEq(escrow.fdcRoundId, fdcRoundId, "FDC round ID should match");
    }
    
    function testReleaseOnFDC_Failure() public {
        uint256 redemptionId = 4;
        uint256 amount = 100 ether;
        
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(this));
        
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        escrowVault.releaseOnFDC(redemptionId, false, 0);
        
        EscrowVault.EscrowStatus status = escrowVault.getEscrowStatus(redemptionId);
        assertEq(uint8(status), uint8(EscrowVault.EscrowStatus.Failed), "Escrow should be failed");
    }
    
    function testTimeoutRelease() public {
        uint256 redemptionId = 5;
        uint256 amount = 100 ether;
        
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(this));
        
        // Fund escrow vault
        vm.deal(address(escrowVault), amount);
        vm.deal(user, 0); // Ensure user starts with 0 balance
        
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        
        // Fast forward time past timeout
        vm.warp(block.timestamp + 601); // 601 seconds > 600 timeout
        
        escrowVault.timeoutRelease(redemptionId);
        
        EscrowVault.EscrowStatus status = escrowVault.getEscrowStatus(redemptionId);
        assertEq(uint8(status), uint8(EscrowVault.EscrowStatus.Timeout), "Escrow should be timed out");
    }
    
    function testCanTimeout() public {
        uint256 redemptionId = 6;
        uint256 amount = 100 ether;
        
        vm.prank(address(escrowVault.owner()));
        escrowVault.setFLIPCore(address(this));
        
        escrowVault.createEscrow(redemptionId, user, address(0), asset, amount, false);
        
        // Before timeout
        assertFalse(escrowVault.canTimeout(redemptionId), "Should not be timed out yet");
        
        // After timeout
        vm.warp(block.timestamp + 601);
        assertTrue(escrowVault.canTimeout(redemptionId), "Should be timed out");
    }
    
    function testCreateEscrow_Unauthorized() public {
        // Use a different address that's not owner or flipCore
        address unauthorized = address(0x999);
        vm.prank(unauthorized);
        vm.expectRevert("EscrowVault: not authorized");
        escrowVault.createEscrow(1, user, address(0), asset, 100 ether, false);
    }
}


