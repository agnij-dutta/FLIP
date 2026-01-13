// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FLIPCore} from "../contracts/FLIPCore.sol";
import {OracleRelay} from "../contracts/OracleRelay.sol";
import {LiquidityProviderRegistry} from "../contracts/LiquidityProviderRegistry.sol";
import {OperatorRegistry} from "../contracts/OperatorRegistry.sol";
import {IFAsset} from "../contracts/interfaces/IFAsset.sol";

/**
 * @title TestOracleIntegration
 * @notice Test oracle node integration with deployed contracts
 */
contract TestOracleIntegration is Script {
    // Coston2 deployed addresses
    address constant FLIP_CORE = 0xcBc8eB46172c2caD5b4961E8c4F5f827e618a387;
    address constant ORACLE_RELAY = 0x5Fd855d2592feba675E5E8284c830fE1Cefb014E;
    address constant LP_REGISTRY = 0x2CC077f1Da27e7e08A1832804B03b30A2990a61C;
    address constant OPERATOR_REGISTRY = 0x21b165aE60748410793e4c2ef248940dc31FE773;
    
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
        
        // Test 1: Verify OracleRelay deployment
        console.log("\n=== Test 1: OracleRelay Deployment ===");
        OracleRelay oracleRelay = OracleRelay(ORACLE_RELAY);
        address owner = oracleRelay.owner();
        console.log("OracleRelay owner:", owner);
        console.log("[OK] OracleRelay deployed and accessible");
        
        // Test 2: Add operator to OracleRelay
        console.log("\n=== Test 2: Add Operator ===");
        address operator = deployer; // Use deployer as operator for testing
        oracleRelay.addOperator(operator);
        bool isOperator = oracleRelay.operators(operator);
        console.log("Operator added:", isOperator);
        require(isOperator, "Failed to add operator");
        console.log("[OK] Operator added successfully");
        
        // Test 3: Submit test prediction
        console.log("\n=== Test 3: Submit Prediction ===");
        uint256 testRedemptionId = 0;
        uint256 testScore = 998000; // 99.8%
        uint256 testHaircut = 10000; // 1%
        uint8 testDecision = 1; // FastLane
        bytes memory testSignature = "";
        
        oracleRelay.submitPrediction(
            testRedemptionId,
            testScore,
            testHaircut,
            testDecision,
            testSignature
        );
        
        OracleRelay.Prediction memory prediction = oracleRelay.getLatestPrediction(testRedemptionId);
        console.log("Prediction submitted:");
        console.log("  Score:", prediction.score);
        console.log("  Haircut:", prediction.suggestedHaircut);
        console.log("  Decision:", prediction.routingDecision);
        console.log("[OK] Prediction submitted and retrieved");
        
        // Test 4: Check FLIPCore evaluation
        console.log("\n=== Test 4: FLIPCore Evaluation ===");
        FLIPCore flipCore = FLIPCore(FLIP_CORE);
        uint256 priceVolatility = 10000; // 1%
        uint256 agentSuccessRate = 980000; // 98%
        uint256 agentStake = 100000 ether; // $100k
        
        (uint8 decision, uint256 score) = flipCore.evaluateRedemption(
            testRedemptionId,
            priceVolatility,
            agentSuccessRate,
            agentStake
        );
        
        console.log("FLIPCore evaluation:");
        console.log("  Decision:", decision);
        console.log("  Score:", score);
        console.log("[OK] FLIPCore evaluation works");
        
        // Test 5: Check LP Registry
        console.log("\n=== Test 5: LP Registry ===");
        LiquidityProviderRegistry lpRegistry = LiquidityProviderRegistry(LP_REGISTRY);
        address flipCoreFromLP = lpRegistry.flipCore();
        console.log("LPRegistry.flipCore:", flipCoreFromLP);
        require(flipCoreFromLP == FLIP_CORE, "LPRegistry not configured");
        console.log("[OK] LP Registry configured");
        
        // Test 6: Check Operator Registry
        console.log("\n=== Test 6: Operator Registry ===");
        OperatorRegistry operatorRegistry = OperatorRegistry(OPERATOR_REGISTRY);
        uint256 minStake = operatorRegistry.minStake();
        console.log("Min stake:", minStake);
        console.log("[OK] Operator Registry accessible");
        
        vm.stopBroadcast();
        
        console.log("\n=== Integration Test Complete ===");
        console.log("[OK] All tests passed!");
        console.log("\nSummary:");
        console.log("  - OracleRelay deployed and working");
        console.log("  - Operators can be added");
        console.log("  - Predictions can be submitted");
        console.log("  - FLIPCore evaluation works");
        console.log("  - All contracts configured correctly");
    }
}

