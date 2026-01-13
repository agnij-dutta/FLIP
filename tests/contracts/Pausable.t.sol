// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/Pausable.sol";

// Test contract that inherits Pausable
contract TestPausable is Pausable {
    function testFunction() external whenNotPaused returns (bool) {
        return true;
    }
}

contract PausableTest is Test {
    TestPausable public pausable;
    
    function setUp() public {
        pausable = new TestPausable();
    }
    
    function testPause() public {
        // Initially not paused
        assertFalse(pausable.paused());
        
        // Owner can pause
        pausable.pause();
        assertTrue(pausable.paused());
    }
    
    function testUnpause() public {
        pausable.pause();
        assertTrue(pausable.paused());
        
        // Owner can unpause
        pausable.unpause();
        assertFalse(pausable.paused());
    }
    
    function testPauseBlocksFunction() public {
        // Function works when not paused
        assertTrue(pausable.testFunction());
        
        // Pause
        pausable.pause();
        
        // Function blocked when paused
        vm.expectRevert("Pausable: paused");
        pausable.testFunction();
    }
    
    function testPauseOnlyOwner() public {
        // Non-owner cannot pause
        vm.prank(address(0x123));
        vm.expectRevert("Pausable: not owner");
        pausable.pause();
    }
    
    function testUnpauseOnlyOwner() public {
        pausable.pause();
        
        // Non-owner cannot unpause
        vm.prank(address(0x123));
        vm.expectRevert("Pausable: not owner");
        pausable.unpause();
    }
}


