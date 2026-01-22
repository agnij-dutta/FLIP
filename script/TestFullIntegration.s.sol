// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FLIPCore} from "../contracts/FLIPCore.sol";
import {EscrowVault} from "../contracts/EscrowVault.sol";
import {SettlementReceipt} from "../contracts/SettlementReceipt.sol";
import {LiquidityProviderRegistry} from "../contracts/LiquidityProviderRegistry.sol";
import {OracleRelay} from "../contracts/OracleRelay.sol";
import {OperatorRegistry} from "../contracts/OperatorRegistry.sol";
import {IFAsset} from "../contracts/interfaces/IFAsset.sol";

/**
 * @title TestFullIntegration
 * @notice Test full integration flow on Coston2
 */
contract TestFullIntegration is Script {
    // Coston2 deployed addresses
    address constant FLIP_CORE = 0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387;
    address payable constant ESCROW_VAULT = payable(0x0E37cc3Dc8Fa1675f2748b77dddfF452b63DD4CC);
    address constant SETTLEMENT_RECEIPT = 0x0Ff7d4E7aF64059426F76d2236155ef1655C99D8;
    address constant LP_REGISTRY = 0x2CC077f1Da27e7e08A1832804B03b30A2990a61C;
    address constant OPERATOR_REGISTRY = 0x21b165aE60748410793e4c2ef248940dc31FE773;
    
    // Test addresses (update with actual test addresses)
    address constant TEST_FASSET = address(0); // Update with actual FAsset address
    address constant TEST_OPERATOR = address(0); // Update with operator address
    
    function run() external {
        // Get private key from environment
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 privateKey;
        
        bytes memory keyBytes = bytes(privateKeyStr);
        if (keyBytes.length > 2 && keyBytes[0] == '0' && keyBytes[1] == 'x') {
            privateKey = vm.parseUint(privateKeyStr);
        } else {
            privateKey = vm.parseUint(string.concat("0x", privateKeyStr));
        }
        
        address deployer = vm.addr(privateKey);
        console.log("Testing with address:", deployer);
        
        vm.startBroadcast(privateKey);
        
        // Test 1: Check contract states
        console.log("\n=== Test 1: Contract States ===");
        FLIPCore flipCore = FLIPCore(FLIP_CORE);
        bool paused = flipCore.paused();
        console.log("FLIPCore paused:", paused);
        
        EscrowVault escrowVault = EscrowVault(ESCROW_VAULT);
        address flipCoreFromEscrow = escrowVault.flipCore();
        console.log("EscrowVault.flipCore:", flipCoreFromEscrow);
        require(flipCoreFromEscrow == FLIP_CORE, "EscrowVault not configured");
        
        LiquidityProviderRegistry lpRegistry = LiquidityProviderRegistry(LP_REGISTRY);
        address flipCoreFromLP = lpRegistry.flipCore();
        console.log("LPRegistry.flipCore:", flipCoreFromLP);
        require(flipCoreFromLP == FLIP_CORE, "LPRegistry not configured");
        
        console.log("[OK] All contracts configured correctly");
        
        // Test 2: Evaluate redemption (view function)
        console.log("\n=== Test 2: Evaluate Redemption ===");
        uint256 testRedemptionId = 0;
        uint256 priceVolatility = 10000; // 1%
        uint256 agentSuccessRate = 980000; // 98%
        uint256 agentStake = 100000 ether; // $100k
        
        (uint8 decision, uint256 score) = flipCore.evaluateRedemption(
            testRedemptionId,
            priceVolatility,
            agentSuccessRate,
            agentStake
        );
        
        console.log("Decision:", decision);
        console.log("Score:", score);
        console.log("[OK] Evaluation works");
        
        // Test 3: Check operator registry
        console.log("\n=== Test 3: Operator Registry ===");
        OperatorRegistry operatorRegistry = OperatorRegistry(OPERATOR_REGISTRY);
        uint256 minStake = operatorRegistry.minStake();
        console.log("Min stake:", minStake);
        console.log("[OK] OperatorRegistry accessible");
        
        vm.stopBroadcast();
        
        console.log("\n=== Integration Test Complete ===");
        console.log("[OK] All basic checks passed");
        console.log("\nNext steps:");
        console.log("1. Deploy OracleRelay (if not deployed)");
        console.log("2. Add operators to OracleRelay");
        console.log("3. Setup demo LPs");
        console.log("4. Test full redemption flow");
    }
}

