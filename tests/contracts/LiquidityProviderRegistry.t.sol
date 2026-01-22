// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/LiquidityProviderRegistry.sol";
import "../../contracts/EscrowVault.sol";

contract LiquidityProviderRegistryTest is Test {
    LiquidityProviderRegistry public lpRegistry;
    
    address public lp1 = address(0x1001); // Use non-precompile addresses
    address public lp2 = address(0x2002);
    address public asset = address(0x3003);
    
    EscrowVault public escrowVault;
    
    function setUp() public {
        lpRegistry = new LiquidityProviderRegistry();
        escrowVault = new EscrowVault();
        
        // Set FLIPCore
        vm.prank(address(lpRegistry.owner()));
        lpRegistry.setFLIPCore(address(this));
        
        // Set EscrowVault
        vm.prank(address(lpRegistry.owner()));
        lpRegistry.setEscrowVault(address(escrowVault));
        
        vm.deal(lp1, 10000 ether);
        vm.deal(lp2, 10000 ether);
    }
    
    function testDepositLiquidity() public {
        uint256 amount = 1000 ether;
        uint256 minHaircut = 10000; // 1%
        uint256 maxDelay = 600; // 10 minutes
        
        vm.prank(lp1);
        lpRegistry.depositLiquidity{value: amount}(
            asset,
            amount,
            minHaircut,
            maxDelay
        );
        
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(lp1, asset);
        assertEq(position.depositedAmount, amount, "Deposited amount should match");
        assertEq(position.availableAmount, amount, "Available amount should match");
        assertEq(position.minHaircut, minHaircut, "Min haircut should match");
        assertEq(position.maxDelay, maxDelay, "Max delay should match");
        assertEq(position.active, true, "Position should be active");
        
        assertEq(lpRegistry.getActiveLPCount(asset), 1, "Should have 1 active LP");
    }
    
    function testWithdrawLiquidity() public {
        uint256 depositAmount = 1000 ether;
        uint256 withdrawAmount = 500 ether;
        
        vm.prank(lp1);
        lpRegistry.depositLiquidity{value: depositAmount}(
            asset,
            depositAmount,
            10000,
            600
        );
        
        vm.prank(lp1);
        lpRegistry.withdrawLiquidity(asset, withdrawAmount);
        
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(lp1, asset);
        assertEq(position.depositedAmount, depositAmount - withdrawAmount, "Deposited amount should decrease");
        assertEq(position.availableAmount, depositAmount - withdrawAmount, "Available amount should decrease");
    }
    
    function testWithdrawLiquidity_Fully() public {
        uint256 amount = 1000 ether;
        
        vm.prank(lp1);
        lpRegistry.depositLiquidity{value: amount}(asset, amount, 10000, 600);
        
        vm.prank(lp1);
        lpRegistry.withdrawLiquidity(asset, amount);
        
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(lp1, asset);
        assertEq(position.active, false, "Position should be inactive");
        assertEq(lpRegistry.getActiveLPCount(asset), 0, "Should have 0 active LPs");
    }
    
    function testMatchLiquidity() public {
        uint256 amount1 = 1000 ether;
        uint256 amount2 = 2000 ether;
        
        // LP1: 1% min haircut
        vm.prank(lp1);
        lpRegistry.depositLiquidity{value: amount1}(asset, amount1, 10000, 600);
        
        // LP2: 0.5% min haircut (better)
        vm.prank(lp2);
        lpRegistry.depositLiquidity{value: amount2}(asset, amount2, 5000, 600);
        
        // Match liquidity with 0.75% requested haircut
        uint256 requestedHaircut = 7500; // 0.75%
        uint256 neededAmount = 500 ether;
        
        (address matchedLP, uint256 availableAmount) = lpRegistry.matchLiquidity(
            asset,
            neededAmount,
            requestedHaircut
        );
        
        // Should match LP2 (lower haircut requirement)
        assertEq(matchedLP, lp2, "Should match LP2");
        assertEq(availableAmount, neededAmount, "Available amount should match");
        
        // Check LP2's available amount decreased
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(lp2, asset);
        assertEq(position.availableAmount, amount2 - neededAmount, "LP2 available should decrease");
    }
    
    function testMatchLiquidity_NoMatch() public {
        uint256 amount = 1000 ether;
        
        // LP with 2% min haircut
        vm.prank(lp1);
        lpRegistry.depositLiquidity{value: amount}(asset, amount, 20000, 600);
        
        // Request 1% haircut (lower than LP's 2% requirement)
        (address matchedLP, uint256 availableAmount) = lpRegistry.matchLiquidity(
            asset,
            500 ether,
            10000 // 1%
        );
        
        assertEq(matchedLP, address(0), "Should not match");
        assertEq(availableAmount, 0, "Available amount should be 0");
    }
    
    function testRecordSettlement() public {
        uint256 amount = 1000 ether;
        
        vm.prank(lp1);
        lpRegistry.depositLiquidity{value: amount}(asset, amount, 10000, 600);
        
        uint256 settlementAmount = 500 ether;
        uint256 haircutEarned = 5000; // 0.5%
        
        lpRegistry.recordSettlement(lp1, asset, settlementAmount, haircutEarned);
        
        LiquidityProviderRegistry.LPPosition memory position = lpRegistry.getPosition(lp1, asset);
        uint256 expectedEarned = (settlementAmount * haircutEarned) / 1000000;
        assertEq(position.totalEarned, expectedEarned, "Total earned should match");
    }
    
    function testMatchLiquidity_PrefersLowerHaircut() public {
        uint256 amount = 1000 ether;
        
        // LP1: 2% min haircut
        vm.prank(lp1);
        lpRegistry.depositLiquidity{value: amount}(asset, amount, 20000, 600);
        
        // LP2: 1% min haircut (better)
        vm.prank(lp2);
        lpRegistry.depositLiquidity{value: amount}(asset, amount, 10000, 600);
        
        // Request 2% haircut (both LPs qualify, but LP2 should be preferred)
        (address matchedLP, ) = lpRegistry.matchLiquidity(asset, 500 ether, 20000);
        
        assertEq(matchedLP, lp2, "Should prefer LP2 (lower haircut)");
    }
}


