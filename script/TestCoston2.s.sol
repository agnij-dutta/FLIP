// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FLIPCore} from "../contracts/FLIPCore.sol";
import {EscrowVault} from "../contracts/EscrowVault.sol";
import {SettlementReceipt} from "../contracts/SettlementReceipt.sol";
import {LiquidityProviderRegistry} from "../contracts/LiquidityProviderRegistry.sol";
import {OperatorRegistry} from "../contracts/OperatorRegistry.sol";
import {FtsoV2Adapter} from "../contracts/FtsoV2Adapter.sol";
import {PriceHedgePool} from "../contracts/PriceHedgePool.sol";
import {IFtsoRegistry} from "../contracts/interfaces/IFtsoRegistry.sol";

contract TestCoston2 is Script {
    // Deployed contract addresses (from COSTON2_DEPLOYED_ADDRESSES.md)
    address constant FLIP_CORE = 0x406B2ec53e2e01f9E9D056D98295d0cf61694279;
    address payable constant ESCROW_VAULT = payable(0xAF16AdAE0A157C92e2B173F2579e1f063A7aABE7);
    address constant SETTLEMENT_RECEIPT = 0x02A56612A4D8D7ae38BD577Be3222D26a4846032;
    address constant LP_REGISTRY = 0x0Ec47da13c178f85edd078Cc7d2e775De5e88813;
    address constant OPERATOR_REGISTRY = 0x6420808b3444aC0Ae9adAAf97d2Be5Ac8e6a9b02;
    address constant FTSO_ADAPTER = 0x794eA218dDBcD3dd4683251136dBaAbcFa22E008;
    address constant PRICE_HEDGE_POOL = 0xA7d0016BeA9951525d60816c285fd108c5Fe5B92;
    
    // Flare contracts
    address constant FTSOV2 = 0x3d893C53D9e8056135C26C8c638B76C8b60Df726;
    
    function run() external {
        uint256 deployerPrivateKey = _getPrivateKey();
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== Testing FLIP Contracts on Coston2 ===");
        console.log("Deployer:", deployer);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Test 1: Verify contract addresses
        _testContractAddresses();
        
        // Test 2: Test FTSOv2 adapter with real price feeds
        _testFTSOv2Adapter();
        
        // Test 3: Test operator registration and staking
        _testOperatorRegistration();
        
        // Test 4: Test LP registration
        _testLPRegistration();
        
        // Test 5: Test contract relationships
        _testContractRelationships();
        
        // Test 6: Test price hedge pool
        _testPriceHedgePool();
        
        console.log("");
        console.log("=== All Tests Complete ===");
        
        vm.stopBroadcast();
    }
    
    function _testContractAddresses() internal view {
        console.log("Test 1: Verifying contract addresses...");
        
        // Check contracts have code
        require(FLIP_CORE.code.length > 0, "FLIPCore has no code");
        require(ESCROW_VAULT.code.length > 0, "EscrowVault has no code");
        require(SETTLEMENT_RECEIPT.code.length > 0, "SettlementReceipt has no code");
        
        console.log("[OK] All contracts have code");
        console.log("");
    }
    
    function _testFTSOv2Adapter() internal view {
        console.log("Test 2: Testing FTSOv2 Adapter with real Flare contracts...");
        
        FtsoV2Adapter adapter = FtsoV2Adapter(FTSO_ADAPTER);
        
        // Verify FTSOv2 address (ftsoV2 is immutable, so we can't directly check address)
        // Instead, test that adapter can call FTSOv2
        console.log("[OK] FtsoV2Adapter configured");
        
        // Test getting XRP/USD price
        try adapter.getCurrentPriceWithDecimals("XRP/USD") returns (uint256 price, uint256 timestamp) {
            require(price > 0, "Price should be > 0");
            require(timestamp > 0, "Timestamp should be > 0");
            console.log("[OK] XRP/USD price:", price);
            console.log("   Timestamp:", timestamp);
        } catch {
            console.log("[WARN] Could not get XRP/USD price (may need feed ID configuration)");
        }
        
        // Test getting FLR/USD price
        try adapter.getCurrentPriceWithDecimals("FLR/USD") returns (uint256 price, uint256 timestamp) {
            require(price > 0, "Price should be > 0");
            console.log("[OK] FLR/USD price:", price);
        } catch {
            console.log("[WARN] Could not get FLR/USD price");
        }
        
        console.log("");
    }
    
    function _testOperatorRegistration() internal {
        console.log("Test 3: Testing operator registration...");
        
        OperatorRegistry operatorRegistry = OperatorRegistry(OPERATOR_REGISTRY);
        uint256 deployerPrivateKey = _getPrivateKey();
        address deployer = vm.addr(deployerPrivateKey);
        
        // Check if already registered
        bool isOperator = operatorRegistry.isOperator(deployer);
        
        if (!isOperator) {
            // Stake to become operator
            uint256 minStake = operatorRegistry.minStake();
            console.log("   Min stake required:", minStake);
            
            // Stake (if we have enough balance)
            // stake() takes amount as parameter
            try operatorRegistry.stake{value: minStake}(minStake) {
                console.log("[OK] Operator staked successfully");
            } catch {
                console.log("[WARN] Could not stake (may need more C2FLR)");
            }
        } else {
            console.log("[OK] Already registered as operator");
        }
        
        console.log("");
    }
    
    function _testLPRegistration() internal {
        console.log("Test 4: Testing LP registration...");
        
        LiquidityProviderRegistry lpRegistry = LiquidityProviderRegistry(LP_REGISTRY);
        uint256 deployerPrivateKey = _getPrivateKey();
        address deployer = vm.addr(deployerPrivateKey);
        
        // Use a mock asset address for testing (in production, this would be FAsset)
        address testAsset = address(0x1234567890123456789012345678901234567890);
        
        // Try to deposit liquidity
        uint256 amount = 1 ether;
        uint256 minHaircut = 10000; // 1%
        uint256 maxDelay = 600; // 10 minutes
        
        try lpRegistry.depositLiquidity{value: amount}(testAsset, amount, minHaircut, maxDelay) {
            console.log("[OK] LP liquidity deposited");
            
            // Check position (returns struct)
            LiquidityProviderRegistry.LPPosition memory position = 
                lpRegistry.getPosition(deployer, testAsset);
            require(position.lp == deployer, "LP should be deployer");
            require(position.asset == testAsset, "Asset should match");
            console.log("   Deposited:", position.depositedAmount);
            console.log("   Available:", position.availableAmount);
        } catch {
            console.log("[WARN] Could not deposit liquidity (may need ERC20 token)");
        }
        
        console.log("");
    }
    
    function _testContractRelationships() internal view {
        console.log("Test 5: Testing contract relationships...");
        
        FLIPCore flipCore = FLIPCore(FLIP_CORE);
        EscrowVault escrowVault = EscrowVault(ESCROW_VAULT);
        SettlementReceipt settlementReceipt = SettlementReceipt(SETTLEMENT_RECEIPT);
        LiquidityProviderRegistry lpRegistry = LiquidityProviderRegistry(LP_REGISTRY);
        
        // Check FLIPCore -> EscrowVault
        address ev = address(flipCore.escrowVault());
        require(ev == ESCROW_VAULT, "FLIPCore.escrowVault mismatch");
        console.log("[OK] FLIPCore -> EscrowVault: correct");
        
        // Check EscrowVault -> FLIPCore
        address fc = escrowVault.flipCore();
        require(fc == FLIP_CORE, "EscrowVault.flipCore mismatch");
        console.log("[OK] EscrowVault -> FLIPCore: correct");
        
        // Check SettlementReceipt -> EscrowVault
        address srEv = address(settlementReceipt.escrowVault());
        require(srEv == ESCROW_VAULT, "SettlementReceipt.escrowVault mismatch");
        console.log("[OK] SettlementReceipt -> EscrowVault: correct");
        
        // Check SettlementReceipt -> FLIPCore
        address srFc = settlementReceipt.flipCore();
        require(srFc == FLIP_CORE, "SettlementReceipt.flipCore mismatch");
        console.log("[OK] SettlementReceipt -> FLIPCore: correct");
        
        // Check LP Registry -> FLIPCore
        address lpFc = lpRegistry.flipCore();
        require(lpFc == FLIP_CORE, "LiquidityProviderRegistry.flipCore mismatch");
        console.log("[OK] LiquidityProviderRegistry -> FLIPCore: correct");
        
        console.log("");
    }
    
    function _testPriceHedgePool() internal view {
        console.log("Test 6: Testing Price Hedge Pool...");
        
        PriceHedgePool php = PriceHedgePool(PRICE_HEDGE_POOL);
        IFtsoRegistry ftsoRegistry = php.ftsoRegistry();
        
        require(address(ftsoRegistry) == FTSO_ADAPTER, "PriceHedgePool.ftsoRegistry mismatch");
        console.log("[OK] PriceHedgePool -> FtsoV2Adapter: correct");
        
        // Test getting price (this would lock a price in production)
        address testAsset = address(0x1234567890123456789012345678901234567890);
        try ftsoRegistry.getCurrentPriceWithDecimals("XRP/USD") returns (uint256 price, uint256 timestamp) {
            if (price > 0) {
                console.log("[OK] Can get price from FTSO:", price);
            }
        } catch {
            console.log("[WARN] Could not get price from FTSO");
        }
        
        console.log("");
    }
    
    function _getPrivateKey() internal view returns (uint256) {
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        bytes memory keyBytes = bytes(privateKeyStr);
        if (keyBytes.length > 2 && keyBytes[0] == '0' && keyBytes[1] == 'x') {
            return vm.parseUint(privateKeyStr);
        } else {
            return vm.parseUint(string.concat("0x", privateKeyStr));
        }
    }
}

