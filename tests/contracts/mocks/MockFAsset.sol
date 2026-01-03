// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../../contracts/interfaces/IFAsset.sol";

contract MockFAsset is IFAsset {
    mapping(address => uint256) public balances;
    mapping(address => address) public redemptionCaller; // Tracks who called requestRedemption for whom
    uint256 public nextRedemptionId;

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    function burn(uint256 _amount) public override {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        balances[msg.sender] -= _amount;
    }

    function requestRedemption(uint256 _amount) external override returns (uint256 _redemptionId) {
        // In real FAsset, the user calls this directly
        // In our tests, FLIPCore calls this, so we need to find which user has the tokens
        // Simple approach: burn from the first address that has sufficient balance
        // This is a mock - in production, user would call requestRedemption directly
        address userToBurnFrom = address(0);
        // Check common test addresses (0x1, 0x2, etc.)
        address[] memory testUsers = new address[](10);
        testUsers[0] = address(0x1);
        testUsers[1] = address(0x2);
        testUsers[2] = address(0x3);
        testUsers[3] = address(0x4);
        testUsers[4] = address(0x5);
        testUsers[5] = address(0x6);
        testUsers[6] = address(0x7);
        testUsers[7] = address(0x8);
        testUsers[8] = address(0x9);
        testUsers[9] = address(0xA);
        
        for (uint256 i = 0; i < testUsers.length; i++) {
            if (balances[testUsers[i]] >= _amount) {
                userToBurnFrom = testUsers[i];
                break;
            }
        }
        
        require(userToBurnFrom != address(0), "No user with sufficient balance");
        balances[userToBurnFrom] -= _amount;
        redemptionCaller[userToBurnFrom] = msg.sender; // Track that FLIPCore called this for the user
        uint256 id = nextRedemptionId++;
        emit RedemptionRequested(userToBurnFrom, _amount, id);
        return id;
    }

    function getRedemption(uint256 _redemptionId)
        external
        view
        override
        returns (address _agent, uint256 _amount, uint256 _startTime)
    {
        return (address(0), 0, 0);
    }
}



