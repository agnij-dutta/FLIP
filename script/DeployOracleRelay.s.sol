// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OracleRelay} from "../contracts/OracleRelay.sol";

contract DeployOracleRelay is Script {
    function run() external {
        // Get private key from environment (with or without 0x prefix)
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey;
        
        // Remove 0x prefix if present
        bytes memory keyBytes = bytes(privateKeyStr);
        if (keyBytes.length > 2 && keyBytes[0] == '0' && keyBytes[1] == 'x') {
            deployerPrivateKey = vm.parseUint(privateKeyStr);
        } else {
            deployerPrivateKey = vm.parseUint(string.concat("0x", privateKeyStr));
        }
        
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying OracleRelay to Coston2...");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        OracleRelay oracleRelay = new OracleRelay();
        console.log("OracleRelay deployed to:", address(oracleRelay));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Complete ===");
        console.log("OracleRelay:", address(oracleRelay));
        console.log("\nNext steps:");
        console.log("1. Add operators: oracleRelay.addOperator(operatorAddress)");
        console.log("2. Update COSTON2_DEPLOYED_ADDRESSES.md with OracleRelay address");
    }
}

