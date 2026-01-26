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
import {OracleRelay} from "../contracts/OracleRelay.sol";
import {BlazeFLIPVault} from "../contracts/BlazeFLIPVault.sol";

/// @dev Simple ERC20 mock for FXRP on testnet
contract MockFXRP {
    string public name = "Mock FXRP";
    string public symbol = "FXRP";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "not allowed");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function burn(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    // IFAsset compatibility
    function requestRedemption(uint256) external pure returns (uint256) { return 0; }
    function getRedemption(uint256) external pure returns (address, uint256, uint256) { return (address(0), 0, 0); }
}

contract DeployBlazeBackstop is Script {
    // Coston2 infrastructure
    address constant FTSOV2_ADDRESS = 0x3d893C53D9e8056135C26C8c638B76C8b60Df726;
    address constant STATE_CONNECTOR = address(0); // Placeholder for testnet
    address constant BLAZE_ROUTER = 0x8D29b61C41CF318d15d031BE2928F79630e068e6;
    address constant WCFLR = 0xC67DCE33D7A8efA5FfEB961899C73fe01bCe9273;

    uint256 constant MIN_STAKE = 1000 ether;

    // Vault configuration
    uint256 constant ALLOCATION_RATIO = 300000;      // 30%
    uint256 constant MIN_HAIRCUT = 1000;             // 0.1%
    uint256 constant MAX_DELAY = 600;                // 10 minutes
    uint256 constant MAX_SLIPPAGE_BPS = 100;         // 1%
    uint256 constant BACKSTOP_MAX_PER_TX = 50 ether; // 50 FLR
    uint256 constant MIN_DEPOSIT_DELAY = 300;        // 5 min (short for testnet)
    uint256 constant REBALANCE_THRESHOLD = 100000;   // 10%

    // Initial vault funding
    uint256 constant VAULT_INITIAL_DEPOSIT = 100 ether; // 100 C2FLR

    function run() external {
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey;

        bytes memory keyBytes = bytes(privateKeyStr);
        if (keyBytes.length > 2 && keyBytes[0] == '0' && keyBytes[1] == 'x') {
            deployerPrivateKey = vm.parseUint(privateKeyStr);
        } else {
            deployerPrivateKey = vm.parseUint(string.concat("0x", privateKeyStr));
        }

        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== Full FLIP + BlazeSwap Backstop Deployment to Coston2 ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // ============ PHASE 1: Deploy Mock FXRP Token ============
        console.log("\n--- Phase 1: Mock FXRP Token ---");
        MockFXRP fxrp = new MockFXRP();
        console.log("MockFXRP deployed to:", address(fxrp));

        // ============ PHASE 2: Deploy Core FLIP Contracts ============
        console.log("\n--- Phase 2: Core FLIP Contracts ---");

        EscrowVault escrowVault = new EscrowVault();
        console.log("EscrowVault:", address(escrowVault));

        SettlementReceipt settlementReceipt = new SettlementReceipt(address(escrowVault));
        console.log("SettlementReceipt:", address(settlementReceipt));

        LiquidityProviderRegistry lpRegistry = new LiquidityProviderRegistry();
        console.log("LiquidityProviderRegistry:", address(lpRegistry));

        OperatorRegistry operatorRegistry = new OperatorRegistry(MIN_STAKE);
        console.log("OperatorRegistry:", address(operatorRegistry));

        FtsoV2Adapter ftsoAdapter = new FtsoV2Adapter(FTSOV2_ADDRESS);
        console.log("FtsoV2Adapter:", address(ftsoAdapter));

        PriceHedgePool priceHedgePool = new PriceHedgePool(address(ftsoAdapter));
        console.log("PriceHedgePool:", address(priceHedgePool));

        OracleRelay oracleRelay = new OracleRelay();
        console.log("OracleRelay:", address(oracleRelay));

        FLIPCore flipCore = new FLIPCore(
            address(ftsoAdapter),
            STATE_CONNECTOR,
            address(escrowVault),
            address(settlementReceipt),
            address(lpRegistry),
            address(priceHedgePool),
            address(operatorRegistry)
        );
        console.log("FLIPCore:", address(flipCore));

        // ============ PHASE 3: Wire Core Contracts ============
        console.log("\n--- Phase 3: Wire Core Contracts ---");
        escrowVault.setFLIPCore(address(flipCore));
        escrowVault.setSettlementReceipt(address(settlementReceipt));
        lpRegistry.setFLIPCore(address(flipCore));
        lpRegistry.setEscrowVault(address(escrowVault));
        settlementReceipt.setFLIPCore(address(flipCore));
        console.log("Core wiring complete");

        // ============ PHASE 4: Deploy BlazeFLIPVault ============
        console.log("\n--- Phase 4: BlazeFLIPVault ---");

        BlazeFLIPVault vault = new BlazeFLIPVault(
            BLAZE_ROUTER,
            address(lpRegistry),
            address(fxrp)
        );
        console.log("BlazeFLIPVault:", address(vault));

        // Configure vault
        vault.setAllocationRatio(ALLOCATION_RATIO);
        vault.setMinHaircut(MIN_HAIRCUT);
        vault.setMaxDelay(MAX_DELAY);
        vault.setMaxSlippageBps(MAX_SLIPPAGE_BPS);
        vault.setBackstopMaxPerTx(BACKSTOP_MAX_PER_TX);
        vault.setBackstopEnabled(true);
        vault.setMinDepositDelay(MIN_DEPOSIT_DELAY);
        vault.setRebalanceThreshold(REBALANCE_THRESHOLD);
        console.log("Vault configured");

        // ============ PHASE 5: Wire Backstop ============
        console.log("\n--- Phase 5: Wire Backstop ---");
        lpRegistry.setBackstopVault(address(vault));
        console.log("Backstop vault set in LPRegistry");

        // ============ PHASE 6: Fund Vault ============
        console.log("\n--- Phase 6: Fund Vault ---");

        // Deposit FLR into vault
        (bool depositSuccess,) = address(vault).call{value: VAULT_INITIAL_DEPOSIT}(
            abi.encodeWithSignature("deposit()")
        );
        require(depositSuccess, "Vault deposit failed");
        console.log("Deposited 100 C2FLR into vault");

        // Deploy allocation to FLIP LP registry
        vault.deployToFlip();
        console.log("Deployed 30% allocation to FLIP");

        vm.stopBroadcast();

        // ============ SUMMARY ============
        console.log("\n========================================");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("========================================");
        console.log("\nCore Contracts:");
        console.log("  FLIPCore:             ", address(flipCore));
        console.log("  EscrowVault:          ", address(escrowVault));
        console.log("  SettlementReceipt:    ", address(settlementReceipt));
        console.log("  LPRegistry:           ", address(lpRegistry));
        console.log("  OperatorRegistry:     ", address(operatorRegistry));
        console.log("  FtsoV2Adapter:        ", address(ftsoAdapter));
        console.log("  PriceHedgePool:       ", address(priceHedgePool));
        console.log("  OracleRelay:          ", address(oracleRelay));
        console.log("\nBlazeSwap Backstop:");
        console.log("  BlazeFLIPVault:       ", address(vault));
        console.log("  BlazeSwap Router:     ", BLAZE_ROUTER);
        console.log("  WCFLR:                ", WCFLR);
        console.log("\nTokens:");
        console.log("  MockFXRP:             ", address(fxrp));
        console.log("\nVault Config:");
        console.log("  Allocation: 30% | Min Haircut: 0.1% | Max Slippage: 1%");
        console.log("  Backstop Max/Tx: 50 FLR | Deposit Lockup: 5 min");
        console.log("  Initial Deposit: 100 C2FLR | Deployed to FLIP: 30 C2FLR");
    }
}
