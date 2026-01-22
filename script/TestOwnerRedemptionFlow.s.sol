// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FLIPCore} from "../contracts/FLIPCore.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @notice End-to-end “cast-like” flow executed via Foundry broadcast:
 * - Approve FXRP to the NEW FLIPCore
 * - requestRedemption()
 * - ownerProcessRedemption() (bypasses operator staking for demo)
 */
contract TestOwnerRedemptionFlow is Script {
    address constant FXRP = 0x0b6A3645c240605887a5532109323A3E12273dc7;
    address constant FLIP_CORE = 0x162Ba31F4868eF67F3B4dA6fb454e47685c5CF15;

    // Default oracle-ish params used by deterministic scoring (scaled: 1_000_000 = 100%)
    uint256 constant PRICE_VOLATILITY = 50_000;   // 5%
    uint256 constant AGENT_SUCCESS_RATE = 950_000; // 95%
    uint256 constant AGENT_STAKE = 1000 ether;     // arbitrary stake signal

    // 1 FXRP (FXRP uses 6 decimals)
    uint256 constant AMOUNT = 1_000_000;

    string constant XRPL_ADDR = "rfXXKYA7g8knfv8PWcsPx5N1ZofFoNxrHS";

    function run() external {
        // Uses the same signing configuration as your deployment script.
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 pk;
        bytes memory keyBytes = bytes(privateKeyStr);
        if (keyBytes.length > 2 && keyBytes[0] == "0" && keyBytes[1] == "x") {
            pk = vm.parseUint(privateKeyStr);
        } else {
            pk = vm.parseUint(string.concat("0x", privateKeyStr));
        }

        address sender = vm.addr(pk);
        console.log("Sender:", sender);
        console.log("FLIPCore:", FLIP_CORE);
        console.log("FXRP:", FXRP);

        vm.startBroadcast(pk);

        // Approve FXRP
        require(IERC20(FXRP).approve(FLIP_CORE, type(uint256).max), "approve failed");
        console.log("Approved FXRP spending for FLIPCore");

        // Request redemption (burns FXRP in FLIPCore)
        uint256 redemptionId = FLIPCore(FLIP_CORE).requestRedemption(AMOUNT, FXRP, XRPL_ADDR);
        console.log("Requested redemptionId:", redemptionId);

        // Process redemption immediately (creates escrow + emits EscrowCreated)
        FLIPCore(FLIP_CORE).ownerProcessRedemption(
            redemptionId,
            PRICE_VOLATILITY,
            AGENT_SUCCESS_RATE,
            AGENT_STAKE
        );
        console.log("ownerProcessRedemption done for:", redemptionId);

        vm.stopBroadcast();
    }
}



