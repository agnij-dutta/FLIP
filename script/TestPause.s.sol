// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FLIPCore} from "../contracts/FLIPCore.sol";

contract TestPauseScript is Script {
    // Deployed FLIPCore address on Coston2
    address constant FLIPCORE_ADDRESS = 0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387;
    
    function run() external {
        // Get private key from environment
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey;
        
        bytes memory keyBytes = bytes(privateKeyStr);
        if (keyBytes.length > 2 && keyBytes[0] == '0' && keyBytes[1] == 'x') {
            deployerPrivateKey = vm.parseUint(privateKeyStr);
        } else {
            deployerPrivateKey = vm.parseUint(string.concat("0x", privateKeyStr));
        }
        
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Testing pause functionality...");
        console.log("Deployer:", deployer);
        console.log("FLIPCore:", FLIPCORE_ADDRESS);
        
        vm.startBroadcast(deployerPrivateKey);
        
        FLIPCore flipCore = FLIPCore(FLIPCORE_ADDRESS);
        
        // 1. Check initial pause status
        console.log("\n=== Step 1: Check Initial Pause Status ===");
        bool paused = flipCore.paused();
        address owner = flipCore.owner();
        console.log("Paused:", paused);
        console.log("Owner:", owner);
        console.log("Deployer is owner:", deployer == owner);
        
        require(!paused, "Contract should not be paused initially");
        require(owner == deployer, "Deployer should be owner");
        
        // 2. Test pause
        console.log("\n=== Step 2: Pause Contract ===");
        flipCore.pause();
        console.log("Pause transaction sent");
        
        // Wait for transaction to be mined (simulate)
        vm.stopBroadcast();
        vm.startBroadcast(deployerPrivateKey);
        
        // Check pause status after pause
        paused = flipCore.paused();
        console.log("Paused after pause():", paused);
        require(paused, "Contract should be paused");
        
        // 3. Test that pause blocks new redemptions
        console.log("\n=== Step 3: Verify Pause Blocks Redemptions ===");
        // Note: We can't actually call requestRedemption here because it requires FAsset tokens
        // But we can verify the pause state is correct
        console.log("Pause status verified - new redemptions would be blocked");
        
        // 4. Test unpause
        console.log("\n=== Step 4: Unpause Contract ===");
        flipCore.unpause();
        console.log("Unpause transaction sent");
        
        // Wait for transaction to be mined (simulate)
        vm.stopBroadcast();
        vm.startBroadcast(deployerPrivateKey);
        
        // Check pause status after unpause
        paused = flipCore.paused();
        console.log("Paused after unpause():", paused);
        require(!paused, "Contract should not be paused after unpause");
        
        // 5. Test that non-owner cannot pause (simulation only, not broadcast)
        console.log("\n=== Step 5: Verify Only Owner Can Pause ===");
        address nonOwner = address(0x123);
        vm.stopBroadcast();
        
        // Simulate non-owner trying to pause (this will revert)
        vm.prank(nonOwner);
        try flipCore.pause() {
            console.log("ERROR: Non-owner was able to pause!");
            revert("Non-owner should not be able to pause");
        } catch {
            console.log("SUCCESS: Non-owner cannot pause (expected revert)");
        }
        
        // 6. Final status
        console.log("\n=== Final Status ===");
        vm.startBroadcast(deployerPrivateKey);
        paused = flipCore.paused();
        console.log("Final pause status:", paused);
        console.log("Owner:", flipCore.owner());
        
        console.log("\n=== Pause Functionality Test Complete ===");
        console.log("All tests passed!");
        
        vm.stopBroadcast();
    }
}

