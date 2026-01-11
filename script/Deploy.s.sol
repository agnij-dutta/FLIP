// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {EscrowVault} from "../contracts/EscrowVault.sol";
import {SettlementReceipt} from "../contracts/SettlementReceipt.sol";
import {LiquidityProviderRegistry} from "../contracts/LiquidityProviderRegistry.sol";
import {OperatorRegistry} from "../contracts/OperatorRegistry.sol";
import {FtsoV2Adapter} from "../contracts/FtsoV2Adapter.sol";
import {PriceHedgePool} from "../contracts/PriceHedgePool.sol";
import {FLIPCore} from "../contracts/FLIPCore.sol";

contract Deploy is Script {
    // Coston2 addresses
    address constant FTSOV2_ADDRESS = 0x3d893C53D9e8056135C26C8c638B76C8b60Df726;
    address constant STATE_CONNECTOR = address(0); // Placeholder
    address constant FIRELIGHT_PROTOCOL = address(0); // Placeholder
    
    uint256 constant MIN_STAKE = 1000 ether; // 1000 C2FLR
    
    function run() external {
        // Get private key from environment (with or without 0x prefix)
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey;
        
        // Remove 0x prefix if present
        bytes memory keyBytes = bytes(privateKeyStr);
        if (keyBytes.length > 2 && keyBytes[0] == '0' && keyBytes[1] == 'x') {
            // Has 0x prefix, parse as hex
            deployerPrivateKey = vm.parseUint(privateKeyStr);
        } else {
            // No prefix, parse as hex string
            deployerPrivateKey = vm.parseUint(string.concat("0x", privateKeyStr));
        }
        
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts to Coston2...");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy EscrowVault
        console.log("Deploying EscrowVault...");
        EscrowVault escrowVault = new EscrowVault();
        console.log("EscrowVault deployed to:", address(escrowVault));
        
        // 2. Deploy SettlementReceipt
        console.log("Deploying SettlementReceipt...");
        SettlementReceipt settlementReceipt = new SettlementReceipt(address(escrowVault));
        console.log("SettlementReceipt deployed to:", address(settlementReceipt));
        
        // 3. Deploy LiquidityProviderRegistry
        console.log("Deploying LiquidityProviderRegistry...");
        LiquidityProviderRegistry lpRegistry = new LiquidityProviderRegistry();
        console.log("LiquidityProviderRegistry deployed to:", address(lpRegistry));
        
        // 4. Deploy OperatorRegistry
        console.log("Deploying OperatorRegistry...");
        OperatorRegistry operatorRegistry = new OperatorRegistry(MIN_STAKE);
        console.log("OperatorRegistry deployed to:", address(operatorRegistry));
        
        // 5. Deploy FtsoV2Adapter
        console.log("Deploying FtsoV2Adapter...");
        FtsoV2Adapter ftsoAdapter = new FtsoV2Adapter(FTSOV2_ADDRESS);
        console.log("FtsoV2Adapter deployed to:", address(ftsoAdapter));
        
        // 6. Deploy PriceHedgePool
        console.log("Deploying PriceHedgePool...");
        PriceHedgePool priceHedgePool = new PriceHedgePool(address(ftsoAdapter));
        console.log("PriceHedgePool deployed to:", address(priceHedgePool));
        
        // 7. Deploy FLIPCore
        console.log("Deploying FLIPCore...");
        FLIPCore flipCore = new FLIPCore(
            address(ftsoAdapter),
            STATE_CONNECTOR,
            address(escrowVault),
            address(settlementReceipt),
            address(lpRegistry),
            address(priceHedgePool),
            address(operatorRegistry)
        );
        console.log("FLIPCore deployed to:", address(flipCore));
        
        // 8. Configure contracts
        console.log("Configuring contracts...");
        escrowVault.setFLIPCore(address(flipCore));
        lpRegistry.setFLIPCore(address(flipCore));
        settlementReceipt.setFLIPCore(address(flipCore));
        console.log("Configuration complete!");
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("\n=== Deployment Summary ===");
        console.log("EscrowVault:", address(escrowVault));
        console.log("SettlementReceipt:", address(settlementReceipt));
        console.log("LiquidityProviderRegistry:", address(lpRegistry));
        console.log("OperatorRegistry:", address(operatorRegistry));
        console.log("FtsoV2Adapter:", address(ftsoAdapter));
        console.log("PriceHedgePool:", address(priceHedgePool));
        console.log("FLIPCore:", address(flipCore));
    }
}

