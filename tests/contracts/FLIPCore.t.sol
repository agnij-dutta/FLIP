// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../../contracts/FLIPCore.sol";
import "../../contracts/InsurancePool.sol";
import "../../contracts/PriceHedgePool.sol";
import "../../contracts/OperatorRegistry.sol";
import "../../contracts/OracleRelay.sol";
import "./mocks/MockFtsoRegistry.sol";
import "./mocks/MockStateConnector.sol";
import "./mocks/MockFAsset.sol";

contract FLIPCoreTest is Test {
    FLIPCore public flipCore;
    InsurancePool public insurancePool;
    PriceHedgePool public priceHedgePool;
    OperatorRegistry public operatorRegistry;
    OracleRelay public oracleRelay;
    MockFtsoRegistry public ftsoRegistry;
    MockStateConnector public stateConnector;
    MockFAsset public fAsset;

    address public user = address(0x1);
    address public operator = address(0x2);

    function setUp() public {
        // Deploy mocks
        ftsoRegistry = new MockFtsoRegistry();
        stateConnector = new MockStateConnector();
        insurancePool = new InsurancePool();
        priceHedgePool = new PriceHedgePool(address(ftsoRegistry));
        operatorRegistry = new OperatorRegistry(1000 ether);
        oracleRelay = new OracleRelay();

        // Deploy FLIPCore
        flipCore = new FLIPCore(
            address(ftsoRegistry),
            address(stateConnector),
            address(insurancePool),
            address(priceHedgePool),
            address(operatorRegistry),
            address(oracleRelay)
        );

        // Setup
        vm.deal(user, 10000 ether);
        vm.deal(operator, 10000 ether);
        
        // Register operator
        operatorRegistry.addOperator(operator);
        vm.prank(operator);
        operatorRegistry.stake{value: 1000 ether}(1000 ether);
    }

    function testRequestRedemption() public {
        uint256 amount = 100 ether;
        
        vm.prank(user);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));

        assertEq(redemptionId, 0);
        assertEq(flipCore.getRedemptionStatus(redemptionId), FLIPCore.RedemptionStatus.Pending);
    }

    function testFinalizeProvisional() public {
        uint256 amount = 100 ether;
        
        vm.prank(user);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));

        // Fund insurance pool
        vm.deal(address(insurancePool), 10000 ether);
        insurancePool.replenishPool{value: 10000 ether}();

        // Submit high-confidence prediction
        vm.prank(operator);
        oracleRelay.submitPrediction(
            redemptionId,
            998000, // 0.998 probability
            997000, // 0.997 lower bound
            999000, // 0.999 upper bound
            ""
        );

        // Finalize provisional
        vm.prank(operator);
        flipCore.finalizeProvisional(redemptionId, "");

        assertEq(flipCore.getRedemptionStatus(redemptionId), FLIPCore.RedemptionStatus.ProvisionallySettled);
    }

    function testClaimFailure() public {
        uint256 amount = 100 ether;
        
        vm.prank(user);
        uint256 redemptionId = flipCore.requestRedemption(amount, address(fAsset));

        // Fund insurance pool
        vm.deal(address(insurancePool), 10000 ether);
        insurancePool.replenishPool{value: 10000 ether}();

        // Finalize provisional
        vm.prank(operator);
        oracleRelay.submitPrediction(redemptionId, 998000, 997000, 999000, "");
        vm.prank(operator);
        flipCore.finalizeProvisional(redemptionId, "");

        // FDC confirms failure
        vm.prank(operator);
        flipCore.handleFDCAttestation(redemptionId, 1, false);

        assertEq(flipCore.getRedemptionStatus(redemptionId), FLIPCore.RedemptionStatus.InsuranceClaimed);
    }
}



