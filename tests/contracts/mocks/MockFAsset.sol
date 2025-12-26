// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../../../contracts/interfaces/IFAsset.sol";

contract MockFAsset is IFAsset {
    mapping(address => uint256) public balances;
    uint256 public nextRedemptionId;

    function mint(address to, uint256 amount) external {
        balances[to] += amount;
    }

    function burn(uint256 _amount) external override {
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        balances[msg.sender] -= _amount;
    }

    function requestRedemption(uint256 _amount) external override returns (uint256 _redemptionId) {
        burn(_amount);
        uint256 id = nextRedemptionId++;
        emit RedemptionRequested(msg.sender, _amount, id);
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



